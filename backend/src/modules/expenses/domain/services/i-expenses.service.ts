import { Result } from '../../../../common/errors/result.mapper';
import { BaseError } from '../../../../common/errors/errors';
import { CreateExpenseDto } from '../../presentation/dtos/create-expense.dto';
import { CreateCreditCardDto } from '../../presentation/dtos/create-credit-card.dto';
import { ExpenseEntity } from '../../data/entities/expense.entity';
import { CreditCardEntity } from '../../data/entities/credit-card.entity';
import { ExpenseInstallmentEntity } from '../../data/entities/expense-installment.entity';
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

export abstract class IExpensesService {
  abstract registerExpense(dto: CreateExpenseDto): Promise<Result<ExpenseEntity>>;
  abstract getExpenseById(id: string): Promise<Result<ExpenseEntity>>;
  abstract listExpenses(limit?: number, offset?: number): Promise<Result<ExpenseEntity[]>>;
  abstract registerCreditCard(dto: CreateCreditCardDto): Promise<Result<CreditCardEntity>>;
  abstract listCreditCards(): Promise<Result<CreditCardEntity[]>>;
  abstract getMonthlyInstallmentsSummary(yearMonth: string): Promise<Result<MonthlyInstallmentsSummaryDto>>;
  abstract searchPendingInstallments(query?: string, dueDate?: string): Promise<Result<ExpenseInstallmentEntity[]>>;
  abstract payInstallment(id: string, paymentMethod?: string, bankName?: string, notes?: string): Promise<Result<ExpenseInstallmentEntity>>;
  abstract getFinancialSummary(query: FinancialSummaryQueryDto): Promise<Result<FinancialSummaryResponseDto>>;
  abstract searchExpenses(query: SearchExpensesQueryDto): Promise<Result<SearchExpensesResponseDto>>;
  abstract getUpcomingInstallments(days?: number): Promise<Result<UpcomingDueDto[]>>;
  abstract updateExpense(id: string, dto: UpdateExpenseDto): Promise<Result<ExpenseEntity>>;
  abstract deleteExpense(id: string): Promise<Result<{ deleted: boolean; id: string }>>;
  abstract updateInstallment(id: string, dto: UpdateInstallmentDto): Promise<Result<ExpenseInstallmentEntity>>;
  abstract deleteInstallment(id: string): Promise<Result<{ deleted: boolean; id: string; expenseDeleted?: boolean }>>;
}
