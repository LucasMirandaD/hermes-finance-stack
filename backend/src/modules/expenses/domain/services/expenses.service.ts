import { Injectable, Logger, Optional } from '@nestjs/common';
import { IExpensesService } from './i-expenses.service';
import { IExpensesRepository } from '../../data/repositories/i-expenses.repository';
import { Result } from '../../../../common/errors/result.mapper';
import {
  CouldNotSave,
  InvalidOperation,
  NotFound,
} from '../../../../common/errors/errors';
import {
  CreateExpenseDto,
  ExpenseAllocationInputDto,
} from '../../presentation/dtos/create-expense.dto';
import { CreateCreditCardDto } from '../../presentation/dtos/create-credit-card.dto';
import { ExpenseEntity } from '../../data/entities/expense.entity';
import { CreditCardEntity } from '../../data/entities/credit-card.entity';
import { ExpenseInstallmentEntity } from '../../data/entities/expense-installment.entity';
import { MemberEntity } from '../../data/entities/member.entity';
import { ExpenseAllocationEntity } from '../../data/entities/expense-allocation.entity';
import { CategoryBudgetEntity } from '../../data/entities/category-budget.entity';
import { RecurringExpenseEntity } from '../../data/entities/recurring-expense.entity';
import { InstallmentPlanGenerator } from './installment-plan-generator';
import {
  HolderInstallmentGroupDto,
  InstallmentItemDto,
  MonthlyInstallmentsSummaryDto,
} from '../../presentation/dtos/installment-summary.dto';
import {
  BankBreakdownDto,
  BudgetAlertItemDto,
  CategoryBreakdownDto,
  FinancialSummaryQueryDto,
  FinancialSummaryResponseDto,
  HolderBreakdownDto,
  TopExpenseSummaryItemDto,
  UpcomingDueDto,
} from '../../presentation/dtos/financial-summary.dto';
import {
  SearchExpenseItemDto,
  SearchExpensesQueryDto,
  SearchExpensesResponseDto,
} from '../../presentation/dtos/search-expenses.dto';
import {
  UpdateExpenseDto,
  UpdateInstallmentDto,
} from '../../presentation/dtos/update-expense.dto';
import {
  CreateMemberDto,
  MemberBalanceItemDto,
  SettlementSuggestionDto,
  SharedBalanceResponseDto,
  UpdateMemberDto,
} from '../../presentation/dtos/member.dto';
import {
  BudgetStatusItemDto,
  BudgetStatusResponseDto,
  SetCategoryBudgetDto,
} from '../../presentation/dtos/budget.dto';
import {
  CreateRecurringExpenseDto,
  FixedExpensesStatusResponseDto,
  FixedExpenseStatusItemDto,
  PayRecurringExpenseDto,
  UpdateRecurringExpenseDto,
} from '../../presentation/dtos/recurring-expense.dto';
import {
  CompareMonthsResponseDto,
  ExportExpensesQueryInput,
  HealthCheckResponseDto,
  MonthCategoryDeltaDto,
  RenderChartQueryInput,
  TopExpenseItemDto,
  TopExpensesResponseDto,
} from '../../presentation/dtos/analytics.dto';
import { ExpenseMapper } from '../../presentation/mappers/expense.mapper';
import { PaperlessService } from '../../infrastructure/paperless.service';
import { ChartService, RenderChartResult } from '../../infrastructure/chart.service';
import {
  ExportExpenseRow,
  ExportResult,
  ExportService,
} from '../../infrastructure/export.service';
import { ExpenseScope } from '../interfaces/expense.interface';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface PeriodBounds {
  startDate: string;
  endDate: string;
  periodLabel: string;
  prevStartDate: string;
  prevEndDate: string;
  monthKey: string;
}

