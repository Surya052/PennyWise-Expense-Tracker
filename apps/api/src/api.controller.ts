import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { AuthService, publicUser } from './auth.service';
import { AdminService } from './admin.service';
import { ApprovalService } from './approval.service';
import { BooksService } from './books.service';
import { ReportService } from './report.service';
import { PlanService } from './plan.service';
import { PrismaService } from './prisma.service';
import { AuthGuard, AdminGuard } from './auth.guard';
import { SessionUser, clientIp } from './session.decorator';
import { User } from '@prisma/client';
import { sha256 } from './common/password';
import { fail } from './common/money';
import { APP_VERSION } from './version';

@Controller()
export class ApiController {
  constructor(
    private auth: AuthService,
    private admin: AdminService,
    private approval: ApprovalService,
    private books: BooksService,
    private reports: ReportService,
    private plans: PlanService,
    private prisma: PrismaService,
  ) {}

  @Get('health')
  health() {
    return { ok: true, name: 'PennyWise', version: APP_VERSION };
  }

  @Post('auth/login')
  login(@Body() body: Record<string, unknown>, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(body, res);
  }

  @Post('auth/logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(req.cookies?.pw_session, res);
  }

  @Post('auth/forgot')
  forgot(@Body() body: Record<string, unknown>) {
    return this.auth.forgot(body);
  }

  @Post('auth/reset')
  reset(@Body() body: Record<string, unknown>) {
    return this.auth.reset(body);
  }

  @Get('auth/me')
  async me(@Req() req: Request) {
    const user = await this.sessionUser(req);
    return { user: publicUser(user) };
  }

  @UseGuards(AuthGuard)
  @Post('auth/change-password')
  changePassword(
    @SessionUser() user: User,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.changePassword(user, body, req.cookies?.pw_session, res);
  }

  @UseGuards(AuthGuard)
  @Patch('settings/profile')
  updateProfile(@SessionUser() user: User, @Body() body: Record<string, unknown>) {
    return this.auth.updateProfile(user, body);
  }

  @UseGuards(AuthGuard)
  @Get('settings/export')
  exportData(@SessionUser() user: User) {
    return this.auth.exportMine(user);
  }

