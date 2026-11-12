import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from './prisma.service';
import { BooksService } from './books.service';
import { CacheService } from './cache.service';
import { FREQUENCIES, includesOne } from './common/constants';
import { advanceDate, isIsoDate, splitIso, todayInKolkata } from './common/dates';
import { fail, formatUnits, money, parsePaise, parsePositivePaise, parseUnitsMicro } from './common/money';

@Injectable()
export class PlanService {
  constructor(
    private prisma: PrismaService,
    private books: BooksService,
    private cache: CacheService,
  ) {}

  async listBudgets(userId: string, month: string) {
    const rows = await this.prisma.budget.findMany({
      where: { userId, month },
      include: { category: true },
      orderBy: { category: { name: 'asc' } },
    });
    return rows.map((row) => ({
      id: row.id,
      month: row.month,
      amount: money(row.amount),
      categoryId: row.categoryId,
      categoryName: row.category.name,
      color: row.category.color,
    }));
  }

  async saveBudget(userId: string, body: Record<string, unknown>) {
    const month = String(body.month ?? '');
    if (!/^\d{4}-\d{2}$/.test(month)) fail('Month must be YYYY-MM');
    const category = await this.prisma.category.findFirst({ where: { id: String(body.categoryId ?? ''), userId } });
    if (!category) fail('Category not found');
    const amount = parsePositivePaise(body.amount, 'Budget');
    const row = await this.prisma.budget.upsert({
      where: { userId_categoryId_month: { userId, categoryId: category.id, month } },
      create: { userId, categoryId: category.id, month, amount },
      update: { amount },
    });
    this.cache.dropUser(userId);
    return { id: row.id, amount: money(row.amount) };
  }

  async deleteBudget(userId: string, id: string) {
    const row = await this.prisma.budget.findFirst({ where: { id, userId } });
    if (!row) fail('Budget not found');
    await this.prisma.budget.delete({ where: { id } });
    this.cache.dropUser(userId);
    return { ok: true };
  }

