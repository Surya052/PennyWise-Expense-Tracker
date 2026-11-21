import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { User } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { BooksService } from './books.service';
import { CacheService } from './cache.service';
import { parseCsv, toCsv } from './common/csv';
import { clampDate, currentPeriodMonth, isIsoDate, periodForMonth, shiftMonth, todayInKolkata } from './common/dates';
import { fail, formatPaise, formatRs, money, parsePositivePaise } from './common/money';

@Injectable()
export class ReportService {
  constructor(
    private prisma: PrismaService,
    private books: BooksService,
    private cache: CacheService,
  ) {}

  async dashboard(user: User, month?: string) {
    const ym = month && /^\d{4}-\d{2}$/.test(month) ? month : currentPeriodMonth(todayInKolkata(), user.monthStartDay);
    const key = `${user.id}|dash|${ym}`;
    const cached = this.cache.get<Record<string, unknown>>(key);
    if (cached) return cached;
    const summary = await this.summarize(user, (await this.rangeFor(user, { mode: 'month', month: ym })).from, (await this.rangeFor(user, { mode: 'month', month: ym })).to);
    const range = await this.rangeFor(user, { mode: 'month', month: ym });
    const monthly = [];
    for (let i = 5; i >= 0; i--) {
      const label = shiftMonth(ym, -i);
      const period = periodForMonth(label, user.monthStartDay);
      const rows = await this.prisma.transaction.findMany({
        where: { userId: user.id, deletedAt: null, date: { gte: period.from, lte: period.to }, type: { in: ['income', 'expense'] } },
      });
      let income = 0n;
      let expense = 0n;
      for (const row of rows) {
        if (row.type === 'income') income += row.amount;
        else expense += row.amount;
      }
      monthly.push({ month: label, income: money(income), expense: money(expense) });
    }
    const recentRows = await this.prisma.transaction.findMany({
      where: { userId: user.id, deletedAt: null },
      include: { account: true, toAccount: true, category: true, holding: true, tags: { include: { tag: true } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 8,
    });
    const budgets = await this.budgetProgress(user.id, ym, range.from, range.to);
    const data = {
      month: ym,
      from: range.from,
      to: range.to,
      income: money(summary.income),
      expense: money(summary.expense),
      invested: money(summary.invested),
      netSavings: money(summary.income - summary.expense - summary.invested),
      netWorth: money(await this.books.netWorth(this.prisma, user.id)),
      byCategory: summary.byCategory,
      monthly,
      recent: recentRows.map(presentLite),
      budgets,
    };
    this.cache.set(key, data);
    return data;
  }

  async report(user: User, query: Record<string, string | undefined>) {
    const range = await this.rangeFor(user, query);
    const summary = await this.summarize(user, range.from, range.to);
    const top = await this.prisma.transaction.findMany({
      where: { userId: user.id, deletedAt: null, type: 'expense', date: { gte: range.from, lte: range.to } },
      include: { category: true, account: true },
      orderBy: { amount: 'desc' },
      take: 5,
    });
    const income = summary.income;
    const net = income - summary.expense - summary.invested;
    return {
      from: range.from,
      to: range.to,
      income: money(income),
      expense: money(summary.expense),
      invested: money(summary.invested),
      netSavings: money(net),
      savingsRate: income > 0n ? Number(net) / Number(income) : null,
      byCategory: summary.byCategory,
      topExpenses: top.map((row) => ({
        id: row.id,
        date: row.date,
        note: row.note,
        amount: money(row.amount),
        category: row.category?.name ?? '',
        account: row.account.name,
      })),
    };
  }

  async csv(user: User, query: Record<string, string | undefined>) {
    const rows = await this.rowsForExport(user, query);
    const header = ['date', 'type', 'action', 'amount', 'account', 'toAccount', 'category', 'note', 'tags', 'paymentMethod'];
    const body = rows.map((row) => [
      row.date,
      row.type,
      row.action ?? '',
      (Number(row.amount) / 100).toFixed(2),
      row.account.name,
      row.toAccount?.name ?? '',
      row.category?.name ?? '',
      row.note,
      row.tags.map((link) => link.tag.name).join('|'),
      row.paymentMethod,
    ]);
    return toCsv([header, ...body]);
  }

  async xlsx(user: User, query: Record<string, string | undefined>) {
    const rows = await this.rowsForExport(user, query);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Transactions');
    sheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Action', key: 'action', width: 12 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Account', key: 'account', width: 20 },
      { header: 'To account', key: 'toAccount', width: 20 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Note', key: 'note', width: 28 },
      { header: 'Tags', key: 'tags', width: 20 },
      { header: 'Payment method', key: 'paymentMethod', width: 18 },
    ];
    for (const row of rows) {
      sheet.addRow({
        date: row.date,
        type: row.type,
        action: row.action ?? '',
        amount: Number(row.amount) / 100,
        account: row.account.name,
        toAccount: row.toAccount?.name ?? '',
        category: row.category?.name ?? '',
        note: row.note,
        tags: row.tags.map((link) => link.tag.name).join('|'),
        paymentMethod: row.paymentMethod,
      });
    }
    sheet.getRow(1).font = { bold: true };
    sheet.getColumn('amount').numFmt = '#,##0.00';
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async pdf(user: User, query: Record<string, string | undefined>): Promise<Buffer> {
    const report = await this.report(user, query);
    const doc = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    const done = new Promise<Buffer>((resolvePromise) => doc.on('end', () => resolvePromise(Buffer.concat(chunks))));
    doc.fontSize(18).text('PennyWise report');
    doc.moveDown(0.4).fontSize(11).text(`${report.from} to ${report.to}`);
    doc.moveDown().text(`Income: ${formatRs(BigInt(report.income))}`);
    doc.text(`Expense: ${formatRs(BigInt(report.expense))}`);
    doc.text(`Invested: ${formatRs(BigInt(report.invested))}`);
    doc.text(`Net savings: ${formatRs(BigInt(report.netSavings))}`);
    doc.text(`Savings rate: ${report.savingsRate == null ? 'n/a' : `${Math.round(report.savingsRate * 1000) / 10}%`}`);
    doc.moveDown().fontSize(13).text('By category');
    doc.fontSize(11);
    for (const row of report.byCategory) doc.text(`${row.name}: ${formatRs(BigInt(row.amount))}`);
    doc.moveDown().fontSize(13).text('Top expenses');
    doc.fontSize(11);
    for (const row of report.topExpenses) doc.text(`${row.date}  ${row.category || row.note || 'Expense'}  ${formatRs(BigInt(row.amount))}`);
    doc.end();
    return done;
  }

  previewImport(csv: string) {
    const table = parseCsv(csv);
    if (!table.length) fail('The file is empty');
    const headers = table[0];
    const sample = table.slice(1, 6);
    const guess = (names: string[]) => headers.find((header) => names.includes(header.trim().toLowerCase())) ?? '';
    return {
      headers,
      sample,
      mapping: {
        date: guess(['date']),
        amount: guess(['amount', 'amt']),
        type: guess(['type']),
        account: guess(['account']),
        category: guess(['category']),
        note: guess(['note', 'payee', 'description']),
      },
    };
  }

  async importCsv(user: User, body: Record<string, unknown>) {
    const csv = String(body.csv ?? '');
    const mapping = (body.mapping ?? {}) as Record<string, string>;
    const table = parseCsv(csv);
    if (table.length < 2) fail('Add a header row and at least one transaction');
    if (table.length > 501) fail('Import up to 500 rows at a time');
    const headers = table[0];
    const index = (key: string) => headers.indexOf(mapping[key] ?? '');
    const dateI = index('date');
    const amountI = index('amount');
    const typeI = index('type');
    if (dateI < 0 || amountI < 0 || typeI < 0) fail('Map date, amount, and type columns');
    const accounts = await this.prisma.account.findMany({ where: { userId: user.id } });
    const categories = await this.prisma.category.findMany({ where: { userId: user.id } });
    const errors: string[] = [];
    const planned: { date: string; amount: bigint; type: string; accountId: string; categoryId: string | null; note: string }[] = [];
    table.slice(1).forEach((cells, offset) => {
      const line = offset + 2;
      const date = cells[dateI] ?? '';
      const type = (cells[typeI] ?? '').trim().toLowerCase();
      if (!isIsoDate(date)) {
        errors.push(`Row ${line}: date must be YYYY-MM-DD`);
        return;
      }
      if (!['expense', 'income'].includes(type)) {
        errors.push(`Row ${line}: type must be expense or income`);
        return;
      }
      let amount: bigint;
      try {
        amount = parsePositivePaise(cells[amountI] ?? '', 'Amount');
      } catch {
        errors.push(`Row ${line}: amount is invalid`);
        return;
      }
      const accountName = (cells[index('account')] ?? '').trim().toLowerCase();
      const account = accounts.find((item) => item.name.toLowerCase() === accountName) ?? (accountName ? undefined : accounts[0]);
      if (!account) {
        errors.push(`Row ${line}: account was not found`);
        return;
      }
      const categoryName = index('category') >= 0 ? (cells[index('category')] ?? '').trim().toLowerCase() : '';
      const category = categoryName ? categories.find((item) => item.name.toLowerCase() === categoryName && item.type === type) : undefined;
      if (categoryName && !category) {
        errors.push(`Row ${line}: category was not found`);
        return;
      }
      const note = index('note') >= 0 ? (cells[index('note')] ?? '').slice(0, 500) : '';
      planned.push({ date, amount, type, accountId: account.id, categoryId: category?.id ?? null, note });
    });
    if (errors.length) return { created: 0, errors };
    await this.prisma.transaction.createMany({
      data: planned.map((row) => ({ ...row, userId: user.id })),
    });
    this.cache.dropUser(user.id);
    return { created: planned.length, errors: [] };
  }

  private async summarize(user: User, from: string, to: string) {
    const rows = await this.prisma.transaction.findMany({
      where: { userId: user.id, deletedAt: null, date: { gte: from, lte: to } },
      include: { category: true },
    });
    let income = 0n;
    let expense = 0n;
    let invested = 0n;
    const byCategory = new Map<string, { name: string; color: string; amount: bigint }>();
    for (const row of rows) {
      if (row.type === 'income') income += row.amount;
      if (row.type === 'expense') {
        expense += row.amount;
        const key = row.categoryId ?? 'none';
        const current = byCategory.get(key) ?? { name: row.category?.name ?? 'Uncategorised', color: row.category?.color ?? '#8A8478', amount: 0n };
        current.amount += row.amount;
        byCategory.set(key, current);
      }
      if (row.type === 'investment' && row.action === 'buy') invested += row.amount;
    }
    return {
      income,
      expense,
      invested,
      byCategory: [...byCategory.values()]
        .sort((a, b) => (a.amount > b.amount ? -1 : 1))
        .map((row) => ({ name: row.name, color: row.color, amount: money(row.amount) })),
    };
  }

  private async budgetProgress(userId: string, month: string, from: string, to: string) {
    const budgets = await this.prisma.budget.findMany({ where: { userId, month }, include: { category: true } });
    const expenses = await this.prisma.transaction.findMany({
      where: { userId, deletedAt: null, type: 'expense', date: { gte: from, lte: to } },
      include: { category: true },
    });
    return budgets.map((budget) => {
      let spent = 0n;
      for (const expense of expenses) {
        if (expense.categoryId === budget.categoryId || expense.category?.parentId === budget.categoryId) spent += expense.amount;
      }
      const ratio = budget.amount > 0n ? Number(spent) / Number(budget.amount) : 0;
      return {
        id: budget.id,
        categoryName: budget.category.name,
        color: budget.category.color,
        amount: money(budget.amount),
        spent: money(spent),
        ratio,
        warning: ratio >= 1 ? 'over' : ratio >= 0.8 ? 'near' : 'ok',
      };
    });
  }

  private async rangeFor(user: User, query: Record<string, string | undefined>) {
    const mode = query.mode || 'month';
    if (mode === 'year') {
      const year = Number(query.year || todayInKolkata().slice(0, 4));
      const from = clampDate(year, 1, user.monthStartDay);
      const to = clampDate(year + 1, 1, user.monthStartDay);
      return { from, to: shiftDayBack(to) };
    }
    if (mode === 'custom') {
      if (!query.from || !query.to || !isIsoDate(query.from) || !isIsoDate(query.to) || query.from > query.to) {
        fail('Choose a valid date range');
      }
      return { from: query.from, to: query.to };
    }
    const month = query.month && /^\d{4}-\d{2}$/.test(query.month) ? query.month : currentPeriodMonth(todayInKolkata(), user.monthStartDay);
    return periodForMonth(month, user.monthStartDay);
  }

  private async rowsForExport(user: User, query: Record<string, string | undefined>) {
    const range = await this.rangeFor(user, query);
    return this.prisma.transaction.findMany({
      where: { userId: user.id, deletedAt: null, date: { gte: range.from, lte: range.to } },
      include: { account: true, toAccount: true, category: true, tags: { include: { tag: true } } },
      orderBy: { date: 'asc' },
    });
  }
}

function shiftDayBack(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

function presentLite(tx: {
  id: string;
  type: string;
  action: string | null;
  amount: bigint;
  date: string;
  note: string;
  account: { name: string };
  category: { name: string; icon: string; color: string } | null;
}) {
  return {
    id: tx.id,
    type: tx.type,
    action: tx.action,
    amount: money(tx.amount),
    date: tx.date,
    note: tx.note,
    accountName: tx.account.name,
    categoryName: tx.category?.name ?? '',
    categoryIcon: tx.category?.icon ?? '',
    categoryColor: tx.category?.color ?? '',
  };
}

export function displayMoney(paise: bigint, currency: string) {
  return formatPaise(paise, currency);
}
