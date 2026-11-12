import { Injectable, NotFoundException } from '@nestjs/common';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { CacheService } from './cache.service';
import { ACCOUNT_TYPES, ACTIONS, ASSET_TYPES, DEFAULT_CATEGORIES, TX_TYPES, includesOne } from './common/constants';
import { isIsoDate, todayInKolkata } from './common/dates';
import { fail, formatUnits, money, parsePaise, parsePositivePaise, parseUnitsMicro } from './common/money';
import { cagr, xirr } from './common/xirr';

export type Db = Prisma.TransactionClient;

const includeTx = {
  account: true,
  toAccount: true,
  category: true,
  holding: true,
  tags: { include: { tag: true } },
} satisfies Prisma.TransactionInclude;

export type TxInput = {
  type: string;
  amount: unknown;
  date: string;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  holdingId?: string | null;
  action?: string | null;
  units?: unknown;
  note?: string;
  paymentMethod?: string;
  tags?: string[];
  recurringId?: string | null;
};

@Injectable()
export class BooksService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async seedCategories(db: Db | PrismaService, userId: string) {
    const count = await db.category.count({ where: { userId } });
    if (count > 0) return;
    await db.category.createMany({
      data: DEFAULT_CATEGORIES.map((c, i) => ({
        userId,
        name: c.name,
        type: c.type,
        icon: c.icon,
        color: c.color,
        sortOrder: i,
      })),
    });
  }

  async removeUserFiles(userId: string) {
    await rm(join(this.uploadRoot(), userId), { recursive: true, force: true });
  }

  async listAccounts(userId: string) {
    const accounts = await this.prisma.account.findMany({ where: { userId }, orderBy: { name: 'asc' } });
    const balances = await this.balances(this.prisma, userId);
    return accounts.map((a) => this.presentAccount(a, balances.get(a.id) ?? 0n));
  }

  async createAccount(userId: string, body: Record<string, unknown>) {
    const data = this.accountData(body);
    const row = await this.prisma.account.create({ data: { ...data, userId } });
    this.cache.dropUser(userId);
    return this.presentAccount(row, data.openingBalance);
  }

  async updateAccount(userId: string, id: string, body: Record<string, unknown>) {
    await this.ownedAccount(this.prisma, userId, id);
    const data = this.accountData(body, true);
    const row = await this.prisma.account.update({ where: { id }, data });
    this.cache.dropUser(userId);
    const balances = await this.balances(this.prisma, userId);
    return this.presentAccount(row, balances.get(id) ?? 0n);
  }

  async deleteAccount(userId: string, id: string) {
    await this.ownedAccount(this.prisma, userId, id);
    const used = await this.prisma.transaction.count({
      where: { userId, OR: [{ accountId: id }, { toAccountId: id }] },
    });
    if (used) fail('Archive this account instead. It already has transactions.');
    await this.prisma.account.delete({ where: { id } });
    this.cache.dropUser(userId);
    return { ok: true };
  }

  async listCategories(userId: string) {
    const rows = await this.prisma.category.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map((c) => this.presentCategory(c));
  }

  async createCategory(userId: string, body: Record<string, unknown>) {
    const data = await this.categoryData(this.prisma, userId, body);
    const max = await this.prisma.category.aggregate({ where: { userId, type: data.type }, _max: { sortOrder: true } });
    const row = await this.prisma.category.create({
      data: { ...data, userId, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
    return this.presentCategory(row);
  }

  async updateCategory(userId: string, id: string, body: Record<string, unknown>) {
    const existing = await this.ownedCategory(this.prisma, userId, id);
    const data = await this.categoryData(this.prisma, userId, { ...existing, ...body, type: body.type ?? existing.type }, id);
    const row = await this.prisma.category.update({ where: { id }, data });
    return this.presentCategory(row);
  }

  async reorderCategory(userId: string, id: string, direction: unknown) {
    if (direction !== 'up' && direction !== 'down') fail('Direction must be up or down');
    const current = await this.ownedCategory(this.prisma, userId, id);
    const siblings = await this.prisma.category.findMany({
      where: { userId, type: current.type, parentId: current.parentId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const index = siblings.findIndex((s) => s.id === id);
    const swapWith = siblings[direction === 'up' ? index - 1 : index + 1];
    if (!swapWith) return this.listCategories(userId);
    await this.prisma.$transaction([
      this.prisma.category.update({ where: { id }, data: { sortOrder: swapWith.sortOrder } }),
      this.prisma.category.update({ where: { id: swapWith.id }, data: { sortOrder: current.sortOrder } }),
    ]);
    return this.listCategories(userId);
  }

  async listTransactions(userId: string, q: Record<string, string | undefined>) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 30));
    const and: Prisma.TransactionWhereInput[] = [{ userId, deletedAt: null }];
    if (q.type) {
      if (!includesOne(TX_TYPES, q.type)) fail('Unknown transaction type');
      and.push({ type: q.type });
    }
    if (q.accountId) and.push({ OR: [{ accountId: q.accountId }, { toAccountId: q.accountId }] });
    if (q.categoryId) and.push({ categoryId: q.categoryId });
    if (q.tag) and.push({ tags: { some: { tag: { name: q.tag.trim().toLowerCase() } } } });
    if (q.from || q.to) and.push({ date: { gte: q.from || undefined, lte: q.to || undefined } });
    if (q.min || q.max) {
      and.push({
        amount: {
          gte: q.min ? parsePaise(q.min, 'Minimum amount') : undefined,
          lte: q.max ? parsePaise(q.max, 'Maximum amount') : undefined,
        },
      });
    }
    if (q.q) {
      const term = q.q.trim();
      and.push({
        OR: [
          { note: { contains: term } },
          { category: { name: { contains: term } } },
          { tags: { some: { tag: { name: { contains: term.toLowerCase() } } } } },
        ],
      });
    }
    const where = { AND: and };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        include: includeTx,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: rows.map((row) => this.presentTx(row)), page, pageSize, total };
  }

  async getTransaction(userId: string, id: string) {
    return this.presentTx(await this.mustTx(this.prisma, userId, id));
  }

  async createTransaction(userId: string, body: TxInput) {
    const row = await this.prisma.$transaction((db) => this.postTransaction(db, userId, body));
    this.cache.dropUser(userId);
    return this.presentTx(row);
  }

  async updateTransaction(userId: string, id: string, body: TxInput) {
    const row = await this.prisma.$transaction(async (db) => {
      const existing = await this.mustTx(db, userId, id);
      const next = await this.postTransaction(db, userId, body, existing.id);
      if (existing.holdingId && existing.holdingId !== next.holdingId) await this.recomputeHolding(db, existing.holdingId);
      return next;
    });
    this.cache.dropUser(userId);
    return this.presentTx(row);
  }

  async deleteTransaction(userId: string, id: string) {
    await this.prisma.$transaction(async (db) => {
      const existing = await this.mustTx(db, userId, id);
      await db.transaction.update({ where: { id }, data: { deletedAt: new Date() } });
      if (existing.holdingId) await this.recomputeHolding(db, existing.holdingId);
    });
    this.cache.dropUser(userId);
    return { ok: true, id };
  }

  async restoreTransaction(userId: string, id: string) {
    const row = await this.prisma.$transaction(async (db) => {
      const existing = await db.transaction.findFirst({ where: { id, userId }, include: includeTx });
      if (!existing) throw new NotFoundException({ message: 'Transaction not found' });
      await db.transaction.update({ where: { id }, data: { deletedAt: null } });
      if (existing.holdingId) await this.recomputeHolding(db, existing.holdingId);
      return this.mustTx(db, userId, id);
    });
    this.cache.dropUser(userId);
    return this.presentTx(row);
  }

  async duplicateTransaction(userId: string, id: string) {
    const existing = await this.mustTx(this.prisma, userId, id);
    return this.createTransaction(userId, {
      type: existing.type,
      amount: existing.amount.toString(),
      date: todayInKolkata(),
      accountId: existing.accountId,
      toAccountId: existing.toAccountId,
      categoryId: existing.categoryId,
      holdingId: existing.holdingId,
      action: existing.action,
      units: existing.unitsMicro ? formatUnits(existing.unitsMicro) : undefined,
      note: existing.note,
      paymentMethod: existing.paymentMethod,
      tags: existing.tags.map((t) => t.tag.name),
    });
  }

  async saveReceipt(userId: string, id: string, file?: { buffer: Buffer; size: number }) {
    if (!file) fail('Choose a receipt image');
    if (file.size > 2 * 1024 * 1024) fail('Receipts must be 2 MB or smaller');
    const ext = sniffImage(file.buffer);
    if (!ext) fail('Receipt must be a JPEG, PNG, or WebP image');
    const existing = await this.mustTx(this.prisma, userId, id);
    const rel = join(userId, `${id}.${ext}`);
    const abs = join(this.uploadRoot(), rel);
    await mkdir(join(this.uploadRoot(), userId), { recursive: true });
    await writeFile(abs, file.buffer);
    if (existing.attachmentPath && existing.attachmentPath !== rel) {
      await rm(join(this.uploadRoot(), existing.attachmentPath), { force: true });
    }
    await this.prisma.transaction.update({ where: { id }, data: { attachmentPath: rel } });
    return { ok: true };
  }

  async readReceipt(userId: string, id: string) {
    const existing = await this.mustTx(this.prisma, userId, id);
    if (!existing.attachmentPath) throw new NotFoundException({ message: 'Receipt not found' });
    const abs = join(this.uploadRoot(), existing.attachmentPath);
    const data = await readFile(abs);
    const ext = existing.attachmentPath.split('.').pop();
    const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return { data, type };
  }

  async listHoldings(userId: string) {
    const holdings = await this.prisma.holding.findMany({ where: { userId }, orderBy: { name: 'asc' } });
    const presented = [];
    for (const holding of holdings) presented.push(await this.presentHolding(this.prisma, holding));
    const netWorth = await this.netWorth(this.prisma, userId);
    return { holdings: presented, netWorth: money(netWorth) };
  }

  async createHolding(userId: string, body: Record<string, unknown>) {
    const data = this.holdingData(body);
    const row = await this.prisma.holding.create({ data: { ...data, userId } });
    this.cache.dropUser(userId);
    return this.presentHolding(this.prisma, row);
  }

  async updateHolding(userId: string, id: string, body: Record<string, unknown>) {
    await this.ownedHolding(this.prisma, userId, id);
    const row = await this.prisma.holding.update({ where: { id }, data: this.holdingData(body) });
    return this.presentHolding(this.prisma, row);
  }

  async setHoldingValue(userId: string, id: string, body: Record<string, unknown>) {
    await this.ownedHolding(this.prisma, userId, id);
    const currentValue = parsePaise(body.currentValue, 'Current value');
    if (currentValue < 0n) fail('Current value cannot be negative');
    const row = await this.prisma.holding.update({
      where: { id },
      data: { currentValue, valueIsManual: true, lastValuedAt: new Date() },
    });
    this.cache.dropUser(userId);
    return this.presentHolding(this.prisma, row);
  }

  async deleteHolding(userId: string, id: string) {
    await this.ownedHolding(this.prisma, userId, id);
    const used = await this.prisma.transaction.count({ where: { userId, holdingId: id, deletedAt: null } });
    if (used) fail('This holding still has transactions');
    await this.prisma.holding.delete({ where: { id } });
    this.cache.dropUser(userId);
    return { ok: true };
  }

  async postTransaction(db: Db, userId: string, input: TxInput, existingId?: string) {
    if (!includesOne(TX_TYPES, input.type)) fail('Unknown transaction type');
    if (!isIsoDate(input.date)) fail('Date must be YYYY-MM-DD');
    const amount = parsePositivePaise(input.amount);
    const note = cleanText(input.note, 500);
    const paymentMethod = cleanText(input.paymentMethod, 40);
    const account = await this.ownedAccount(db, userId, input.accountId);
    let toAccountId: string | null = null;
    let categoryId: string | null = null;
    let holdingId: string | null = null;
    let action: string | null = null;
    let unitsMicro: bigint | null = null;
    if (input.type === 'transfer') {
      if (!input.toAccountId) fail('Choose the account to transfer into');
      if (input.toAccountId === account.id) fail('Choose two different accounts');
      await this.ownedAccount(db, userId, input.toAccountId);
      toAccountId = input.toAccountId;
    }
    if (input.type === 'expense' || input.type === 'income') {
      if (input.categoryId) {
        const category = await this.ownedCategory(db, userId, String(input.categoryId));
        if (category.type !== input.type) fail('Category does not match this transaction');
        categoryId = category.id;
      }
    }
    if (input.type === 'investment') {
      if (!includesOne(ACTIONS, input.action)) fail('Choose buy, sell, dividend, or interest');
      action = input.action;
      const holding = await this.ownedHolding(db, userId, String(input.holdingId || ''));
      holdingId = holding.id;
      if (action === 'buy' || action === 'sell') {
        unitsMicro = parseUnitsMicro(input.units);
      }
    }
    const base = {
      accountId: account.id,
      toAccountId,
      categoryId,
      holdingId,
      type: input.type,
      action,
      unitsMicro,
      amount,
      date: input.date,
      note,
      paymentMethod,
    };
    if (!existingId || input.recurringId !== undefined) {
      Object.assign(base, { recurringId: input.recurringId ?? null });
    }
    const row = existingId
      ? await db.transaction.update({ where: { id: existingId }, data: base, include: includeTx })
      : await db.transaction.create({ data: { ...base, userId }, include: includeTx });
    await this.syncTags(db, userId, row.id, input.tags ?? []);
    if (holdingId) await this.recomputeHolding(db, holdingId);
    return this.mustTx(db, userId, row.id);
  }

  async balances(db: Db | PrismaService, userId: string) {
    const accounts = await db.account.findMany({ where: { userId } });
    const txs = await db.transaction.findMany({ where: { userId, deletedAt: null } });
    const map = new Map(accounts.map((a) => [a.id, a.openingBalance]));
    for (const tx of txs) {
      const apply = (id: string | null, delta: bigint) => {
        if (!id || !map.has(id)) return;
        map.set(id, (map.get(id) ?? 0n) + delta);
      };
      if (tx.type === 'income') apply(tx.accountId, tx.amount);
      else if (tx.type === 'expense') apply(tx.accountId, -tx.amount);
      else if (tx.type === 'transfer') {
        apply(tx.accountId, -tx.amount);
        apply(tx.toAccountId, tx.amount);
      } else if (tx.type === 'investment') {
        apply(tx.accountId, tx.action === 'buy' ? -tx.amount : tx.amount);
      }
    }
    return map;
  }

  async netWorth(db: Db | PrismaService, userId: string) {
    const balances = await this.balances(db, userId);
    let total = 0n;
    for (const value of balances.values()) total += value;
    const holdings = await db.holding.findMany({ where: { userId } });
    for (const holding of holdings) total += holding.currentValue;
    return total;
  }

  private async recomputeHolding(db: Db, holdingId: string) {
    const holding = await db.holding.findUnique({ where: { id: holdingId } });
    if (!holding) return;
    const rows = await db.transaction.findMany({
      where: { holdingId, deletedAt: null, type: 'investment' },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    let units = 0n;
    let invested = 0n;
    for (const row of rows) {
      if (row.action === 'buy') {
        units += row.unitsMicro ?? 0n;
        invested += row.amount;
      } else if (row.action === 'sell') {
        const sold = row.unitsMicro ?? 0n;
        if (sold > units) fail('Sell quantity is higher than the units you hold');
        const reduction = units === 0n ? 0n : (invested * sold) / units;
        invested -= reduction;
        units -= sold;
        if (units === 0n) invested = 0n;
      }
    }
    await db.holding.update({
      where: { id: holdingId },
      data: {
        unitsMicro: units,
        investedAmount: invested,
        avgCost: units > 0n ? (invested * 1000000n) / units : 0n,
        currentValue: holding.valueIsManual ? holding.currentValue : invested,
      },
    });
  }

  private async presentHolding(db: Db | PrismaService, holding: {
    id: string;
    assetType: string;
    name: string;
    symbol: string | null;
    unitsMicro: bigint;
    avgCost: bigint;
    investedAmount: bigint;
    currentValue: bigint;
    valueIsManual: boolean;
    lastValuedAt: Date | null;
  }) {
    const rows = await db.transaction.findMany({
      where: { holdingId: holding.id, deletedAt: null, type: 'investment' },
      orderBy: { date: 'asc' },
    });
    let buys = 0n;
    let taken = 0n;
    for (const row of rows) {
      if (row.action === 'buy') buys += row.amount;
      else taken += row.amount;
    }
    const first = rows.find((row) => row.action === 'buy')?.date;
    const end = holding.lastValuedAt ? holding.lastValuedAt.toISOString().slice(0, 10) : todayInKolkata();
    const flows = rows.map((row) => ({
      date: row.date,
      amountPaise: row.action === 'buy' ? -row.amount : row.amount,
    }));
    if (holding.currentValue !== 0n) flows.push({ date: end, amountPaise: holding.currentValue });
    const rate = xirr(flows);
    const growth = first ? cagr(buys, taken + holding.currentValue, daysBetweenSafe(first, end)) : null;
    const gain = holding.currentValue - holding.investedAmount;
    return {
      id: holding.id,
      assetType: holding.assetType,
      name: holding.name,
      symbol: holding.symbol,
      units: formatUnits(holding.unitsMicro),
      avgCost: money(holding.avgCost),
      investedAmount: money(holding.investedAmount),
      currentValue: money(holding.currentValue),
      valueIsManual: holding.valueIsManual,
      gain: money(gain),
      gainPct: holding.investedAmount > 0n ? Number(gain) / Number(holding.investedAmount) : null,
      xirr: rate,
      cagr: growth,
    };
  }

  private async syncTags(db: Db, userId: string, transactionId: string, names: string[]) {
    await db.transactionTag.deleteMany({ where: { transactionId } });
    const clean = [...new Set(names.map((name) => name.trim().toLowerCase()).filter(Boolean))].slice(0, 12);
    for (const name of clean) {
      if (name.length > 30) fail('Tags must be 30 characters or fewer');
      const tag = await db.tag.upsert({
        where: { userId_name: { userId, name } },
        create: { userId, name },
        update: {},
      });
      await db.transactionTag.create({ data: { transactionId, tagId: tag.id } });
    }
  }

  private accountData(body: Record<string, unknown>, partial = false) {
    const name = cleanText(body.name, 80);
    if (!name) fail('Account name is required');
    if (!includesOne(ACCOUNT_TYPES, body.type)) fail('Unknown account type');
    const openingBalance = body.openingBalance == null || body.openingBalance === ''
      ? partial ? undefined : 0n
      : parsePaise(body.openingBalance, 'Opening balance');
    return {
      name,
      type: body.type,
      openingBalance: openingBalance ?? 0n,
      color: cleanColor(body.color) ?? '#5B8DB8',
      icon: cleanText(body.icon, 30) || 'wallet',
      isArchived: Boolean(body.isArchived),
    };
  }

  private async categoryData(db: Db | PrismaService, userId: string, body: Record<string, unknown>, id?: string) {
    const name = cleanText(body.name, 80);
    if (!name) fail('Category name is required');
    if (body.type !== 'expense' && body.type !== 'income') fail('Category type must be expense or income');
    let parentId: string | null = null;
    if (body.parentId) {
      const parent = await this.ownedCategory(db, userId, String(body.parentId));
      if (parent.id === id) fail('A category cannot be its own parent');
      if (parent.parentId) fail('Only one subcategory level is allowed');
      if (parent.type !== body.type) fail('Subcategory must match the parent type');
      parentId = parent.id;
    }
    return {
      name,
      type: body.type as string,
      parentId,
      color: cleanColor(body.color) ?? '#5B8DB8',
      icon: cleanText(body.icon, 30) || 'more',
      isArchived: Boolean(body.isArchived),
    };
  }

  private holdingData(body: Record<string, unknown>) {
    const name = cleanText(body.name, 80);
    if (!name) fail('Holding name is required');
    if (!includesOne(ASSET_TYPES, body.assetType)) fail('Unknown asset type');
    const symbol = cleanText(body.symbol, 20);
    return { name, assetType: body.assetType as string, symbol: symbol || null };
  }

  private async ownedAccount(db: Db | PrismaService, userId: string, id: string) {
    const row = await db.account.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException({ message: 'Account not found' });
    return row;
  }

  private async ownedCategory(db: Db | PrismaService, userId: string, id: string) {
    const row = await db.category.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException({ message: 'Category not found' });
    return row;
  }

  private async ownedHolding(db: Db | PrismaService, userId: string, id: string) {
    const row = await db.holding.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException({ message: 'Holding not found' });
    return row;
  }

  private async mustTx(db: Db | PrismaService, userId: string, id: string) {
    const row = await db.transaction.findFirst({ where: { id, userId, deletedAt: null }, include: includeTx });
    if (!row) throw new NotFoundException({ message: 'Transaction not found' });
    return row;
  }

  private presentAccount(account: {
    id: string;
    name: string;
    type: string;
    openingBalance: bigint;
    color: string;
    icon: string;
    isArchived: boolean;
  }, currentBalance: bigint) {
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      openingBalance: money(account.openingBalance),
      currentBalance: money(currentBalance),
      color: account.color,
      icon: account.icon,
      isArchived: account.isArchived,
    };
  }

  private presentCategory(category: {
    id: string;
    parentId: string | null;
    name: string;
    type: string;
    color: string;
    icon: string;
    sortOrder: number;
    isArchived: boolean;
  }) {
    return {
      id: category.id,
      parentId: category.parentId,
      name: category.name,
      type: category.type,
      color: category.color,
      icon: category.icon,
      sortOrder: category.sortOrder,
      isArchived: category.isArchived,
    };
  }

  private presentTx(tx: Prisma.TransactionGetPayload<{ include: typeof includeTx }>) {
    return {
      id: tx.id,
      type: tx.type,
      action: tx.action,
      amount: money(tx.amount),
      units: formatUnits(tx.unitsMicro),
      date: tx.date,
      note: tx.note,
      paymentMethod: tx.paymentMethod,
      account: { id: tx.account.id, name: tx.account.name, type: tx.account.type },
      toAccount: tx.toAccount ? { id: tx.toAccount.id, name: tx.toAccount.name } : null,
      category: tx.category ? { id: tx.category.id, name: tx.category.name, color: tx.category.color, icon: tx.category.icon } : null,
      holding: tx.holding ? { id: tx.holding.id, name: tx.holding.name, assetType: tx.holding.assetType } : null,
      tags: tx.tags.map((link) => link.tag.name),
      hasReceipt: Boolean(tx.attachmentPath),
    };
  }

  private uploadRoot() {
    return resolve(__dirname, '..', 'data', 'uploads');
  }
}

function cleanText(value: unknown, max: number): string {
  if (value == null) return '';
  return String(value).trim().slice(0, max);
}

function cleanColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
}

function sniffImage(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function daysBetweenSafe(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}