@Injectable()
export class ExpensesService implements IExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private readonly expensesRepo: IExpensesRepository,
    @Optional() private readonly paperlessService?: PaperlessService,
    @Optional() private readonly chartService?: ChartService,
    @Optional() private readonly exportService?: ExportService,
  ) {}

  async healthCheck(): Promise<Result<HealthCheckResponseDto>> {
    try {
      const [dbStats, paperless] = await Promise.all([
        this.expensesRepo.checkDatabaseHealth(),
        this.paperlessService
          ? this.paperlessService.checkHealth()
          : Promise.resolve({ enabled: false, status: 'disabled' as const }),
      ]);

      return Result.ok({
        status: dbStats.connected ? 'ok' : 'degraded',
        service: 'nest-expenses-mcp',
        timestamp: new Date().toISOString(),
        database: dbStats,
        optionalServices: {
          paperless,
        },
      });
    } catch (error: any) {
      this.logger.error(`Health check failed: ${error.message}`);
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  private resolvePeriodBounds(query: {
    month?: string;
    startDate?: string;
    endDate?: string;
  }): PeriodBounds {
    if (query.month && /^\d{4}-\d{2}$/.test(query.month)) {
      const [y, m] = query.month.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const startDate = `${query.month}-01`;
      const endDate = `${query.month}-${String(lastDay).padStart(2, '0')}`;

      const prevMonthDate = new Date(y, m - 2, 1);
      const prevY = prevMonthDate.getFullYear();
      const prevM = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
      const prevLastDay = new Date(prevY, prevMonthDate.getMonth() + 1, 0).getDate();

      return {
        startDate,
        endDate,
        periodLabel: `Mes ${query.month}`,
        prevStartDate: `${prevY}-${prevM}-01`,
        prevEndDate: `${prevY}-${prevM}-${String(prevLastDay).padStart(2, '0')}`,
        monthKey: query.month,
      };
    }

    if (query.startDate && query.endDate) {
      const startMs = new Date(query.startDate).getTime();
      const endMs = new Date(query.endDate).getTime();
      const durationMs = Math.max(0, endMs - startMs);
      const prevEndMs = startMs - 24 * 60 * 60 * 1000;
      const prevStartMs = prevEndMs - durationMs;

      return {
        startDate: query.startDate,
        endDate: query.endDate,
        periodLabel: `Del ${query.startDate} al ${query.endDate}`,
        prevStartDate: new Date(prevStartMs).toISOString().slice(0, 10),
        prevEndDate: new Date(prevEndMs).toISOString().slice(0, 10),
        monthKey: query.startDate.slice(0, 7),
      };
    }

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    const monthKey = `${y}-${m}`;

    const prevMonthDate = new Date(y, now.getMonth() - 1, 1);
    const prevY = prevMonthDate.getFullYear();
    const prevM = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
    const prevLastDay = new Date(prevY, prevMonthDate.getMonth() + 1, 0).getDate();

    return {
      startDate: `${monthKey}-01`,
      endDate: `${monthKey}-${String(lastDay).padStart(2, '0')}`,
      periodLabel: `Mes actual (${monthKey})`,
      prevStartDate: `${prevY}-${prevM}-01`,
      prevEndDate: `${prevY}-${prevM}-${String(prevLastDay).padStart(2, '0')}`,
      monthKey,
    };
  }

  private getHolderLabel(expense?: Partial<ExpenseEntity>): string {
    if (!expense) return 'Sin titular';
    if (expense.creditCard?.isExtension && expense.creditCard?.holderName) {
      return expense.creditCard.holderName;
    }
    if (expense.paidByMember?.displayName) return expense.paidByMember.displayName;
    if (expense.creditCard?.holderName) return expense.creditCard.holderName;
    return 'Sin titular';
  }

  private matchesScopeAndMember(
    expense: ExpenseEntity | undefined,
    scope?: 'ALL' | ExpenseScope,
    targetMember?: MemberEntity | null,
    isFixedFilter?: boolean,
  ): boolean {
    if (!expense) return false;
    const expScope: ExpenseScope = expense.scope || 'PERSONAL';

    if (scope && scope !== 'ALL' && expScope !== scope) {
      return false;
    }

    if (isFixedFilter !== undefined && Boolean(expense.isFixed) !== isFixedFilter) {
      return false;
    }

    if (targetMember) {
      const matchesPayer = expense.paidByMemberId === targetMember.id;
      const matchesAlloc = (expense.allocations || []).some(
        (a) => a.memberId === targetMember.id,
      );
      const cardHolder = expense.creditCard?.holderName?.trim().toLowerCase();
      const memberTokens = [
        targetMember.slug,
        targetMember.displayName,
        ...(targetMember.aliases || []),
      ].map((t) => String(t).trim().toLowerCase());
      const matchesCard = Boolean(cardHolder && memberTokens.includes(cardHolder));

      if (!matchesPayer && !matchesAlloc && !matchesCard) {
        return false;
      }
    }

    return true;
  }

  private async resolveAllocationsEntities(
    totalAmount: number,
    scope: ExpenseScope,
    inputs?: ExpenseAllocationInputDto[],
  ): Promise<Result<ExpenseAllocationEntity[]>> {
    const resolvedItems: Array<{ member: MemberEntity; percentage: number }> = [];

    if (inputs && inputs.length > 0) {
      const sumPct = inputs.reduce((s, a) => s + Number(a.percentage), 0);
      if (Math.abs(sumPct - 100) > 0.05) {
        return Result.fail(
          new InvalidOperation(
            `Los porcentajes de allocations deben sumar 100% (actual: ${round2(sumPct)}%).`,
          ),
        );
      }

      for (const item of inputs) {
        const member = await this.expensesRepo.findMemberByRef(item.member);
        if (!member) {
          return Result.fail(new NotFound(`Member '${item.member}'`));
        }
        resolvedItems.push({ member, percentage: round2(Number(item.percentage)) });
      }
    } else if (scope === 'SHARED') {
      const members = (await this.expensesRepo.findMembers?.(true)) || [];
      if (members.length >= 2) {
        const count = members.length;
        const basePct = round2(100 / count);
        let pctAcc = 0;
        members.forEach((member, idx) => {
          const pct = idx === count - 1 ? round2(100 - pctAcc) : basePct;
          pctAcc += pct;
          resolvedItems.push({ member, percentage: pct });
        });
      }
    }

    if (resolvedItems.length === 0) {
      return Result.ok([]);
    }

    const entities: ExpenseAllocationEntity[] = [];
    let amountAcc = 0;
    resolvedItems.forEach((item, idx) => {
      const isLast = idx === resolvedItems.length - 1;
      const amt = isLast
        ? round2(totalAmount - amountAcc)
        : round2((totalAmount * item.percentage) / 100);
      amountAcc += amt;

      const entity = new ExpenseAllocationEntity();
      entity.memberId = item.member.id;
      entity.member = item.member;
      entity.percentage = item.percentage;
      entity.amount = amt;
      entities.push(entity);
    });

    return Result.ok(entities);
  }

  async registerExpense(dto: CreateExpenseDto): Promise<Result<ExpenseEntity>> {
    try {
      let matchedCard: CreditCardEntity | null = null;

      if (dto.paymentMethod !== 'BANK_TRANSFER') {
        if (dto.creditCardId) {
          matchedCard = await this.expensesRepo.findCreditCardById(dto.creditCardId);
          if (!matchedCard) {
            return Result.fail(new NotFound(`CreditCard with id ${dto.creditCardId}`));
          }
        } else if (dto.cardBank && dto.cardName) {
          matchedCard = await this.expensesRepo.findCreditCardByDetails(
            dto.cardBank,
            dto.cardName,
            dto.cardHolder,
          );
        }
      }

      let paidByMember: MemberEntity | null = null;
      if (dto.paidBy) {
        paidByMember = (await this.expensesRepo.findMemberByRef?.(dto.paidBy)) || null;
        if (!paidByMember) {
          return Result.fail(new NotFound(`Member '${dto.paidBy}'`));
        }
      }

      const scope: ExpenseScope =
        dto.scope || (dto.allocations && dto.allocations.length > 1 ? 'SHARED' : 'PERSONAL');

      const allocationsRes = await this.resolveAllocationsEntities(
        dto.totalAmount,
        scope,
        dto.allocations,
      );
      if (allocationsRes.isFailure) {
        return Result.fail(allocationsRes.getError());
      }

      const totalInstallments =
        dto.totalInstallments && dto.totalInstallments > 1 ? dto.totalInstallments : 1;
      const isInstallment = dto.isInstallment || totalInstallments > 1;
      const intervalMonths = dto.intervalMonths && dto.intervalMonths > 0 ? dto.intervalMonths : 1;

      const installmentsPlan: ExpenseInstallmentEntity[] = [];
      if (isInstallment) {
        const firstDueDate =
          dto.firstDueDate || this.calculateFirstDueDate(dto.expenseDate, matchedCard?.dueDay);
        const generated = InstallmentPlanGenerator.generate(
          dto.totalAmount,
          totalInstallments,
          firstDueDate,
          intervalMonths,
        );

        for (const item of generated) {
          const installment = new ExpenseInstallmentEntity();
          installment.installmentNumber = item.installmentNumber;
          installment.totalInstallments = item.totalInstallments;
          installment.amount = item.amount;
          installment.dueDate = item.dueDate;
          installment.status = 'PENDING';
          installmentsPlan.push(installment);
        }
      }

      const expense = new ExpenseEntity();
      expense.description = dto.description;
      expense.merchantName = dto.merchantName;
      expense.totalAmount = dto.totalAmount;
      expense.currency = (dto.currency || 'ARS').toUpperCase();
      expense.expenseDate = dto.expenseDate;
      expense.paymentMethod = dto.paymentMethod || (matchedCard ? 'CREDIT_CARD' : 'CASH');
      expense.bankName =
        dto.bankName || (dto.paymentMethod === 'BANK_TRANSFER' ? dto.cardBank : undefined);
      expense.creditCardId = matchedCard?.id;
      expense.creditCard = matchedCard || undefined;
      expense.scope = scope;
      expense.isFixed = Boolean(dto.isFixed || dto.recurringExpenseId);
      expense.paidByMemberId = paidByMember?.id;
      expense.paidByMember = paidByMember || undefined;
      expense.recurringExpenseId = dto.recurringExpenseId;
      expense.allocations = allocationsRes.getValue();
      expense.isInstallment = isInstallment;
      expense.totalInstallments = totalInstallments;
      expense.intervalMonths = intervalMonths;
      expense.category = (dto.category || 'GENERAL').toUpperCase();
      expense.source = dto.source || 'MANUAL';
      expense.rawSourceText = dto.rawSourceText;
      expense.paperlessDocumentId = dto.paperlessDocumentId;
      expense.metadata = dto.metadata;
      expense.installmentsPlan = installmentsPlan;

      const saved = await this.expensesRepo.saveExpense(expense);
      this.logger.log(
        `Registered expense ${saved.id} - Total: ${saved.totalAmount} ${saved.currency} [${saved.scope}]`,
      );
      return Result.ok(saved);
    } catch (error: any) {
      this.logger.error(`Failed to register expense: ${error.message}`, error.stack);
      return Result.fail(new CouldNotSave('Expense', error.message));
    }
  }

  async getExpenseById(id: string): Promise<Result<ExpenseEntity>> {
    try {
      const expense = await this.expensesRepo.findExpenseById(id);
      if (!expense) {
        return Result.fail(new NotFound(`Expense with id ${id}`));
      }
      return Result.ok(expense);
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async listExpenses(limit = 50, offset = 0): Promise<Result<ExpenseEntity[]>> {
    try {
      const expenses = await this.expensesRepo.findExpenses(limit, offset);
      return Result.ok(expenses);
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async registerCreditCard(dto: CreateCreditCardDto): Promise<Result<CreditCardEntity>> {
    try {
      const cardEntity = ExpenseMapper.toCardEntity(dto);
      const saved = await this.expensesRepo.saveCreditCard(cardEntity);
      return Result.ok(saved);
    } catch (error: any) {
      return Result.fail(new CouldNotSave('CreditCard', error.message));
    }
  }

  async listCreditCards(): Promise<Result<CreditCardEntity[]>> {
    try {
      const cards = await this.expensesRepo.findCreditCards();
      return Result.ok(cards);
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async getMonthlyInstallmentsSummary(
    yearMonth: string,
  ): Promise<Result<MonthlyInstallmentsSummaryDto>> {
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      return Result.fail(new InvalidOperation('yearMonth must be in YYYY-MM format'));
    }

    try {
      const [yearStr, monthStr] = yearMonth.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const lastDay = new Date(year, month, 0).getDate();

      const startDate = `${yearMonth}-01`;
      const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

      const installments = await this.expensesRepo.findInstallmentsByDueDateRange(
        startDate,
        endDate,
      );

      const items: InstallmentItemDto[] = installments.map((inst) => ({
        installmentId: inst.id,
        expenseId: inst.expenseId,
        merchantName: inst.expense?.merchantName || 'Desconocido',
        description: inst.expense?.description || '',
        installmentNumber: inst.installmentNumber,
        totalInstallments: inst.totalInstallments,
        isLastInstallment: inst.installmentNumber === inst.totalInstallments,
        amount: Number(inst.amount),
        dueDate: inst.dueDate,
        status: inst.status,
        scope: inst.expense?.scope || 'PERSONAL',
        isFixed: Boolean(inst.expense?.isFixed),
        cardBank: inst.expense?.creditCard?.bank,
        cardName: inst.expense?.creditCard?.cardName,
        isExtension: inst.expense?.creditCard?.isExtension,
        holderName: this.getHolderLabel(inst.expense),
      }));

      const groupMap = new Map<string, InstallmentItemDto[]>();
      for (const item of items) {
        const key = item.holderName || 'Sin titular';
        const list = groupMap.get(key) || [];
        list.push(item);
        groupMap.set(key, list);
      }

      const byHolder: HolderInstallmentGroupDto[] = Array.from(groupMap.entries())
        .map(([holderName, groupItems]) => {
          const sortedItems = [...groupItems].sort((a, b) => b.amount - a.amount);
          const subtotal = round2(sortedItems.reduce((s, i) => s + i.amount, 0));
          return {
            holderName,
            subtotal,
            count: sortedItems.length,
            items: sortedItems,
          };
        })
        .sort((a, b) => {
          if (a.holderName === 'Sin titular') return 1;
          if (b.holderName === 'Sin titular') return -1;
          return b.subtotal - a.subtotal;
        });

      const totalAmountDue = round2(items.reduce((sum, item) => sum + item.amount, 0));

      return Result.ok({
        month: yearMonth,
        totalAmountDue,
        installmentsCount: items.length,
        byHolder,
        items,
      });
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async searchPendingInstallments(
    query?: string,
    dueDate?: string,
  ): Promise<Result<ExpenseInstallmentEntity[]>> {
    try {
      const items = await this.expensesRepo.searchPendingInstallments(query, dueDate);
      return Result.ok(items);
    } catch (error: any) {
      this.logger.error(`Error searching pending installments: ${error.message}`);
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async payInstallment(
    id: string,
    paymentMethod: string = 'BANK_TRANSFER',
    bankName?: string,
    notes?: string,
  ): Promise<Result<ExpenseInstallmentEntity>> {
    try {
      const installment = await this.expensesRepo.findInstallmentById(id);
      if (!installment) {
        return Result.fail(new NotFound(`Installment with id ${id}`));
      }

      installment.status = 'PAID';
      installment.paidAt = new Date();
      const paymentInfo = [paymentMethod, bankName].filter(Boolean).join(' - ');
      installment.notes = notes || (paymentInfo ? `Pagado vía ${paymentInfo}` : 'Pagado');

      const saved = await this.expensesRepo.saveInstallment(installment);
      this.logger.log(`Installment ${id} marked as PAID via ${paymentInfo}`);
      return Result.ok(saved);
    } catch (error: any) {
      this.logger.error(`Error paying installment: ${error.message}`);
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  private calculateFirstDueDate(expenseDate: string, dueDay?: number): string {
    const [yearStr, monthStr, dayStr] = expenseDate.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);

    const targetDueDay = dueDay && dueDay >= 1 && dueDay <= 31 ? dueDay : day;
    const nextMonthIndex = month + 1;
    const nextYear = year + Math.floor(nextMonthIndex / 12);
    const nextMonth = nextMonthIndex % 12;

    const daysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
    const actualDay = Math.min(targetDueDay, daysInNextMonth);

    return new Date(Date.UTC(nextYear, nextMonth, actualDay)).toISOString().slice(0, 10);
  }

  async getFinancialSummary(
    query: FinancialSummaryQueryDto,
  ): Promise<Result<FinancialSummaryResponseDto>> {
    try {
      const bounds = this.resolvePeriodBounds(query);
      let targetMember: MemberEntity | null = null;
      if (query.memberRef) {
        targetMember = (await this.expensesRepo.findMemberByRef?.(query.memberRef)) || null;
        if (!targetMember) {
          return Result.fail(new NotFound(`Member '${query.memberRef}'`));
        }
      }

      const [
        rawDirectExpenses,
        rawPaidInstallments,
        rawPendingInstallments,
        rawPrevDirect,
        rawPrevPaidInst,
        upcomingItems,
        activeBudgets,
      ] = await Promise.all([
        this.expensesRepo.findExpensesByDateRange(bounds.startDate, bounds.endDate, false),
        this.expensesRepo.findPaidInstallmentsByDateRange(bounds.startDate, bounds.endDate),
        this.expensesRepo.findPendingInstallmentsByDueDateRange(bounds.startDate, bounds.endDate),
        this.expensesRepo.findExpensesByDateRange(bounds.prevStartDate, bounds.prevEndDate, false),
        this.expensesRepo.findPaidInstallmentsByDateRange(bounds.prevStartDate, bounds.prevEndDate),
        this.expensesRepo.findUpcomingPendingInstallments(15),
        this.expensesRepo.findBudgets ? this.expensesRepo.findBudgets(true) : Promise.resolve([]),
      ]);

      const filterExp = (e: ExpenseEntity) =>
        this.matchesScopeAndMember(e, query.scope, targetMember, query.isFixed);
      const filterInst = (i: ExpenseInstallmentEntity) =>
        this.matchesScopeAndMember(i.expense, query.scope, targetMember, query.isFixed);

      const directExpenses = rawDirectExpenses.filter(filterExp);
      const paidInstallments = rawPaidInstallments.filter(filterInst);
      const pendingInstallments = rawPendingInstallments.filter(filterInst);
      const prevDirect = rawPrevDirect.filter(filterExp);
      const prevPaidInst = rawPrevPaidInst.filter(filterInst);

      const directPaid = directExpenses.reduce((sum, e) => sum + Number(e.totalAmount), 0);
      const installmentsPaid = paidInstallments.reduce((sum, i) => sum + Number(i.amount), 0);
      const totalPaid = round2(directPaid + installmentsPaid);
      const paidTransactionsCount = directExpenses.length + paidInstallments.length;

      const totalPending = round2(
        pendingInstallments.reduce((sum, i) => sum + Number(i.amount), 0),
      );
      const pendingTransactionsCount = pendingInstallments.length;

      const categoryMap = new Map<string, number>();
      const bankMap = new Map<string, number>();
      const holderMap = new Map<string, { paid: number; pending: number }>();
      let fixedPaid = 0;
      let variablePaid = 0;
      const paidItemsForTop: TopExpenseSummaryItemDto[] = [];

      const addHolderAmount = (holder: string, type: 'paid' | 'pending', amt: number) => {
        const entry = holderMap.get(holder) || { paid: 0, pending: 0 };
        entry[type] += amt;
        holderMap.set(holder, entry);
      };

      for (const e of directExpenses) {
        const amt = Number(e.totalAmount);
        const cat = (e.category || 'VARIOS').toUpperCase();
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + amt);

        const bank =
          e.creditCard?.bank ||
          e.bankName ||
          (e.paymentMethod === 'BANK_TRANSFER' ? 'Transferencia' : e.paymentMethod || 'Otros');
        bankMap.set(bank, (bankMap.get(bank) || 0) + amt);

        const holder = this.getHolderLabel(e);
        addHolderAmount(holder, 'paid', amt);

        if (e.isFixed) {
          fixedPaid += amt;
        } else {
          variablePaid += amt;
        }

        paidItemsForTop.push({
          id: e.id,
          date: e.expenseDate,
          merchantName: e.merchantName,
          description: e.description,
          amount: amt,
          category: cat,
          scope: e.scope || 'PERSONAL',
          isFixed: Boolean(e.isFixed),
          holderName: holder,
        });
      }

      for (const i of paidInstallments) {
        const amt = Number(i.amount);
        const cat = (i.expense?.category || 'VARIOS').toUpperCase();
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + amt);

        let bank = i.expense?.creditCard?.bank;
        if (!bank && i.notes) {
          const match = i.notes.match(/\((.*?)\)/);
          if (match) bank = match[1];
        }
        bank = bank || i.expense?.bankName || 'Transferencia / Tarjeta';
        bankMap.set(bank, (bankMap.get(bank) || 0) + amt);

        const holder = this.getHolderLabel(i.expense);
        addHolderAmount(holder, 'paid', amt);

        if (i.expense?.isFixed) {
          fixedPaid += amt;
        } else {
          variablePaid += amt;
        }

        paidItemsForTop.push({
          id: i.id,
          date: i.paidAt ? new Date(i.paidAt).toISOString().slice(0, 10) : i.dueDate,
          merchantName: i.expense?.merchantName || 'Desconocido',
          description: `${i.expense?.description || ''} (${i.installmentNumber}/${i.totalInstallments})`.trim(),
          amount: amt,
          category: cat,
          scope: i.expense?.scope || 'PERSONAL',
          isFixed: Boolean(i.expense?.isFixed),
          holderName: holder,
        });
      }

      for (const i of pendingInstallments) {
        const holder = this.getHolderLabel(i.expense);
        addHolderAmount(holder, 'pending', Number(i.amount));
      }

      const totalDisbursed = totalPaid > 0 ? totalPaid : totalPending > 0 ? totalPending : 1;

      const byCategory: CategoryBreakdownDto[] = Array.from(categoryMap.entries())
        .map(([category, amount]) => ({
          category,
          amount: round2(amount),
          percentage: Math.round((amount / totalDisbursed) * 1000) / 10,
        }))
        .sort((a, b) => b.amount - a.amount);

      const byBank: BankBreakdownDto[] = Array.from(bankMap.entries())
        .map(([bank, amount]) => ({
          bank,
          amount: round2(amount),
          percentage: Math.round((amount / totalDisbursed) * 1000) / 10,
        }))
        .sort((a, b) => b.amount - a.amount);

      const totalPaidAndPending = Math.max(1, totalPaid + totalPending);
      const byHolder: HolderBreakdownDto[] = Array.from(holderMap.entries())
        .map(([holderName, vals]) => {
          const totalAmount = round2(vals.paid + vals.pending);
          return {
            holderName,
            paidAmount: round2(vals.paid),
            pendingAmount: round2(vals.pending),
            totalAmount,
            percentage: Math.round((totalAmount / totalPaidAndPending) * 1000) / 10,
          };
        })
        .sort((a, b) => b.totalAmount - a.totalAmount);

      fixedPaid = round2(fixedPaid);
      variablePaid = round2(variablePaid);
      const fixedDenom = fixedPaid + variablePaid > 0 ? fixedPaid + variablePaid : 1;
      const fixedVsVariable = {
        fixedPaid,
        variablePaid,
        fixedPercentage: Math.round((fixedPaid / fixedDenom) * 1000) / 10,
        variablePercentage: Math.round((variablePaid / fixedDenom) * 1000) / 10,
      };

      const topExpenses = paidItemsForTop
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      const budgetAlerts: BudgetAlertItemDto[] = [];
      for (const b of activeBudgets || []) {
        const spent = categoryMap.get(b.category.toUpperCase()) || 0;
        const monthlyBudget = Number(b.monthlyAmount);
        if (monthlyBudget <= 0) continue;
        const percentageUsed = Math.round((spent / monthlyBudget) * 1000) / 10;
        if (percentageUsed >= b.alertThresholdPct) {
          budgetAlerts.push({
            category: b.category,
            monthlyBudget,
            spent: round2(spent),
            percentageUsed,
            alertThresholdPct: b.alertThresholdPct,
            exceeded: spent > monthlyBudget,
          });
        }
      }
      budgetAlerts.sort((a, b) => b.percentageUsed - a.percentageUsed);

      const prevTotalPaid = round2(
        prevDirect.reduce((s, e) => s + Number(e.totalAmount), 0) +
          prevPaidInst.reduce((s, i) => s + Number(i.amount), 0),
      );

      const diffAmount = round2(totalPaid - prevTotalPaid);
      const diffPercentage =
        prevTotalPaid > 0 ? Math.round(((totalPaid - prevTotalPaid) / prevTotalPaid) * 1000) / 10 : 0;
      const trend = diffAmount > 0 ? 'UP' : diffAmount < 0 ? 'DOWN' : 'EQUAL';

      const upcomingDue: UpcomingDueDto[] = upcomingItems
        .filter(filterInst)
        .map((inst) => ({
          id: inst.id,
          expenseId: inst.expenseId,
          merchantName: inst.expense?.merchantName || 'Desconocido',
          description: inst.expense?.description || '',
          installmentNumber: inst.installmentNumber,
          totalInstallments: inst.totalInstallments,
          amount: Number(inst.amount),
          dueDate: inst.dueDate,
          bank: inst.expense?.creditCard?.bank || inst.expense?.bankName,
          holderName: this.getHolderLabel(inst.expense),
        }));

      return Result.ok({
        startDate: bounds.startDate,
        endDate: bounds.endDate,
        periodLabel: bounds.periodLabel,
        totalPaid,
        paidTransactionsCount,
        totalPending,
        pendingTransactionsCount,
        byCategory,
        byBank,
        byHolder,
        fixedVsVariable,
        topExpenses,
        budgetAlerts,
        comparison: {
          previousStartDate: bounds.prevStartDate,
          previousEndDate: bounds.prevEndDate,
          previousTotalPaid: prevTotalPaid,
          diffAmount,
          diffPercentage,
          trend,
        },
        upcomingDue,
      });
    } catch (error: any) {
      this.logger.error(`Error calculating financial summary: ${error.message}`, error.stack);
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async searchExpenses(
    query: SearchExpensesQueryDto,
  ): Promise<Result<SearchExpensesResponseDto>> {
    try {
      const { expenses, installments } = await this.expensesRepo.searchExpensesAndInstallments(
        query.q,
        query.category,
        query.startDate,
        query.endDate,
      );

      const items: SearchExpenseItemDto[] = [];

      for (const exp of expenses) {
        items.push({
          id: exp.id,
          type: 'EXPENSE',
          date: exp.expenseDate,
          merchantName: exp.merchantName,
          description: exp.description,
          amount: Number(exp.totalAmount),
          currency: exp.currency || 'ARS',
          category: exp.category,
          paymentMethod: exp.paymentMethod,
          bank: exp.creditCard?.bank || exp.bankName,
          status: 'PAID',
        });
      }

      for (const inst of installments) {
        items.push({
          id: inst.id,
          type: 'INSTALLMENT',
          date: inst.paidAt ? new Date(inst.paidAt).toISOString().slice(0, 10) : inst.dueDate,
          merchantName: inst.expense?.merchantName || 'Desconocido',
          description: inst.expense?.description || '',
          amount: Number(inst.amount),
          currency: inst.expense?.currency || 'ARS',
          category: inst.expense?.category || 'VARIOS',
          paymentMethod: inst.expense?.paymentMethod || 'CREDIT_CARD',
          bank: inst.expense?.creditCard?.bank || inst.expense?.bankName,
          status: inst.status,
          installmentInfo: `Cuota ${inst.installmentNumber}/${inst.totalInstallments}`,
        });
      }

      items.sort((a, b) => b.date.localeCompare(a.date));
      const totalAmount = round2(items.reduce((sum, item) => sum + item.amount, 0));

      return Result.ok({
        query: query.q,
        category: query.category,
        totalMatches: items.length,
        totalAmount,
        items,
      });
    } catch (error: any) {
      this.logger.error(`Error searching expenses: ${error.message}`);
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async getUpcomingInstallments(days = 30): Promise<Result<UpcomingDueDto[]>> {
    try {
      const upcoming = await this.expensesRepo.findUpcomingPendingInstallments(days);
      const items: UpcomingDueDto[] = upcoming.map((inst) => ({
        id: inst.id,
        expenseId: inst.expenseId,
        merchantName: inst.expense?.merchantName || 'Desconocido',
        description: inst.expense?.description || '',
        installmentNumber: inst.installmentNumber,
        totalInstallments: inst.totalInstallments,
        amount: Number(inst.amount),
        dueDate: inst.dueDate,
        bank: inst.expense?.creditCard?.bank || inst.expense?.bankName,
        holderName: this.getHolderLabel(inst.expense),
      }));
      return Result.ok(items);
    } catch (error: any) {
      this.logger.error(`Error getting upcoming installments: ${error.message}`);
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async updateExpense(id: string, dto: UpdateExpenseDto): Promise<Result<ExpenseEntity>> {
    try {
      const expense = await this.expensesRepo.findExpenseById(id);
      if (!expense) {
        return Result.fail(new NotFound(`Expense with id ${id}`));
      }

      if (dto.description !== undefined) expense.description = dto.description;
      if (dto.merchantName !== undefined) expense.merchantName = dto.merchantName;
      if (dto.category !== undefined) expense.category = dto.category.toUpperCase();
      if (dto.paymentMethod !== undefined) expense.paymentMethod = dto.paymentMethod;
      if (dto.bankName !== undefined) expense.bankName = dto.bankName;
      if (dto.scope !== undefined) expense.scope = dto.scope;
      if (dto.isFixed !== undefined) expense.isFixed = dto.isFixed;

      if (dto.paidBy !== undefined) {
        const member = await this.expensesRepo.findMemberByRef?.(dto.paidBy);
        if (!member) {
          return Result.fail(new NotFound(`Member '${dto.paidBy}'`));
        }
        expense.paidByMemberId = member.id;
        expense.paidByMember = member;
      }

      if (dto.totalAmount !== undefined) {
        const newTotal = round2(Number(dto.totalAmount));
        if (expense.isInstallment && expense.installmentsPlan?.length > 0) {
          const paidSum = expense.installmentsPlan
            .filter((i) => i.status === 'PAID')
            .reduce((sum, i) => sum + Number(i.amount), 0);
          const pending = expense.installmentsPlan
            .filter((i) => i.status === 'PENDING')
            .sort((a, b) => a.installmentNumber - b.installmentNumber);

          if (pending.length > 0) {
            const remaining = round2(newTotal - paidSum);
            if (remaining <= 0) {
              return Result.fail(
                new InvalidOperation(
                  `El nuevo monto ($${newTotal}) no puede ser menor o igual a lo ya pagado ($${paidSum}).`,
                ),
              );
            }
            const baseAmount = Math.floor((remaining / pending.length) * 100) / 100;
            let assigned = 0;
            for (let idx = 0; idx < pending.length; idx++) {
              const inst = pending[idx];
              const isLast = idx === pending.length - 1;
              inst.amount = isLast ? round2(remaining - assigned) : baseAmount;
              assigned += inst.amount;
              await this.expensesRepo.saveInstallment(inst);
            }
          }
        }
        expense.totalAmount = newTotal;
      }

      if (dto.allocations !== undefined || dto.scope === 'SHARED') {
        const allocsRes = await this.resolveAllocationsEntities(
          Number(expense.totalAmount),
          expense.scope || 'PERSONAL',
          dto.allocations,
        );
        if (allocsRes.isFailure) {
          return Result.fail(allocsRes.getError());
        }
        if (dto.allocations !== undefined || (expense.allocations || []).length === 0) {
          const allocs = allocsRes.getValue();
          if (this.expensesRepo.replaceExpenseAllocations) {
            await this.expensesRepo.replaceExpenseAllocations(expense.id, allocs);
          }
          expense.allocations = allocs;
        }
      }

      const saved = await this.expensesRepo.saveExpense(expense);
      const refreshed = await this.expensesRepo.findExpenseById(saved.id);
      return Result.ok(refreshed || saved);
    } catch (error: any) {
      this.logger.error(`Error updating expense ${id}: ${error.message}`);
      return Result.fail(new CouldNotSave('Expense', error.message));
    }
  }

  async deleteExpense(id: string): Promise<Result<{ deleted: boolean; id: string }>> {
    try {
      const expense = await this.expensesRepo.findExpenseById(id);
      if (!expense) {
        return Result.fail(new NotFound(`Expense with id ${id}`));
      }
      const deleted = await this.expensesRepo.deleteExpense(id);
      this.logger.log(`Deleted expense ${id} (${expense.merchantName})`);
      return Result.ok({ deleted, id });
    } catch (error: any) {
      this.logger.error(`Error deleting expense ${id}: ${error.message}`);
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async updateInstallment(
    id: string,
    dto: UpdateInstallmentDto,
  ): Promise<Result<ExpenseInstallmentEntity>> {
    try {
      const installment = await this.expensesRepo.findInstallmentById(id);
      if (!installment) {
        return Result.fail(new NotFound(`Installment with id ${id}`));
      }

      if (dto.amount !== undefined) {
        installment.amount = round2(Number(dto.amount));
      }
      if (dto.dueDate !== undefined) installment.dueDate = dto.dueDate;
      if (dto.notes !== undefined) installment.notes = dto.notes;

      const saved = await this.expensesRepo.saveInstallment(installment);

      if (dto.amount !== undefined) {
        const parent = await this.expensesRepo.findExpenseById(installment.expenseId);
        if (parent && parent.installmentsPlan) {
          parent.totalAmount = round2(
            parent.installmentsPlan
              .filter((i) => i.status !== 'CANCELLED')
              .reduce((sum, i) => sum + Number(i.amount), 0),
          );
          await this.expensesRepo.saveExpense(parent);
        }
      }

      const refreshed = await this.expensesRepo.findInstallmentById(saved.id);
      return Result.ok(refreshed || saved);
    } catch (error: any) {
      this.logger.error(`Error updating installment ${id}: ${error.message}`);
      return Result.fail(new CouldNotSave('ExpenseInstallment', error.message));
    }
  }

  async deleteInstallment(
    id: string,
  ): Promise<Result<{ deleted: boolean; id: string; expenseDeleted?: boolean }>> {
    try {
      const installment = await this.expensesRepo.findInstallmentById(id);
      if (!installment) {
        return Result.fail(new NotFound(`Installment with id ${id}`));
      }
      const expenseId = installment.expenseId;
      const deleted = await this.expensesRepo.deleteInstallment(id);

      const parent = await this.expensesRepo.findExpenseById(expenseId);
      let expenseDeleted = false;
      if (parent) {
        const remaining = (parent.installmentsPlan || []).filter(
          (i) => i.status !== 'CANCELLED',
        );
        if (remaining.length === 0) {
          await this.expensesRepo.deleteExpense(parent.id);
          expenseDeleted = true;
        } else {
          parent.totalAmount = round2(
            remaining.reduce((sum, i) => sum + Number(i.amount), 0),
          );
          parent.totalInstallments = remaining.length;
          await this.expensesRepo.saveExpense(parent);
        }
      }

      return Result.ok({ deleted, id, expenseDeleted });
    } catch (error: any) {
      this.logger.error(`Error deleting installment ${id}: ${error.message}`);
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  // --- Members & Shared Balances ---

  async createMember(dto: CreateMemberDto): Promise<Result<MemberEntity>> {
    try {
      const slug = slugify(dto.slug || dto.displayName);
      if (!slug) {
        return Result.fail(new InvalidOperation('No se pudo generar un slug válido para el miembro.'));
      }

      const existing = await this.expensesRepo.findMemberByRef(slug);
      if (existing) {
        return Result.fail(new InvalidOperation(`Ya existe un miembro con slug '${slug}'.`));
      }

      const member = new MemberEntity();
      member.slug = slug;
      member.displayName = dto.displayName.trim();
      member.telegramUsername = dto.telegramUsername?.trim().replace(/^@/, '') || undefined;
      member.telegramId = dto.telegramId?.trim() || undefined;
      member.aliases = (dto.aliases || []).map((a) => a.trim()).filter(Boolean);
      member.isActive = true;

      const saved = await this.expensesRepo.saveMember(member);
      return Result.ok(saved);
    } catch (error: any) {
      return Result.fail(new CouldNotSave('Member', error.message));
    }
  }

  async updateMember(ref: string, dto: UpdateMemberDto): Promise<Result<MemberEntity>> {
    try {
      const member = await this.expensesRepo.findMemberByRef(ref);
      if (!member) {
        return Result.fail(new NotFound(`Member '${ref}'`));
      }

      if (dto.displayName !== undefined) member.displayName = dto.displayName.trim();
      if (dto.telegramUsername !== undefined) {
        member.telegramUsername = dto.telegramUsername.trim().replace(/^@/, '') || undefined;
      }
      if (dto.telegramId !== undefined) member.telegramId = dto.telegramId.trim() || undefined;
      if (dto.aliases !== undefined) {
        member.aliases = dto.aliases.map((a) => a.trim()).filter(Boolean);
      }
      if (dto.isActive !== undefined) member.isActive = dto.isActive;

      const saved = await this.expensesRepo.saveMember(member);
      return Result.ok(saved);
    } catch (error: any) {
      return Result.fail(new CouldNotSave('Member', error.message));
    }
  }

  async listMembers(activeOnly = true): Promise<Result<MemberEntity[]>> {
    try {
      const members = await this.expensesRepo.findMembers(activeOnly);
      return Result.ok(members);
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async deleteMember(
    ref: string,
  ): Promise<Result<{ deleted: boolean; id: string; slug: string }>> {
    try {
      const member = await this.expensesRepo.findMemberByRef(ref);
      if (!member) {
        return Result.fail(new NotFound(`Member '${ref}'`));
      }

      const refs = await this.expensesRepo.countMemberReferences(member.id);
      if (refs > 0) {
        return Result.fail(
          new InvalidOperation(
            `No se puede eliminar al miembro '${member.displayName}' porque tiene ${refs} gastos o repartos asociados. Desactivalo con update_member(isActive=false).`,
          ),
        );
      }

      const deleted = await this.expensesRepo.deleteMember(member.id);
      return Result.ok({ deleted, id: member.id, slug: member.slug });
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async getSharedBalance(query?: {
    month?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Result<SharedBalanceResponseDto>> {
    try {
      const hasRange = Boolean(query?.month || (query?.startDate && query?.endDate));
      const bounds = hasRange ? this.resolvePeriodBounds(query || {}) : null;

      const [directExpenses, paidInstallments, activeMembers] = await Promise.all([
        this.expensesRepo.findSharedDirectExpenses(bounds?.startDate, bounds?.endDate),
        this.expensesRepo.findSharedPaidInstallments(bounds?.startDate, bounds?.endDate),
        this.expensesRepo.findMembers(true),
      ]);

      const ledger = new Map<string, MemberBalanceItemDto>();
      const ensureMember = (m: MemberEntity) => {
        if (!ledger.has(m.id)) {
          ledger.set(m.id, {
            memberId: m.id,
            slug: m.slug,
            displayName: m.displayName,
            totalPaid: 0,
            totalAttributed: 0,
            netBalance: 0,
          });
        }
        return ledger.get(m.id)!;
      };

      activeMembers.forEach(ensureMember);

      let totalShared = 0;
      let expensesCount = 0;

      const applySharedMovement = (
        amount: number,
        payer: MemberEntity | undefined,
        allocations: ExpenseAllocationEntity[] | undefined,
      ) => {
        totalShared += amount;
        expensesCount += 1;

        if (payer) {
          ensureMember(payer).totalPaid += amount;
        }

        if (allocations && allocations.length > 0) {
          let attributedAcc = 0;
          allocations.forEach((alloc, idx) => {
            if (!alloc.member) return;
            const entry = ensureMember(alloc.member);
            const isLast = idx === allocations.length - 1;
            const share = isLast
              ? round2(amount - attributedAcc)
              : round2((amount * Number(alloc.percentage)) / 100);
            attributedAcc += share;
            entry.totalAttributed += share;
          });
        } else if (activeMembers.length > 0) {
          const shareBase = Math.floor((amount / activeMembers.length) * 100) / 100;
          let acc = 0;
          activeMembers.forEach((m, idx) => {
            const share =
              idx === activeMembers.length - 1 ? round2(amount - acc) : shareBase;
            acc += share;
            ensureMember(m).totalAttributed += share;
          });
        }
      };

      for (const exp of directExpenses) {
        applySharedMovement(Number(exp.totalAmount), exp.paidByMember, exp.allocations);
      }

      for (const inst of paidInstallments) {
        applySharedMovement(
          Number(inst.amount),
          inst.expense?.paidByMember,
          inst.expense?.allocations,
        );
      }

      const members = Array.from(ledger.values()).map((item) => {
        const totalPaid = round2(item.totalPaid);
        const totalAttributed = round2(item.totalAttributed);
        return {
          ...item,
          totalPaid,
          totalAttributed,
          netBalance: round2(totalPaid - totalAttributed),
        };
      });

      const debtors = members
        .filter((m) => m.netBalance < -0.01)
        .map((m) => ({ ...m, remaining: round2(-m.netBalance) }))
        .sort((a, b) => b.remaining - a.remaining);

      const creditors = members
        .filter((m) => m.netBalance > 0.01)
        .map((m) => ({ ...m, remaining: round2(m.netBalance) }))
        .sort((a, b) => b.remaining - a.remaining);

      const settlements: SettlementSuggestionDto[] = [];
      let dIdx = 0;
      let cIdx = 0;

      while (dIdx < debtors.length && cIdx < creditors.length) {
        const debtor = debtors[dIdx];
        const creditor = creditors[cIdx];
        const transfer = round2(Math.min(debtor.remaining, creditor.remaining));

        if (transfer >= 0.01) {
          settlements.push({
            fromMemberId: debtor.memberId,
            fromSlug: debtor.slug,
            fromDisplayName: debtor.displayName,
            toMemberId: creditor.memberId,
            toSlug: creditor.slug,
            toDisplayName: creditor.displayName,
            amount: transfer,
          });
        }

        debtor.remaining = round2(debtor.remaining - transfer);
        creditor.remaining = round2(creditor.remaining - transfer);

        if (debtor.remaining < 0.01) dIdx++;
        if (creditor.remaining < 0.01) cIdx++;
      }

      return Result.ok({
        periodLabel: bounds ? bounds.periodLabel : 'Histórico completo',
        startDate: bounds?.startDate,
        endDate: bounds?.endDate,
        totalShared: round2(totalShared),
        expensesCount,
        members,
        settlements,
      });
    } catch (error: any) {
      this.logger.error(`Error calculating shared balance: ${error.message}`);
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  // --- Budgets ---

  async setCategoryBudget(dto: SetCategoryBudgetDto): Promise<Result<CategoryBudgetEntity>> {
    try {
      const category = dto.category.trim().toUpperCase();
      const currency = (dto.currency || 'ARS').trim().toUpperCase();
      const scope = dto.scope || 'ALL';

      let memberId: string | undefined;
      if (dto.memberRef) {
        const member = await this.expensesRepo.findMemberByRef(dto.memberRef);
        if (!member) {
          return Result.fail(new NotFound(`Member '${dto.memberRef}'`));
        }
        memberId = member.id;
      }

      const existing = await this.expensesRepo.findBudgetByMatch(
        category,
        currency,
        scope,
        memberId,
      );

      const budget = existing || new CategoryBudgetEntity();
      budget.category = category;
      budget.currency = currency;
      budget.monthlyAmount = round2(Number(dto.monthlyAmount));
      budget.alertThresholdPct = dto.alertThresholdPct ?? existing?.alertThresholdPct ?? 80;
      budget.scope = scope;
      budget.memberId = memberId;
      budget.notes = dto.notes ?? existing?.notes;
      budget.isActive = true;

      const saved = await this.expensesRepo.saveBudget(budget);
      const refreshed = await this.expensesRepo.findBudgetById(saved.id);
      return Result.ok(refreshed || saved);
    } catch (error: any) {
      return Result.fail(new CouldNotSave('CategoryBudget', error.message));
    }
  }

  async listCategoryBudgets(activeOnly = true): Promise<Result<CategoryBudgetEntity[]>> {
    try {
      const budgets = await this.expensesRepo.findBudgets(activeOnly);
      return Result.ok(budgets);
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async deleteCategoryBudget(id: string): Promise<Result<{ deleted: boolean; id: string }>> {
    try {
      const existing = await this.expensesRepo.findBudgetById(id);
      if (!existing) {
        return Result.fail(new NotFound(`CategoryBudget with id ${id}`));
      }
      const deleted = await this.expensesRepo.deleteBudget(id);
      return Result.ok({ deleted, id });
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async getBudgetStatus(
    month?: string,
    alertsOnly = false,
  ): Promise<Result<BudgetStatusResponseDto>> {
    try {
      const bounds = this.resolvePeriodBounds({ month });
      const [budgets, directExpenses, paidInstallments] = await Promise.all([
        this.expensesRepo.findBudgets(true),
        this.expensesRepo.findExpensesByDateRange(bounds.startDate, bounds.endDate, false),
        this.expensesRepo.findPaidInstallmentsByDateRange(bounds.startDate, bounds.endDate),
      ]);

      const items: BudgetStatusItemDto[] = [];
      let totalBudgeted = 0;
      let totalSpent = 0;
      let alertsCount = 0;

      for (const b of budgets) {
        const targetCat = b.category.toUpperCase();
        const targetCur = b.currency.toUpperCase();
        const targetMember = b.member || undefined;

        const matchingDirect = directExpenses.filter(
          (e) =>
            (e.category || 'GENERAL').toUpperCase() === targetCat &&
            (e.currency || 'ARS').toUpperCase() === targetCur &&
            this.matchesScopeAndMember(e, b.scope, targetMember),
        );
        const matchingInst = paidInstallments.filter(
          (i) =>
            (i.expense?.category || 'GENERAL').toUpperCase() === targetCat &&
            (i.expense?.currency || 'ARS').toUpperCase() === targetCur &&
            this.matchesScopeAndMember(i.expense, b.scope, targetMember),
        );

        const spent = round2(
          matchingDirect.reduce((s, e) => s + Number(e.totalAmount), 0) +
            matchingInst.reduce((s, i) => s + Number(i.amount), 0),
        );
        const monthlyBudget = round2(Number(b.monthlyAmount));
        const remaining = round2(monthlyBudget - spent);
        const percentageUsed =
          monthlyBudget > 0 ? Math.round((spent / monthlyBudget) * 1000) / 10 : 0;
        const alertTriggered = percentageUsed >= b.alertThresholdPct;
        const exceeded = spent > monthlyBudget;

        if (alertTriggered) alertsCount += 1;
        totalBudgeted += monthlyBudget;
        totalSpent += spent;

        if (!alertsOnly || alertTriggered) {
          items.push({
            id: b.id,
            category: b.category,
            currency: b.currency,
            scope: b.scope,
            memberSlug: b.member?.slug,
            monthlyBudget,
            spent,
            remaining,
            percentageUsed,
            alertThresholdPct: b.alertThresholdPct,
            alertTriggered,
            exceeded,
            notes: b.notes,
          });
        }
      }

      items.sort((a, b) => b.percentageUsed - a.percentageUsed);

      return Result.ok({
        month: bounds.monthKey,
        totalBudgeted: round2(totalBudgeted),
        totalSpent: round2(totalSpent),
        alertsCount,
        items,
      });
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  // --- Recurring / Fixed Expenses ---

  async createRecurringExpense(
    dto: CreateRecurringExpenseDto,
  ): Promise<Result<RecurringExpenseEntity>> {
    try {
      let matchedCard: CreditCardEntity | null = null;
      if (dto.cardBank && dto.cardName) {
        matchedCard = await this.expensesRepo.findCreditCardByDetails(
          dto.cardBank,
          dto.cardName,
          dto.cardHolder,
        );
      }

      let paidByMember: MemberEntity | null = null;
      if (dto.paidBy) {
        paidByMember = await this.expensesRepo.findMemberByRef(dto.paidBy);
        if (!paidByMember) {
          return Result.fail(new NotFound(`Member '${dto.paidBy}'`));
        }
      }

      const defaultAllocations = dto.allocations?.length
        ? dto.allocations.map((a) => ({
            memberSlug: a.member,
            percentage: Number(a.percentage),
          }))
        : undefined;

      if (defaultAllocations) {
        const sumPct = defaultAllocations.reduce((s, a) => s + a.percentage, 0);
        if (Math.abs(sumPct - 100) > 0.05) {
          return Result.fail(
            new InvalidOperation(`Las allocations por defecto deben sumar 100% (actual: ${sumPct}%).`),
          );
        }
      }

      const rec = new RecurringExpenseEntity();
      rec.merchantName = dto.merchantName.trim();
      rec.description = dto.description.trim();
      rec.category = (dto.category || 'IMPUESTOS_Y_SERVICIOS').trim().toUpperCase();
      rec.estimatedAmount = round2(Number(dto.estimatedAmount));
      rec.currency = (dto.currency || 'ARS').trim().toUpperCase();
      rec.dayOfMonth = dto.dayOfMonth ?? 10;
      rec.frequency = dto.frequency || 'MONTHLY';
      rec.paymentMethod = dto.paymentMethod || 'BANK_TRANSFER';
      rec.bankName = dto.bankName;
      rec.creditCardId = matchedCard?.id;
      rec.scope = dto.scope || 'PERSONAL';
      rec.paidByMemberId = paidByMember?.id;
      rec.defaultAllocations = defaultAllocations;
      rec.isActive = true;
      rec.notes = dto.notes;

      const saved = await this.expensesRepo.saveRecurringExpense(rec);
      const refreshed = await this.expensesRepo.findRecurringExpenseById(saved.id);
      return Result.ok(refreshed || saved);
    } catch (error: any) {
      return Result.fail(new CouldNotSave('RecurringExpense', error.message));
    }
  }

  async listRecurringExpenses(activeOnly = true): Promise<Result<RecurringExpenseEntity[]>> {
    try {
      const list = await this.expensesRepo.findRecurringExpenses(activeOnly);
      return Result.ok(list);
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async updateRecurringExpense(
    id: string,
    dto: UpdateRecurringExpenseDto,
  ): Promise<Result<RecurringExpenseEntity>> {
    try {
      const rec = await this.expensesRepo.findRecurringExpenseById(id);
      if (!rec) {
        return Result.fail(new NotFound(`RecurringExpense with id ${id}`));
      }

      if (dto.merchantName !== undefined) rec.merchantName = dto.merchantName.trim();
      if (dto.description !== undefined) rec.description = dto.description.trim();
      if (dto.category !== undefined) rec.category = dto.category.trim().toUpperCase();
      if (dto.estimatedAmount !== undefined) rec.estimatedAmount = round2(Number(dto.estimatedAmount));
      if (dto.dayOfMonth !== undefined) rec.dayOfMonth = dto.dayOfMonth;
      if (dto.frequency !== undefined) rec.frequency = dto.frequency;
      if (dto.paymentMethod !== undefined) rec.paymentMethod = dto.paymentMethod;
      if (dto.bankName !== undefined) rec.bankName = dto.bankName;
      if (dto.scope !== undefined) rec.scope = dto.scope;
      if (dto.isActive !== undefined) rec.isActive = dto.isActive;
      if (dto.notes !== undefined) rec.notes = dto.notes;

      if (dto.paidBy !== undefined) {
        const member = await this.expensesRepo.findMemberByRef(dto.paidBy);
        if (!member) {
          return Result.fail(new NotFound(`Member '${dto.paidBy}'`));
        }
        rec.paidByMemberId = member.id;
        rec.paidByMember = member;
      }

      if (dto.allocations !== undefined) {
        const sumPct = dto.allocations.reduce((s, a) => s + Number(a.percentage), 0);
        if (dto.allocations.length > 0 && Math.abs(sumPct - 100) > 0.05) {
          return Result.fail(
            new InvalidOperation(`Las allocations por defecto deben sumar 100% (actual: ${sumPct}%).`),
          );
        }
        rec.defaultAllocations = dto.allocations.map((a) => ({
          memberSlug: a.member,
          percentage: Number(a.percentage),
        }));
      }

      const saved = await this.expensesRepo.saveRecurringExpense(rec);
      const refreshed = await this.expensesRepo.findRecurringExpenseById(saved.id);
      return Result.ok(refreshed || saved);
    } catch (error: any) {
      return Result.fail(new CouldNotSave('RecurringExpense', error.message));
    }
  }

  async deleteRecurringExpense(id: string): Promise<Result<{ deleted: boolean; id: string }>> {
    try {
      const existing = await this.expensesRepo.findRecurringExpenseById(id);
      if (!existing) {
        return Result.fail(new NotFound(`RecurringExpense with id ${id}`));
      }
      const deleted = await this.expensesRepo.deleteRecurringExpense(id);
      return Result.ok({ deleted, id });
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  private appliesToMonth(rec: RecurringExpenseEntity, targetYearMonth: string): boolean {
    if (rec.frequency === 'MONTHLY') return true;
    const [targetY, targetM] = targetYearMonth.split('-').map(Number);
    const baseDate = rec.createdAt ? new Date(rec.createdAt) : new Date();
    const baseY = baseDate.getUTCFullYear();
    const baseM = baseDate.getUTCMonth() + 1;
    const monthsDiff = (targetY - baseY) * 12 + (targetM - baseM);

    if (rec.frequency === 'BIMONTHLY') {
      return Math.abs(monthsDiff) % 2 === 0;
    }
    if (rec.frequency === 'YEARLY') {
      return targetM === baseM;
    }
    return true;
  }

  async getFixedExpensesStatus(month?: string): Promise<Result<FixedExpensesStatusResponseDto>> {
    try {
      const bounds = this.resolvePeriodBounds({ month });
      const [templates, fixedInMonth] = await Promise.all([
        this.expensesRepo.findRecurringExpenses(true),
        this.expensesRepo.findFixedExpensesInDateRange(bounds.startDate, bounds.endDate),
      ]);

      const todayStr = new Date().toISOString().slice(0, 10);
      const [yStr, mStr] = bounds.monthKey.split('-');
      const lastDay = new Date(Number(yStr), Number(mStr), 0).getDate();

      const items: FixedExpenseStatusItemDto[] = [];
      let totalEstimated = 0;
      let totalPaid = 0;
      let totalPendingEstimated = 0;
      let paidCount = 0;
      let pendingCount = 0;

      for (const tpl of templates) {
        if (!this.appliesToMonth(tpl, bounds.monthKey)) continue;

        const match =
          fixedInMonth.find((e) => e.recurringExpenseId === tpl.id) ||
          fixedInMonth.find(
            (e) =>
              e.merchantName.trim().toLowerCase() === tpl.merchantName.trim().toLowerCase(),
          );

        const dueDay = Math.min(tpl.dayOfMonth || 10, lastDay);
        const expectedDate = `${bounds.monthKey}-${String(dueDay).padStart(2, '0')}`;
        const estimatedAmount = round2(Number(tpl.estimatedAmount));
        totalEstimated += estimatedAmount;

        if (match) {
          const paidAmt = round2(Number(match.totalAmount));
          totalPaid += paidAmt;
          paidCount += 1;
          items.push({
            recurringId: tpl.id,
            merchantName: tpl.merchantName,
            description: tpl.description,
            category: tpl.category,
            estimatedAmount,
            currency: tpl.currency,
            dayOfMonth: tpl.dayOfMonth,
            frequency: tpl.frequency,
            scope: tpl.scope,
            paymentMethod: tpl.paymentMethod,
            bankName: tpl.bankName,
            status: 'PAID',
            paidExpenseId: match.id,
            paidAmount: paidAmt,
            paidDate: match.expenseDate,
          });
        } else {
          const status = todayStr > expectedDate ? 'OVERDUE' : 'PENDING';
          totalPendingEstimated += estimatedAmount;
          pendingCount += 1;
          items.push({
            recurringId: tpl.id,
            merchantName: tpl.merchantName,
            description: tpl.description,
            category: tpl.category,
            estimatedAmount,
            currency: tpl.currency,
            dayOfMonth: tpl.dayOfMonth,
            frequency: tpl.frequency,
            scope: tpl.scope,
            paymentMethod: tpl.paymentMethod,
            bankName: tpl.bankName,
            status,
          });
        }
      }

      return Result.ok({
        month: bounds.monthKey,
        totalEstimated: round2(totalEstimated),
        totalPaid: round2(totalPaid),
        totalPendingEstimated: round2(totalPendingEstimated),
        paidCount,
        pendingCount,
        items,
      });
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async payRecurringExpense(
    ref: string,
    dto: PayRecurringExpenseDto,
  ): Promise<Result<ExpenseEntity>> {
    try {
      let template: RecurringExpenseEntity | null = null;
      if (UUID_REGEX.test(ref.trim())) {
        template = await this.expensesRepo.findRecurringExpenseById(ref.trim());
      } else {
        const all = await this.expensesRepo.findRecurringExpenses(true);
        const term = ref.trim().toLowerCase();
        const matches = all.filter(
          (t) =>
            t.merchantName.toLowerCase().includes(term) ||
            t.description.toLowerCase().includes(term),
        );
        if (matches.length === 1) {
          template = matches[0];
        } else if (matches.length > 1) {
          const exact = matches.find((m) => m.merchantName.toLowerCase() === term);
          if (exact) {
            template = exact;
          } else {
            return Result.fail(
              new InvalidOperation(
                `Múltiples gastos fijos coinciden con '${ref}': ${matches.map((m) => m.merchantName).join(', ')}. Especificá el nombre exacto o el UUID.`,
              ),
            );
          }
        }
      }

      if (!template) {
        return Result.fail(new NotFound(`RecurringExpense '${ref}'`));
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      return this.registerExpense({
        merchantName: template.merchantName,
        description: dto.description || template.description,
        totalAmount: dto.amount ?? Number(template.estimatedAmount),
        currency: template.currency,
        expenseDate: dto.expenseDate || todayStr,
        paymentMethod: dto.paymentMethod || template.paymentMethod,
        bankName: dto.bankName ?? template.bankName,
        creditCardId: template.creditCardId,
        scope: template.scope,
        isFixed: true,
        recurringExpenseId: template.id,
        paidBy: dto.paidBy || template.paidByMember?.slug,
        allocations: template.defaultAllocations?.map((a) => ({
          member: a.memberSlug,
          percentage: a.percentage,
        })),
        category: template.category,
        source: 'CHAT_MESSAGE',
      });
    } catch (error: any) {
      return Result.fail(new CouldNotSave('Expense', error.message));
    }
  }

  // --- Analytics, Export & Charts ---

  async compareMonths(
    monthA: string,
    monthB: string,
    scope?: 'ALL' | ExpenseScope,
    memberRef?: string,
  ): Promise<Result<CompareMonthsResponseDto>> {
    if (!/^\d{4}-\d{2}$/.test(monthA) || !/^\d{4}-\d{2}$/.test(monthB)) {
      return Result.fail(new InvalidOperation('monthA y monthB deben tener formato YYYY-MM'));
    }

    const [resA, resB] = await Promise.all([
      this.getFinancialSummary({ month: monthA, scope, memberRef }),
      this.getFinancialSummary({ month: monthB, scope, memberRef }),
    ]);

    if (resA.isFailure) return Result.fail(resA.getError());
    if (resB.isFailure) return Result.fail(resB.getError());

    const sumA = resA.getValue();
    const sumB = resB.getValue();

    const mapA = new Map(sumA.byCategory.map((c) => [c.category, c.amount]));
    const mapB = new Map(sumB.byCategory.map((c) => [c.category, c.amount]));
    const categories = new Set([...mapA.keys(), ...mapB.keys()]);

    const byCategory: MonthCategoryDeltaDto[] = Array.from(categories)
      .map((category) => {
        const amountA = round2(mapA.get(category) || 0);
        const amountB = round2(mapB.get(category) || 0);
        const diffAmount = round2(amountB - amountA);
        const diffPercentage =
          amountA > 0 ? Math.round(((amountB - amountA) / amountA) * 1000) / 10 : amountB > 0 ? 100 : 0;
        return {
          category,
          amountA,
          amountB,
          diffAmount,
          diffPercentage,
        };
      })
      .sort((a, b) => Math.abs(b.diffAmount) - Math.abs(a.diffAmount));

    const diffAmount = round2(sumB.totalPaid - sumA.totalPaid);
    const diffPercentage =
      sumA.totalPaid > 0
        ? Math.round(((sumB.totalPaid - sumA.totalPaid) / sumA.totalPaid) * 1000) / 10
        : 0;
    const trend = diffAmount > 0 ? 'UP' : diffAmount < 0 ? 'DOWN' : 'EQUAL';

    return Result.ok({
      monthA,
      monthB,
      totalA: sumA.totalPaid,
      totalB: sumB.totalPaid,
      diffAmount,
      diffPercentage,
      trend,
      byCategory,
    });
  }

  async getTopExpenses(query: {
    month?: string;
    startDate?: string;
    endDate?: string;
    category?: string;
    scope?: 'ALL' | ExpenseScope;
    memberRef?: string;
    isFixed?: boolean;
    limit?: number;
  }): Promise<Result<TopExpensesResponseDto>> {
    try {
      const bounds = this.resolvePeriodBounds(query);
      let targetMember: MemberEntity | null = null;
      if (query.memberRef) {
        targetMember = await this.expensesRepo.findMemberByRef(query.memberRef);
        if (!targetMember) {
          return Result.fail(new NotFound(`Member '${query.memberRef}'`));
        }
      }

      const [directExpenses, paidInstallments] = await Promise.all([
        this.expensesRepo.findExpensesByDateRange(bounds.startDate, bounds.endDate, false),
        this.expensesRepo.findPaidInstallmentsByDateRange(bounds.startDate, bounds.endDate),
      ]);

      const catFilter = query.category?.trim().toUpperCase();
      const rawItems: Omit<TopExpenseItemDto, 'rank'>[] = [];

      for (const e of directExpenses) {
        if (!this.matchesScopeAndMember(e, query.scope, targetMember, query.isFixed)) continue;
        const cat = (e.category || 'GENERAL').toUpperCase();
        if (catFilter && cat !== catFilter) continue;

        rawItems.push({
          id: e.id,
          type: 'EXPENSE',
          date: e.expenseDate,
          merchantName: e.merchantName,
          description: e.description,
          amount: Number(e.totalAmount),
          currency: e.currency || 'ARS',
          category: cat,
          scope: e.scope || 'PERSONAL',
          isFixed: Boolean(e.isFixed),
          bank: e.creditCard?.bank || e.bankName,
          holderName: this.getHolderLabel(e),
        });
      }

      for (const i of paidInstallments) {
        if (!this.matchesScopeAndMember(i.expense, query.scope, targetMember, query.isFixed)) continue;
        const cat = (i.expense?.category || 'GENERAL').toUpperCase();
        if (catFilter && cat !== catFilter) continue;

        rawItems.push({
          id: i.id,
          type: 'INSTALLMENT',
          date: i.paidAt ? new Date(i.paidAt).toISOString().slice(0, 10) : i.dueDate,
          merchantName: i.expense?.merchantName || 'Desconocido',
          description: i.expense?.description || '',
          amount: Number(i.amount),
          currency: i.expense?.currency || 'ARS',
          category: cat,
          scope: i.expense?.scope || 'PERSONAL',
          isFixed: Boolean(i.expense?.isFixed),
          bank: i.expense?.creditCard?.bank || i.expense?.bankName,
          holderName: this.getHolderLabel(i.expense),
          installmentInfo: `Cuota ${i.installmentNumber}/${i.totalInstallments}`,
        });
      }

      rawItems.sort((a, b) => b.amount - a.amount);
      const limit = Math.min(50, Math.max(1, query.limit ?? 10));
      const items: TopExpenseItemDto[] = rawItems.slice(0, limit).map((item, idx) => ({
        rank: idx + 1,
        ...item,
      }));

      return Result.ok({
        periodLabel: bounds.periodLabel,
        startDate: bounds.startDate,
        endDate: bounds.endDate,
        totalMatched: rawItems.length,
        items,
      });
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async exportExpenses(query: ExportExpensesQueryInput): Promise<Result<ExportResult>> {
    if (!this.exportService) {
      return Result.fail(new InvalidOperation('ExportService no está disponible.'));
    }

    try {
      const bounds = this.resolvePeriodBounds(query);
      let targetMember: MemberEntity | null = null;
      if (query.memberRef) {
        targetMember = await this.expensesRepo.findMemberByRef(query.memberRef);
        if (!targetMember) {
          return Result.fail(new NotFound(`Member '${query.memberRef}'`));
        }
      }

      const [directExpenses, paidInstallments, pendingInstallments] = await Promise.all([
        this.expensesRepo.findExpensesByDateRange(bounds.startDate, bounds.endDate, false),
        this.expensesRepo.findPaidInstallmentsByDateRange(bounds.startDate, bounds.endDate),
        this.expensesRepo.findPendingInstallmentsByDueDateRange(bounds.startDate, bounds.endDate),
      ]);

      const catFilter = query.category?.trim().toUpperCase();
      const rows: ExportExpenseRow[] = [];

      for (const e of directExpenses) {
        if (!this.matchesScopeAndMember(e, query.scope, targetMember, query.isFixed)) continue;
        const cat = (e.category || 'GENERAL').toUpperCase();
        if (catFilter && cat !== catFilter) continue;

        rows.push({
          date: e.expenseDate,
          type: 'EXPENSE',
          merchantName: e.merchantName,
          description: e.description,
          amount: Number(e.totalAmount),
          currency: e.currency || 'ARS',
          category: cat,
          scope: e.scope || 'PERSONAL',
          isFixed: Boolean(e.isFixed),
          paymentMethod: e.paymentMethod,
          bank: e.creditCard?.bank || e.bankName || '',
          paidBy: this.getHolderLabel(e),
          installmentInfo: '',
          status: 'PAID',
        });
      }

      for (const i of [...paidInstallments, ...pendingInstallments]) {
        if (!this.matchesScopeAndMember(i.expense, query.scope, targetMember, query.isFixed)) continue;
        const cat = (i.expense?.category || 'GENERAL').toUpperCase();
        if (catFilter && cat !== catFilter) continue;

        rows.push({
          date:
            i.status === 'PAID' && i.paidAt
              ? new Date(i.paidAt).toISOString().slice(0, 10)
              : i.dueDate,
          type: 'INSTALLMENT',
          merchantName: i.expense?.merchantName || 'Desconocido',
          description: i.expense?.description || '',
          amount: Number(i.amount),
          currency: i.expense?.currency || 'ARS',
          category: cat,
          scope: i.expense?.scope || 'PERSONAL',
          isFixed: Boolean(i.expense?.isFixed),
          paymentMethod: i.expense?.paymentMethod || 'CREDIT_CARD',
          bank: i.expense?.creditCard?.bank || i.expense?.bankName || '',
          paidBy: this.getHolderLabel(i.expense),
          installmentInfo: `${i.installmentNumber}/${i.totalInstallments}`,
          status: i.status,
        });
      }

      rows.sort((a, b) => b.date.localeCompare(a.date));
      const format = query.format === 'json' ? 'json' : 'csv';
      const result = await this.exportService.exportToFile(rows, format, bounds.monthKey);
      return Result.ok(result);
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async renderChart(query: RenderChartQueryInput): Promise<Result<RenderChartResult>> {
    if (!this.chartService) {
      return Result.fail(new InvalidOperation('ChartService no está disponible.'));
    }

    try {
      const targetMonth = query.month || new Date().toISOString().slice(0, 7);

      if (query.chartType === 'monthly_trend') {
        const months: string[] = [];
        if (query.year) {
          for (let m = 1; m <= 12; m++) {
            months.push(`${query.year}-${String(m).padStart(2, '0')}`);
          }
        } else {
          const [yStr, mStr] = targetMonth.split('-');
          const baseY = Number(yStr);
          const baseM = Number(mStr) - 1;
          for (let offset = 5; offset >= 0; offset--) {
            const d = new Date(baseY, baseM - offset, 1);
            months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
          }
        }

        const summaries = await Promise.all(
          months.map((m) =>
            this.getFinancialSummary({
              month: m,
              scope: query.scope,
              memberRef: query.memberRef,
            }),
          ),
        );

        const items = months.map((m, idx) => {
          const res = summaries[idx];
          return {
            label: m,
            value: res.isSuccess ? res.getValue().totalPaid : 0,
          };
        });

        const totalAmount = round2(items.reduce((s, i) => s + i.value, 0));
        const chart = await this.chartService.renderChartPng({
          chartType: 'monthly_trend',
          title: query.year
            ? `Evolución Mensual ${query.year}`
            : `Evolución Últimos ${months.length} Meses`,
          subtitle: `Cashflow efectivamente pagado (${months[0]} a ${months[months.length - 1]})`,
          totalAmount,
          items,
          periodTag: query.year ? String(query.year) : targetMonth,
        });
        return Result.ok(chart);
      }

      if (query.chartType === 'top_expenses') {
        const topRes = await this.getTopExpenses({
          month: targetMonth,
          scope: query.scope,
          memberRef: query.memberRef,
          limit: query.limit || 8,
        });
        if (topRes.isFailure) return Result.fail(topRes.getError());
        const top = topRes.getValue();
        const items = top.items.map((item) => ({
          label: `${item.merchantName} (${item.date.slice(5)})`,
          value: item.amount,
        }));
        const total = round2(items.reduce((s, i) => s + i.value, 0));
        const chart = await this.chartService.renderChartPng({
          chartType: 'top_expenses',
          title: `Top Gastos — ${top.periodLabel}`,
          subtitle: `${top.items.length} mayores desembolsos`,
          totalAmount: total,
          items,
          periodTag: targetMonth,
        });
        return Result.ok(chart);
      }

      const summaryRes = await this.getFinancialSummary({
        month: targetMonth,
        scope: query.scope,
        memberRef: query.memberRef,
      });
      if (summaryRes.isFailure) return Result.fail(summaryRes.getError());
      const summary = summaryRes.getValue();

      if (query.chartType === 'fixed_vs_variable') {
        const fv = summary.fixedVsVariable;
        const chart = await this.chartService.renderChartPng({
          chartType: 'fixed_vs_variable',
          title: `Fijos vs Variables — ${summary.periodLabel}`,
          subtitle: 'Distribución del gasto pagado en el período',
          totalAmount: round2(fv.fixedPaid + fv.variablePaid),
          items: [
            {
              label: 'Gastos Fijos',
              value: fv.fixedPaid,
              percentage: fv.fixedPercentage,
            },
            {
              label: 'Gastos Variables',
              value: fv.variablePaid,
              percentage: fv.variablePercentage,
            },
          ],
          periodTag: targetMonth,
        });
        return Result.ok(chart);
      }

      if (query.chartType === 'by_holder') {
        const chart = await this.chartService.renderChartPng({
          chartType: 'by_holder',
          title: `Gastos por Titular — ${summary.periodLabel}`,
          subtitle: 'Pagado + cuotas pendientes por responsable',
          totalAmount: round2(summary.totalPaid + summary.totalPending),
          items: summary.byHolder.map((h) => ({
            label: h.holderName,
            value: h.totalAmount,
            percentage: h.percentage,
          })),
          periodTag: targetMonth,
        });
        return Result.ok(chart);
      }

      // Default: by_category
      const chart = await this.chartService.renderChartPng({
        chartType: 'by_category',
        title: `Gastos por Categoría — ${summary.periodLabel}`,
        subtitle: `Total pagado: $${summary.totalPaid.toLocaleString('es-AR')} (${summary.paidTransactionsCount} movs)`,
        totalAmount: summary.totalPaid,
        items: summary.byCategory.map((c) => ({
          label: c.category,
          value: c.amount,
          percentage: c.percentage,
        })),
        periodTag: targetMonth,
      });
      return Result.ok(chart);
    } catch (error: any) {
      this.logger.error(`Error rendering chart: ${error.message}`, error.stack);
      return Result.fail(new InvalidOperation(error.message));
    }
  }
}