  @UseGuards(AuthGuard)
  @Post('settings/delete-account')
  deleteAccount(
    @SessionUser() user: User,
    @Body() body: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.deleteMine(user, body, res);
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Get('admin/stats')
  adminStats() {
    return this.admin.stats();
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Get('admin/users')
  adminUsers(@Query('q') q?: string) {
    return this.admin.users(q);
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Post('admin/users')
  adminCreate(@SessionUser() admin: User, @Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.admin.create(admin, body, clientIp(req));
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Patch('admin/users/:id')
  adminUpdate(
    @SessionUser() admin: User,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.admin.update(admin, id, body, clientIp(req));
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Post('admin/users/:id/reset-password')
  adminResetPassword(
    @SessionUser() admin: User,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.admin.resetPassword(admin, id, body, clientIp(req));
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Delete('admin/users/:id')
  adminDelete(@SessionUser() admin: User, @Param('id') id: string, @Req() req: Request) {
    return this.admin.remove(admin, id, clientIp(req));
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Get('admin/audit')
  adminAudit() {
    return this.admin.auditLog();
  }

  @UseGuards(AuthGuard)
  @Get('requests')
  listRequests(@SessionUser() user: User) {
    return this.approval.list(user);
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Post('requests/:id/approve')
  approveRequest(@SessionUser() user: User, @Param('id') id: string) {
    return this.approval.decide(user, id, 'approved');
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Post('requests/:id/reject')
  rejectRequest(@SessionUser() user: User, @Param('id') id: string) {
    return this.approval.decide(user, id, 'rejected');
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Get('admin/users/:id/books')
  userBooks(@SessionUser() user: User, @Param('id') id: string) {
    return this.approval.snapshot(user, id);
  }

  @UseGuards(AuthGuard)
  @Get('accounts')
  async listAccounts(@SessionUser() user: User, @Query('ownerId') ownerId?: string) {
    return this.books.listAccounts(await this.approval.ownerFor(user, ownerId));
  }

  @UseGuards(AuthGuard)
  @Post('accounts')
  createAccount(@SessionUser() user: User, @Body() body: Record<string, unknown>) {
    return this.books.createAccount(user.id, body);
  }

  @UseGuards(AuthGuard)
  @Patch('accounts/:id')
  updateAccount(@SessionUser() user: User, @Param('id') id: string, @Body() body: Record<string, unknown>, @Query('ownerId') ownerId?: string) {
    return this.approval.gate(user, ownerId, { entity: 'account', entityId: id, action: 'update', payload: body, summary: `Edit account ${textOf(body.name)}` }, (owner) => this.books.updateAccount(owner, id, body));
  }

  @UseGuards(AuthGuard)
  @Delete('accounts/:id')
  deleteAccountRow(@SessionUser() user: User, @Param('id') id: string, @Query('ownerId') ownerId?: string) {
    return this.approval.gate(user, ownerId, { entity: 'account', entityId: id, action: 'delete', payload: {}, summary: 'Delete account' }, (owner) => this.books.deleteAccount(owner, id));
  }

  @UseGuards(AuthGuard)
  @Get('categories')
  async listCategories(@SessionUser() user: User, @Query('ownerId') ownerId?: string) {
    return this.books.listCategories(await this.approval.ownerFor(user, ownerId));
  }

  @UseGuards(AuthGuard)
  @Post('categories')
  createCategory(@SessionUser() user: User, @Body() body: Record<string, unknown>) {
    return this.books.createCategory(user.id, body);
  }

  @UseGuards(AuthGuard)
  @Patch('categories/:id')
  updateCategory(@SessionUser() user: User, @Param('id') id: string, @Body() body: Record<string, unknown>, @Query('ownerId') ownerId?: string) {
    return this.approval.gate(user, ownerId, { entity: 'category', entityId: id, action: 'update', payload: body, summary: `Edit category ${textOf(body.name)}` }, (owner) => this.books.updateCategory(owner, id, body));
  }

  @UseGuards(AuthGuard)
  @Delete('categories/:id')
  deleteCategory(@SessionUser() user: User, @Param('id') id: string, @Query('ownerId') ownerId?: string) {
    return this.approval.gate(user, ownerId, { entity: 'category', entityId: id, action: 'delete', payload: {}, summary: 'Delete category' }, (owner) => this.books.deleteCategory(owner, id));
  }

  @UseGuards(AuthGuard)
  @Post('categories/:id/reorder')
  reorderCategory(@SessionUser() user: User, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.books.reorderCategory(user.id, id, body.direction);
  }

  @UseGuards(AuthGuard)
  @Get('transactions')
  async listTransactions(@SessionUser() user: User, @Query() query: Record<string, string | undefined>) {
    const owner = await this.approval.ownerFor(user, query.ownerId);
    const { ownerId: _owner, ...rest } = query;
    return this.books.listTransactions(owner, rest);
  }

  @UseGuards(AuthGuard)
  @Get('transactions/:id')
  getTransaction(@SessionUser() user: User, @Param('id') id: string) {
    return this.books.getTransaction(user.id, id);
  }

  @UseGuards(AuthGuard)
  @Post('transactions')
  createTransaction(@SessionUser() user: User, @Body() body: Record<string, unknown>) {
    return this.books.createTransaction(user.id, body as never);
  }

  @UseGuards(AuthGuard)
  @Patch('transactions/:id')
  updateTransaction(@SessionUser() user: User, @Param('id') id: string, @Body() body: Record<string, unknown>, @Query('ownerId') ownerId?: string) {
    return this.approval.gate(user, ownerId, { entity: 'transaction', entityId: id, action: 'update', payload: body, summary: `Edit transaction ${textOf(body.amount)}` }, (owner) => this.books.updateTransaction(owner, id, body as never));
  }

  @UseGuards(AuthGuard)
  @Delete('transactions/:id')
  deleteTransaction(@SessionUser() user: User, @Param('id') id: string, @Query('ownerId') ownerId?: string) {
    return this.approval.gate(user, ownerId, { entity: 'transaction', entityId: id, action: 'delete', payload: {}, summary: 'Delete transaction' }, (owner) => this.books.deleteTransaction(owner, id));
  }

  @UseGuards(AuthGuard)
  @Post('transactions/:id/restore')
  restoreTransaction(@SessionUser() user: User, @Param('id') id: string) {
    return this.books.restoreTransaction(user.id, id);
  }

  @UseGuards(AuthGuard)
  @Post('transactions/:id/duplicate')
  duplicateTransaction(@SessionUser() user: User, @Param('id') id: string) {
    return this.books.duplicateTransaction(user.id, id);
  }

  @UseGuards(AuthGuard)
  @Post('transactions/:id/receipt')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  saveReceipt(
    @SessionUser() user: User,
    @Param('id') id: string,
    @UploadedFile() file?: { buffer: Buffer; size: number },
  ) {
    return this.books.saveReceipt(user.id, id, file);
  }

  @UseGuards(AuthGuard)
  @Get('transactions/:id/receipt')
  async receipt(@SessionUser() user: User, @Param('id') id: string, @Res() res: Response) {
    const payload = await this.books.readReceipt(user.id, id);
    res.setHeader('Content-Type', payload.type);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(payload.data);
  }

  @UseGuards(AuthGuard)
  @Get('holdings')
  async listHoldings(@SessionUser() user: User, @Query('ownerId') ownerId?: string) {
    return this.books.listHoldings(await this.approval.ownerFor(user, ownerId));
  }

  @UseGuards(AuthGuard)
  @Post('holdings')
  createHolding(@SessionUser() user: User, @Body() body: Record<string, unknown>) {
    return this.books.createHolding(user.id, body);
  }

  @UseGuards(AuthGuard)
  @Patch('holdings/:id')
  updateHolding(@SessionUser() user: User, @Param('id') id: string, @Body() body: Record<string, unknown>, @Query('ownerId') ownerId?: string) {
    return this.approval.gate(user, ownerId, { entity: 'holding', entityId: id, action: 'update', payload: body, summary: `Edit holding ${textOf(body.name)}` }, (owner) => this.books.updateHolding(owner, id, body));
  }

  @UseGuards(AuthGuard)
  @Post('holdings/:id/value')
  setHoldingValue(@SessionUser() user: User, @Param('id') id: string, @Body() body: Record<string, unknown>, @Query('ownerId') ownerId?: string) {
    return this.approval.gate(user, ownerId, { entity: 'holdingValue', entityId: id, action: 'update', payload: body, summary: `Update holding value ${textOf(body.currentValue)}` }, (owner) => this.books.setHoldingValue(owner, id, body));
  }

  @UseGuards(AuthGuard)
  @Delete('holdings/:id')
  deleteHolding(@SessionUser() user: User, @Param('id') id: string, @Query('ownerId') ownerId?: string) {
    return this.approval.gate(user, ownerId, { entity: 'holding', entityId: id, action: 'delete', payload: {}, summary: 'Delete holding' }, (owner) => this.books.deleteHolding(owner, id));
  }

  @UseGuards(AuthGuard)
  @Get('dashboard')
  dashboard(@SessionUser() user: User, @Query('month') month?: string) {
    return this.reports.dashboard(user, month);
  }

  @UseGuards(AuthGuard)
  @Get('reports')
  report(@SessionUser() user: User, @Query() query: Record<string, string | undefined>) {
    return this.reports.report(user, query);
  }

  @UseGuards(AuthGuard)
  @Get('reports/export.csv')
  async exportCsv(@SessionUser() user: User, @Query() query: Record<string, string | undefined>, @Res() res: Response) {
    const csv = await this.reports.csv(user, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="pennywise.csv"');
    res.send(csv);
  }

  @UseGuards(AuthGuard)
  @Get('reports/export.xlsx')
  async exportXlsx(@SessionUser() user: User, @Query() query: Record<string, string | undefined>, @Res() res: Response) {
    const xlsx = await this.reports.xlsx(user, query);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="pennywise.xlsx"');
    res.send(xlsx);
  }

  @UseGuards(AuthGuard)
  @Get('reports/export.pdf')
  async exportPdf(@SessionUser() user: User, @Query() query: Record<string, string | undefined>, @Res() res: Response) {
    const pdf = await this.reports.pdf(user, query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="pennywise.pdf"');
    res.send(pdf);
  }

  @UseGuards(AuthGuard)
  @Post('reports/import/preview')
  previewImport(@Body() body: Record<string, unknown>) {
    return this.reports.previewImport(String(body.csv ?? ''));
  }

  @UseGuards(AuthGuard)
  @Post('reports/import')
  importCsv(@SessionUser() user: User, @Body() body: Record<string, unknown>) {
    return this.reports.importCsv(user, body);
  }

  @UseGuards(AuthGuard)
  @Get('budgets')
  async listBudgets(@SessionUser() user: User, @Query('month') month: string, @Query('ownerId') ownerId?: string) {
    return this.plans.listBudgets(await this.approval.ownerFor(user, ownerId), month);
  }

  @UseGuards(AuthGuard)
  @Post('budgets')
  saveBudget(@SessionUser() user: User, @Body() body: Record<string, unknown>, @Query('ownerId') ownerId?: string) {
    return this.approval.gate(user, ownerId, { entity: 'budget', entityId: String(body.categoryId ?? 'budget'), action: 'update', payload: body, summary: `Edit budget ${textOf(body.amount)}` }, (owner) => this.plans.saveBudget(owner, body));
  }

  @UseGuards(AuthGuard)
  @Delete('budgets/:id')
  deleteBudget(@SessionUser() user: User, @Param('id') id: string, @Query('ownerId') ownerId?: string) {
    return this.approval.gate(user, ownerId, { entity: 'budget', entityId: id, action: 'delete', payload: {}, summary: 'Delete budget' }, (owner) => this.plans.deleteBudget(owner, id));
  }

  @UseGuards(AuthGuard)
  @Get('goals')
  async listGoals(@SessionUser() user: User, @Query('ownerId') ownerId?: string) {
    return this.plans.listGoals(await this.approval.ownerFor(user, ownerId));
  }

  @UseGuards(AuthGuard)
  @Post('goals')
  createGoal(@SessionUser() user: User, @Body() body: Record<string, unknown>) {
    return this.plans.saveGoal(user.id, body);
  }

  @UseGuards(AuthGuard)
  @Patch('goals/:id')
  updateGoal(@SessionUser() user: User, @Param('id') id: string, @Body() body: Record<string, unknown>, @Query('ownerId') ownerId?: string) {
    return this.approval.gate(user, ownerId, { entity: 'goal', entityId: id, action: 'update', payload: body, summary: `Edit goal ${textOf(body.name)}` }, (owner) => this.plans.saveGoal(owner, body, id));
  }

  @UseGuards(AuthGuard)
  @Delete('goals/:id')
  deleteGoal(@SessionUser() user: User, @Param('id') id: string, @Query('ownerId') ownerId?: string) {
    return this.approval.gate(user, ownerId, { entity: 'goal', entityId: id, action: 'delete', payload: {}, summary: 'Delete goal' }, (owner) => this.plans.deleteGoal(owner, id));
  }

  @UseGuards(AuthGuard)
  @Get('recurring')
  async listRecurring(@SessionUser() user: User, @Query('ownerId') ownerId?: string) {
    return this.plans.listRecurring(await this.approval.ownerFor(user, ownerId));
  }

  @UseGuards(AuthGuard)
  @Post('recurring')
  createRecurring(@SessionUser() user: User, @Body() body: Record<string, unknown>) {
    return this.plans.saveRecurring(user.id, body);
  }

  @UseGuards(AuthGuard)
  @Patch('recurring/:id')
  updateRecurring(@SessionUser() user: User, @Param('id') id: string, @Body() body: Record<string, unknown>, @Query('ownerId') ownerId?: string) {
    return this.approval.gate(user, ownerId, { entity: 'recurring', entityId: id, action: 'update', payload: body, summary: `Edit recurring ${textOf(body.amount)}` }, (owner) => this.plans.saveRecurring(owner, body, id));
  }

  @UseGuards(AuthGuard)
  @Delete('recurring/:id')
  deleteRecurring(@SessionUser() user: User, @Param('id') id: string, @Query('ownerId') ownerId?: string) {
    return this.approval.gate(user, ownerId, { entity: 'recurring', entityId: id, action: 'delete', payload: {}, summary: 'Delete recurring' }, (owner) => this.plans.deleteRecurring(owner, id));
  }

  @Post('cron/recurring')
  cronRecurring(@Headers('x-cron-secret') secret?: string) {
    const expected = process.env.CRON_SECRET;
    if (!expected || secret !== expected) fail('Not allowed');
    return this.plans.runDue();
  }

  private async sessionUser(req: Request): Promise<User> {
    const raw = req.cookies?.pw_session;
    if (!raw || typeof raw !== 'string') throw new UnauthorizedException({ message: 'Sign in required' });
    const session = await this.prisma.session.findUnique({ where: { id: sha256(raw) }, include: { user: true } });
    if (!session || session.expiresAt.getTime() < Date.now() || !session.user.isActive) {
      throw new UnauthorizedException({ message: 'Sign in required' });
    }
    return session.user;
  }
}

function textOf(value: unknown) {
  return String(value ?? '').trim().slice(0, 40);
}