  async listGoals(userId: string) {
    const rows = await this.prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      targetAmount: money(row.targetAmount),
      savedAmount: money(row.savedAmount),
      targetDate: row.targetDate,
    }));
  }

  async saveGoal(userId: string, body: Record<string, unknown>, id?: string) {
    const name = String(body.name ?? '').trim();
    if (!name || name.length > 80) fail('Goal name is required');
    const targetAmount = parsePositivePaise(body.targetAmount, 'Target');
    const savedAmount = body.savedAmount == null || body.savedAmount === '' ? 0n : parsePaise(body.savedAmount, 'Saved amount');
    if (savedAmount < 0n) fail('Saved amount cannot be negative');
    const targetDate = body.targetDate ? String(body.targetDate) : null;
    if (targetDate && !isIsoDate(targetDate)) fail('Target date must be YYYY-MM-DD');
    if (id) {
      const owned = await this.prisma.goal.findFirst({ where: { id, userId } });
      if (!owned) fail('Goal not found');
    }
    const data = { name, targetAmount, savedAmount, targetDate };
    const row = id
      ? await this.prisma.goal.update({ where: { id }, data })
      : await this.prisma.goal.create({ data: { ...data, userId } });
    return {
      id: row.id,
      name: row.name,
      targetAmount: money(row.targetAmount),
      savedAmount: money(row.savedAmount),
      targetDate: row.targetDate,
    };
  }

  async deleteGoal(userId: string, id: string) {
    const row = await this.prisma.goal.findFirst({ where: { id, userId } });
    if (!row) fail('Goal not found');
    await this.prisma.goal.delete({ where: { id } });
    return { ok: true };
  }

  async listRecurring(userId: string) {
    const rows = await this.prisma.recurringTransaction.findMany({ where: { userId }, orderBy: { nextRunDate: 'asc' } });
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      action: row.action,
      amount: money(row.amount),
      units: formatUnits(row.unitsMicro),
      note: row.note,
      paymentMethod: row.paymentMethod,
      accountId: row.accountId,
      toAccountId: row.toAccountId,
      categoryId: row.categoryId,
      holdingId: row.holdingId,
      tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
      frequency: row.frequency,
      nextRunDate: row.nextRunDate,
      isActive: row.isActive,
    }));
  }

  async saveRecurring(userId: string, body: Record<string, unknown>, id?: string) {
    if (id) {
      const owned = await this.prisma.recurringTransaction.findFirst({ where: { id, userId } });
      if (!owned) fail('Recurring transaction not found');
    }
    if (!includesOne(FREQUENCIES, body.frequency)) fail('Frequency must be daily, weekly, monthly, or yearly');
    const nextRunDate = String(body.nextRunDate ?? '');
    if (!isIsoDate(nextRunDate)) fail('Next date must be YYYY-MM-DD');
    const account = await this.prisma.account.findFirst({ where: { id: String(body.accountId ?? ''), userId } });
    if (!account) fail('Account not found');
    let toAccountId: string | null = null;
    if (body.type === 'transfer') {
      if (!body.toAccountId || body.toAccountId === account.id) fail('Choose two different accounts');
      const other = await this.prisma.account.findFirst({ where: { id: String(body.toAccountId), userId } });
      if (!other) fail('Account not found');
      toAccountId = other.id;
    }
    let categoryId: string | null = null;
    if (body.categoryId) {
      const category = await this.prisma.category.findFirst({ where: { id: String(body.categoryId), userId } });
      if (!category) fail('Category not found');
      categoryId = category.id;
    }
    let holdingId: string | null = null;
    let action: string | null = null;
    let unitsMicro: bigint | null = null;
    if (body.type === 'investment') {
      action = String(body.action ?? '');
      const holding = await this.prisma.holding.findFirst({ where: { id: String(body.holdingId ?? ''), userId } });
      if (!holding) fail('Holding not found');
      if (!['buy', 'sell', 'dividend', 'interest'].includes(action)) fail('Choose buy, sell, dividend, or interest');
      holdingId = holding.id;
      if (action === 'buy' || action === 'sell') unitsMicro = parseUnitsMicro(body.units);
    }
    if (!['expense', 'income', 'investment', 'transfer'].includes(String(body.type))) fail('Unknown transaction type');
    const [, month, day] = splitIso(nextRunDate);
    const tags = Array.isArray(body.tags) ? body.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean).join(',') : '';
    const data = {
      type: String(body.type),
      action,
      amount: parsePositivePaise(body.amount),
      unitsMicro,
      note: String(body.note ?? '').trim().slice(0, 500),
      paymentMethod: String(body.paymentMethod ?? '').trim().slice(0, 40),
      accountId: account.id,
      toAccountId,
      categoryId,
      holdingId,
      tags,
      frequency: String(body.frequency),
      anchorMonth: month,
      anchorDay: day,
      nextRunDate,
      isActive: body.isActive == null ? true : Boolean(body.isActive),
    };
    const row = id
      ? await this.prisma.recurringTransaction.update({ where: { id }, data })
      : await this.prisma.recurringTransaction.create({ data: { ...data, userId } });
    return { id: row.id, nextRunDate: row.nextRunDate, isActive: row.isActive };
  }

  async deleteRecurring(userId: string, id: string) {
    const row = await this.prisma.recurringTransaction.findFirst({ where: { id, userId } });
    if (!row) fail('Recurring transaction not found');
    await this.prisma.recurringTransaction.delete({ where: { id } });
    return { ok: true };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runDue() {
    const today = todayInKolkata();
    let created = 0;
    for (let round = 0; round < 24; round++) {
      const due = await this.prisma.recurringTransaction.findMany({
        where: { isActive: true, nextRunDate: { lte: today } },
        take: 40,
      });
      if (!due.length) break;
      let progress = 0;
      for (const row of due) {
        try {
          const posted = await this.prisma.$transaction(async (db) => {
            const next = advanceDate(row.nextRunDate, row.frequency, row.anchorMonth, row.anchorDay);
            const claim = await db.recurringTransaction.updateMany({
              where: { id: row.id, isActive: true, nextRunDate: row.nextRunDate },
              data: { nextRunDate: next },
            });
            if (claim.count !== 1) return false;
            await this.books.postTransaction(db, row.userId, {
              type: row.type,
              amount: row.amount.toString(),
              date: row.nextRunDate,
              accountId: row.accountId,
              toAccountId: row.toAccountId,
              categoryId: row.categoryId,
              holdingId: row.holdingId,
              action: row.action,
              units: row.unitsMicro ? formatUnits(row.unitsMicro) : undefined,
              note: row.note,
              paymentMethod: row.paymentMethod,
              tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
              recurringId: row.id,
            });
            return true;
          });
          if (posted) {
            created += 1;
            progress += 1;
            this.cache.dropUser(row.userId);
          }
        } catch {
          await this.prisma.recurringTransaction.update({ where: { id: row.id }, data: { isActive: false } });
        }
      }
      if (!progress) break;
    }
    return { created };
  }
}
