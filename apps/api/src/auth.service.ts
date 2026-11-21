import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { BooksService } from './books.service';
import { assertPassword, clearRateLimit, randomToken, rateLimit, sha256 } from './common/password';
import { fail } from './common/money';
import { userModules } from './common/modules';

const COOKIE = 'pw_session';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private books: BooksService,
  ) {}

  async login(body: Record<string, unknown>, res: Response) {
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? '');
    rateLimit(`login:${email}`, 5, 15 * 60 * 1000);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const match = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !match) {
      throw new UnauthorizedException({ message: 'Email or password is incorrect' });
    }
    if (!user.isActive) {
      throw new UnauthorizedException({ message: 'This account is deactivated' });
    }
    clearRateLimit(`login:${email}`);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.startSession(user.id, Boolean(body.remember), res);
    const fresh = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    return { user: publicUser(fresh) };
  }

  async logout(raw: string | undefined, res: Response) {
    if (raw) await this.prisma.session.deleteMany({ where: { id: sha256(raw) } });
    res.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  }

  async forgot(body: Record<string, unknown>) {
    const email = normalizeEmail(body.email);
    rateLimit(`reset:${email}`, 5, 60 * 60 * 1000);
    const user = await this.prisma.user.findUnique({ where: { email } });
    let resetToken: string | undefined;
    if (user && user.isActive) {
      const raw = randomToken();
      await this.prisma.passwordResetToken.deleteMany({ where: { email } });
      await this.prisma.passwordResetToken.create({
        data: { email, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      });
      if (process.env.NODE_ENV === 'test') resetToken = raw;
      else if (process.env.NODE_ENV !== 'production') {
        console.log(`Password reset link: ${process.env.APP_URL || 'http://localhost:5173'}/reset?token=${raw}`);
      }
    }
    return {
      message: 'If an account exists for that email, a reset link is ready.',
      ...(resetToken ? { resetToken } : {}),
    };
  }

  async reset(body: Record<string, unknown>) {
    const token = String(body.token ?? '');
    const password = assertPassword(body.password);
    if (!token) fail('Reset link is invalid');
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row || row.expiresAt.getTime() < Date.now()) fail('Reset link is invalid or expired');
    const user = await this.prisma.user.findUnique({ where: { email: row.email } });
    if (!user) fail('Reset link is invalid or expired');
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } }),
      this.prisma.session.deleteMany({ where: { userId: user.id } }),
      this.prisma.passwordResetToken.deleteMany({ where: { email: row.email } }),
    ]);
    return { ok: true };
  }

  async changePassword(user: User, body: Record<string, unknown>, raw: string | undefined, res: Response) {
    const current = String(body.currentPassword ?? '');
    const next = assertPassword(body.newPassword);
    const match = await bcrypt.compare(current, user.passwordHash);
    if (!match) fail('Current password is incorrect');
    const passwordHash = await bcrypt.hash(next, 12);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } });
    await this.prisma.session.deleteMany({ where: { userId: user.id } });
    await this.startSession(user.id, true, res);
    if (raw) {
      await this.prisma.session.deleteMany({ where: { id: sha256(raw) } });
    }
    const fresh = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    return { user: publicUser(fresh) };
  }

  async updateProfile(user: User, body: Record<string, unknown>) {
    const data: Record<string, unknown> = {};
    if (body.name != null) {
      const name = String(body.name).trim();
      if (!name || name.length > 80) fail('Name is required');
      data.name = name;
    }
    if (body.currency != null) {
      if (!['INR', 'USD', 'EUR', 'GBP', 'AED'].includes(String(body.currency))) fail('Unsupported currency');
      data.currency = body.currency;
    }
    if (body.dateFormat != null) {
      if (!['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].includes(String(body.dateFormat))) fail('Unsupported date format');
      data.dateFormat = body.dateFormat;
    }
    if (body.monthStartDay != null) {
      const day = Number(body.monthStartDay);
      if (!Number.isInteger(day) || day < 1 || day > 28) fail('First day of month must be from 1 to 28');
      data.monthStartDay = day;
    }
    if (body.theme != null) {
      if (!['light', 'dark', 'system'].includes(String(body.theme))) fail('Unsupported theme');
      data.theme = body.theme;
    }
    const fresh = await this.prisma.user.update({ where: { id: user.id }, data });
    return { user: publicUser(fresh) };
  }

  async exportMine(user: User) {
    const [accounts, categories, transactions, holdings, budgets, goals, recurring] = await Promise.all([
      this.prisma.account.findMany({ where: { userId: user.id } }),
      this.prisma.category.findMany({ where: { userId: user.id } }),
      this.prisma.transaction.findMany({ where: { userId: user.id }, include: { tags: { include: { tag: true } } } }),
      this.prisma.holding.findMany({ where: { userId: user.id } }),
      this.prisma.budget.findMany({ where: { userId: user.id } }),
      this.prisma.goal.findMany({ where: { userId: user.id } }),
      this.prisma.recurringTransaction.findMany({ where: { userId: user.id } }),
    ]);
    const pack = (value: bigint) => value.toString();
    return {
      exportedAt: new Date().toISOString(),
      profile: publicUser(user),
      accounts: accounts.map((a) => ({ ...a, openingBalance: pack(a.openingBalance) })),
      categories,
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        action: t.action,
        amount: pack(t.amount),
        units: t.unitsMicro?.toString() ?? null,
        date: t.date,
        note: t.note,
        paymentMethod: t.paymentMethod,
        accountId: t.accountId,
        toAccountId: t.toAccountId,
        categoryId: t.categoryId,
        holdingId: t.holdingId,
        tags: t.tags.map((link) => link.tag.name),
        hasReceipt: Boolean(t.attachmentPath),
        deletedAt: t.deletedAt,
      })),
      holdings: holdings.map((h) => ({
        ...h,
        unitsMicro: pack(h.unitsMicro),
        avgCost: pack(h.avgCost),
        investedAmount: pack(h.investedAmount),
        currentValue: pack(h.currentValue),
      })),
      budgets: budgets.map((b) => ({ ...b, amount: pack(b.amount) })),
      goals: goals.map((g) => ({ ...g, targetAmount: pack(g.targetAmount), savedAmount: pack(g.savedAmount) })),
      recurring: recurring.map((r) => ({ ...r, amount: pack(r.amount), unitsMicro: r.unitsMicro ? pack(r.unitsMicro) : null })),
    };
  }

  async deleteMine(user: User, body: Record<string, unknown>, res: Response) {
    if (normalizeEmail(body.email) !== user.email) fail('Type your email to confirm');
    const match = await bcrypt.compare(String(body.password ?? ''), user.passwordHash);
    if (!match) fail('Password is incorrect');
    await assertNotLastAdmin(this.prisma, user);
    await this.books.removeUserFiles(user.id);
    await this.prisma.user.delete({ where: { id: user.id } });
    res.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  }

  private async startSession(userId: string, remember: boolean, res: Response) {
    const raw = randomToken();
    const maxAge = (remember ? 30 : 1) * 24 * 60 * 60 * 1000;
    await this.prisma.session.create({
      data: { id: sha256(raw), userId, expiresAt: new Date(Date.now() + maxAge) },
    });
    res.cookie(COOKIE, raw, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge,
    });
  }
}

export function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    currency: user.currency,
    dateFormat: user.dateFormat,
    monthStartDay: user.monthStartDay,
    theme: user.theme,
    modules: userModules(user),
  };
}

export function normalizeEmail(value: unknown): string {
  const email = String(value ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) fail('Enter a valid email');
  return email;
}

export async function assertNotLastAdmin(prisma: PrismaService, user: User) {
  if (user.role !== 'admin' || !user.isActive) return;
  const others = await prisma.user.count({ where: { role: 'admin', isActive: true, NOT: { id: user.id } } });
  if (others < 1) fail('Keep at least one active admin');
}
