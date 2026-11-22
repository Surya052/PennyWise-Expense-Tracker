import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { BooksService } from './books.service';
import { PlanService } from './plan.service';
import { publicUser } from './auth.service';
import { fail } from './common/money';
import { isStaff, isSuper } from './common/roles';
import { todayInKolkata } from './common/dates';

type Gate = {
  entity: string;
  entityId: string;
  action: 'update' | 'delete';
  payload: Record<string, unknown>;
  summary: string;
};

@Injectable()
export class ApprovalService {
  constructor(
    private prisma: PrismaService,
    private books: BooksService,
    private plans: PlanService,
  ) {}

  async ownerFor(actor: User, requested?: string | null) {
    if (!requested || requested === actor.id) return actor.id;
    if (!isStaff(actor.role)) fail('Only an admin can open another user');
    const target = await this.prisma.user.findUnique({ where: { id: requested } });
    if (!target) fail('User not found');
    if (target.role !== 'user' && !isSuper(actor.role)) fail('Only a super admin can change an admin');
    return target.id;
  }

  async gate(actor: User, requestedOwner: string | undefined, change: Gate, apply: (ownerId: string) => Promise<unknown>) {
    const ownerId = await this.ownerFor(actor, requestedOwner);
    if (actor.role === 'user') {
      const open = await this.prisma.changeRequest.findFirst({
        where: { ownerId, entity: change.entity, entityId: change.entityId, action: change.action, status: 'pending' },
      });
      if (open) fail('This change is already waiting for approval');
      const row = await this.prisma.changeRequest.create({
        data: {
          ownerId,
          requestedById: actor.id,
          entity: change.entity,
          entityId: change.entityId,
          action: change.action,
          payload: JSON.stringify(change.payload),
          summary: change.summary,
        },
      });
      return { pending: true, id: row.id, status: row.status };
    }
    return apply(ownerId);
  }

  async list(actor: User) {
    const rows = await this.prisma.changeRequest.findMany({
      where: isStaff(actor.role) ? undefined : { requestedById: actor.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { owner: true, requestedBy: true, reviewedBy: true },
    });
    return rows
      .filter((row) => isSuper(actor.role) || !isStaff(actor.role) || row.owner.role === 'user')
      .map((row) => ({
        id: row.id,
        entity: row.entity,
        entityId: row.entityId,
        action: row.action,
        summary: row.summary,
        status: row.status,
        createdAt: row.createdAt,
        reviewedAt: row.reviewedAt,
        ownerName: row.owner.name,
        ownerEmail: row.owner.email,
        requestedByName: row.requestedBy.name,
        reviewedByName: row.reviewedBy?.name ?? null,
      }));
  }

  async decide(actor: User, id: string, status: 'approved' | 'rejected') {
    if (!isStaff(actor.role)) fail('Only an admin can review a request');
    const row = await this.prisma.changeRequest.findUnique({ where: { id }, include: { owner: true } });
    if (!row) fail('Request not found');
    if (row.status !== 'pending') fail('This request is already reviewed');
    if (row.owner.role !== 'user' && !isSuper(actor.role)) fail('Only a super admin can review an admin change');
    if (status === 'approved') await this.apply(row.ownerId, row.entity, row.entityId, row.action, row.payload);
    const saved = await this.prisma.changeRequest.update({
      where: { id },
      data: { status, reviewedById: actor.id, reviewedAt: new Date() },
      include: { reviewedBy: true },
    });
    return { id: saved.id, status: saved.status, reviewedByName: saved.reviewedBy?.name ?? actor.name, reviewedAt: saved.reviewedAt };
  }

  async snapshot(actor: User, userId: string) {
    const ownerId = await this.ownerFor(actor, userId);
    const month = todayInKolkata().slice(0, 7);
    const [profile, accounts, categories, transactions, holdings, goals, recurring, budgets] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: ownerId } }),
      this.books.listAccounts(ownerId),
      this.books.listCategories(ownerId),
      this.books.listTransactions(ownerId, { page: '1', pageSize: '50' }),
      this.books.listHoldings(ownerId),
      this.plans.listGoals(ownerId),
      this.plans.listRecurring(ownerId),
      this.plans.listBudgets(ownerId, month),
    ]);
    return {
      user: { ...publicUser(profile), isActive: profile.isActive, lastLoginAt: profile.lastLoginAt },
      accounts,
      categories,
      transactions: transactions.items,
      holdings: holdings.holdings,
      goals,
      recurring,
      budgets,
      month,
    };
  }

  private async apply(ownerId: string, entity: string, entityId: string, action: string, raw: string) {
    const body = JSON.parse(raw) as Record<string, unknown>;
    const key = `${entity}:${action}`;
    if (key === 'account:update') return this.books.updateAccount(ownerId, entityId, body);
    if (key === 'account:delete') return this.books.deleteAccount(ownerId, entityId);
    if (key === 'category:update') return this.books.updateCategory(ownerId, entityId, body);
    if (key === 'category:delete') return this.books.deleteCategory(ownerId, entityId);
    if (key === 'transaction:update') return this.books.updateTransaction(ownerId, entityId, body as never);
    if (key === 'transaction:delete') return this.books.deleteTransaction(ownerId, entityId);
    if (key === 'holding:update') return this.books.updateHolding(ownerId, entityId, body);
    if (key === 'holding:delete') return this.books.deleteHolding(ownerId, entityId);
    if (key === 'holdingValue:update') return this.books.setHoldingValue(ownerId, entityId, body);
    if (key === 'budget:update') return this.plans.saveBudget(ownerId, body);
    if (key === 'budget:delete') return this.plans.deleteBudget(ownerId, entityId);
    if (key === 'goal:update') return this.plans.saveGoal(ownerId, body, entityId);
    if (key === 'goal:delete') return this.plans.deleteGoal(ownerId, entityId);
    if (key === 'recurring:update') return this.plans.saveRecurring(ownerId, body, entityId);
    if (key === 'recurring:delete') return this.plans.deleteRecurring(ownerId, entityId);
    fail('Unknown request');
  }
}
