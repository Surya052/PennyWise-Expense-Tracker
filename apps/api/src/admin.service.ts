import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { BooksService } from './books.service';
import { assertNotLastAdmin, normalizeEmail, publicUser } from './auth.service';
import { assertPassword } from './common/password';
import { fail } from './common/money';
import { kolkataStart, todayInKolkata } from './common/dates';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private books: BooksService,
  ) {}

  async stats() {
    const start = kolkataStart(`${todayInKolkata().slice(0, 8)}01`);
    const [total, active, fresh] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { createdAt: { gte: start } } }),
    ]);
    return { total, active, newThisMonth: fresh };
  }

  async users(q: string | undefined) {
    const term = (q ?? '').trim();
    const rows = await this.prisma.user.findMany({
      where: term
        ? { OR: [{ name: { contains: term } }, { email: { contains: term } }] }
        : undefined,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { transactions: true, accounts: true } } },
    });
    return rows.map((user) => ({
      ...publicUser(user),
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      transactionCount: user._count.transactions,
      accountCount: user._count.accounts,
    }));
  }

  async create(admin: User, body: Record<string, unknown>, ip: string) {
    const name = String(body.name ?? '').trim();
    if (!name || name.length > 80) fail('Name is required');
    const email = normalizeEmail(body.email);
    const password = assertPassword(body.password);
    const role = body.role === 'admin' ? 'admin' : 'user';
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) fail('That email is already in use');
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.prisma.user.create({
      data: { name, email, passwordHash, role, mustChangePassword: true, createdById: admin.id },
    });
    await this.books.seedCategories(this.prisma, user.id);
    await this.audit(admin, 'user.create', user.id, { email, name, role }, ip);
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  async update(admin: User, id: string, body: Record<string, unknown>, ip: string) {
    const user = await this.mustUser(id);
    const name = body.name == null ? user.name : String(body.name).trim();
    if (!name || name.length > 80) fail('Name is required');
    const role = body.role == null ? user.role : body.role === 'admin' ? 'admin' : 'user';
    const isActive = body.isActive == null ? user.isActive : Boolean(body.isActive);
    if ((role !== 'admin' || !isActive) && user.role === 'admin' && user.isActive) {
      await assertNotLastAdmin(this.prisma, user);
    }
    const updated = await this.prisma.user.update({ where: { id }, data: { name, role, isActive } });
    if (!isActive) await this.prisma.session.deleteMany({ where: { userId: id } });
    await this.audit(admin, 'user.update', id, { email: updated.email, name, role, isActive }, ip);
    return { id, name, role, isActive };
  }

  async resetPassword(admin: User, id: string, body: Record<string, unknown>, ip: string) {
    const user = await this.mustUser(id);
    const password = assertPassword(body.password);
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } });
    await this.prisma.session.deleteMany({ where: { userId: id } });
    await this.audit(admin, 'user.reset_password', id, { email: user.email }, ip);
    return { ok: true };
  }

  async remove(admin: User, id: string, ip: string) {
    const user = await this.mustUser(id);
    if (user.id === admin.id) fail('Delete your own account from settings');
    await assertNotLastAdmin(this.prisma, user);
    await this.books.removeUserFiles(id);
    await this.audit(admin, 'user.delete', null, { email: user.email, name: user.name }, ip);
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }

  async auditLog() {
    const rows = await this.prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { admin: true },
    });
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      adminName: row.admin?.name ?? null,
      meta: safeMeta(row.meta),
      ip: row.ip,
      createdAt: row.createdAt,
    }));
  }

  private async mustUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) fail('User not found');
    return user;
  }

  private async audit(admin: User, action: string, targetUserId: string | null, meta: Record<string, unknown>, ip: string) {
    await this.prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action,
        targetUserId,
        meta: JSON.stringify({ ...meta, adminEmail: admin.email }),
        ip,
      },
    });
  }
}

function safeMeta(raw: string) {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    delete parsed.password;
    delete parsed.passwordHash;
    return parsed;
  } catch {
    return {};
  }
}
