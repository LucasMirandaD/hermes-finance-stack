import { Result } from '../../../../common/errors/result.mapper';
import { CreateExpenseDto } from '../../presentation/dtos/create-expense.dto';
import { CreateCreditCardDto } from '../../presentation/dtos/create-credit-card.dto';
import { ExpenseEntity } from '../../data/entities/expense.entity';
import { CreditCardEntity } from '../../data/entities/credit-card.entity';
import { ExpenseInstallmentEntity } from '../../data/entities/expense-installment.entity';
import { MemberEntity } from '../../data/entities/member.entity';
import { CategoryBudgetEntity } from '../../data/entities/category-budget.entity';
import { RecurringExpenseEntity } from '../../data/entities/recurring-expense.entity';
import { MonthlyInstallmentsSummaryDto } from '../../presentation/dtos/installment-summary.dto';
import {
  FinancialSummaryQueryDto,
  FinancialSummaryResponseDto,
  UpcomingDueDto,
} from '../../presentation/dtos/financial-summary.dto';
import {
  SearchExpensesQueryDto,
  SearchExpensesResponseDto,
} from '../../presentation/dtos/search-expenses.dto';
import {
  UpdateExpenseDto,
  UpdateInstallmentDto,
} from '../../presentation/dtos/update-expense.dto';
import {
  CreateMemberDto,
  SharedBalanceResponseDto,
  UpdateMemberDto,
} from '../../presentation/dtos/member.dto';
import {
  BudgetStatusResponseDto,
  SetCategoryBudgetDto,
} from '../../presentation/dtos/budget.dto';
import {
  CreateRecurringExpenseDto,
  FixedExpensesStatusResponseDto,
  PayRecurringExpenseDto,
  UpdateRecurringExpenseDto,
} from '../../presentation/dtos/recurring-expense.dto';
import {
  CompareMonthsResponseDto,
  ExportExpensesQueryInput,
  HealthCheckResponseDto,
  RenderChartQueryInput,
  TopExpensesResponseDto,
} from '../../presentation/dtos/analytics.dto';
import { RenderChartResult } from '../../infrastructure/chart.service';
import { ExportResult } from '../../infrastructure/export.service';
import { ExpenseScope } from '../interfaces/expense.interface';

export abstract class IExpensesService {
  abstract healthCheck(): Promise<Result<HealthCheckResponseDto>>;

  // Expenses & Installments
  abstract registerExpense(dto: CreateExpenseDto): Promise<Result<ExpenseEntity>>;
  abstract getExpenseById(id: string): Promise<Result<ExpenseEntity>>;
  abstract listExpenses(limit?: number, offset?: number): Promise<Result<ExpenseEntity[]>>;
  abstract updateExpense(id: string, dto: UpdateExpenseDto): Promise<Result<ExpenseEntity>>;
  abstract deleteExpense(id: string): Promise<Result<{ deleted: boolean; id: string }>>;
  abstract searchExpenses(query: SearchExpensesQueryDto): Promise<Result<SearchExpensesResponseDto>>;

  // Credit Cards & Installments
  abstract registerCreditCard(dto: CreateCreditCardDto): Promise<Result<CreditCardEntity>>;
  abstract listCreditCards(): Promise<Result<CreditCardEntity[]>>;
  abstract getMonthlyInstallmentsSummary(
    yearMonth: string,
  ): Promise<Result<MonthlyInstallmentsSummaryDto>>;
  abstract searchPendingInstallments(
    query?: string,
    dueDate?: string,
  ): Promise<Result<ExpenseInstallmentEntity[]>>;
  abstract payInstallment(
    id: string,
    paymentMethod?: string,
    bankName?: string,
    notes?: string,
  ): Promise<Result<ExpenseInstallmentEntity>>;
  abstract getUpcomingInstallments(days?: number): Promise<Result<UpcomingDueDto[]>>;
  abstract updateInstallment(
    id: string,
    dto: UpdateInstallmentDto,
  ): Promise<Result<ExpenseInstallmentEntity>>;
  abstract deleteInstallment(
    id: string,
  ): Promise<Result<{ deleted: boolean; id: string; expenseDeleted?: boolean }>>;

  // Financial Summary & Analytics
  abstract getFinancialSummary(
    query: FinancialSummaryQueryDto,
  ): Promise<Result<FinancialSummaryResponseDto>>;
  abstract compareMonths(
    monthA: string,
    monthB: string,
    scope?: 'ALL' | ExpenseScope,
    memberRef?: string,
  ): Promise<Result<CompareMonthsResponseDto>>;
  abstract getTopExpenses(query: {
    month?: string;
    startDate?: string;
    endDate?: string;
    category?: string;
    scope?: 'ALL' | ExpenseScope;
    memberRef?: string;
    isFixed?: boolean;
    limit?: number;
  }): Promise<Result<TopExpensesResponseDto>>;
  abstract exportExpenses(query: ExportExpensesQueryInput): Promise<Result<ExportResult>>;
  abstract renderChart(query: RenderChartQueryInput): Promise<Result<RenderChartResult>>;

  // Members & Shared Balances
  abstract createMember(dto: CreateMemberDto): Promise<Result<MemberEntity>>;
  abstract updateMember(ref: string, dto: UpdateMemberDto): Promise<Result<MemberEntity>>;
  abstract listMembers(activeOnly?: boolean): Promise<Result<MemberEntity[]>>;
  abstract deleteMember(ref: string): Promise<Result<{ deleted: boolean; id: string; slug: string }>>;
  abstract getSharedBalance(query?: {
    month?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Result<SharedBalanceResponseDto>>;

  // Budgets
  abstract setCategoryBudget(dto: SetCategoryBudgetDto): Promise<Result<CategoryBudgetEntity>>;
  abstract listCategoryBudgets(activeOnly?: boolean): Promise<Result<CategoryBudgetEntity[]>>;
  abstract deleteCategoryBudget(id: string): Promise<Result<{ deleted: boolean; id: string }>>;
  abstract getBudgetStatus(
    month?: string,
    alertsOnly?: boolean,
  ): Promise<Result<BudgetStatusResponseDto>>;

  // Recurring / Fixed Expenses
  abstract createRecurringExpense(
    dto: CreateRecurringExpenseDto,
  ): Promise<Result<RecurringExpenseEntity>>;
  abstract listRecurringExpenses(activeOnly?: boolean): Promise<Result<RecurringExpenseEntity[]>>;
  abstract updateRecurringExpense(
    id: string,
    dto: UpdateRecurringExpenseDto,
  ): Promise<Result<RecurringExpenseEntity>>;
  abstract deleteRecurringExpense(id: string): Promise<Result<{ deleted: boolean; id: string }>>;
  abstract getFixedExpensesStatus(month?: string): Promise<Result<FixedExpensesStatusResponseDto>>;
  abstract payRecurringExpense(
    ref: string,
    dto: PayRecurringExpenseDto,
  ): Promise<Result<ExpenseEntity>>;
}
