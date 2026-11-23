import { ExpenseEntity } from '../entities/expense.entity';
import { CreditCardEntity } from '../entities/credit-card.entity';
import { ExpenseInstallmentEntity } from '../entities/expense-installment.entity';
import { MemberEntity } from '../entities/member.entity';
import { ExpenseAllocationEntity } from '../entities/expense-allocation.entity';
import { CategoryBudgetEntity } from '../entities/category-budget.entity';
import { RecurringExpenseEntity } from '../entities/recurring-expense.entity';
import { BudgetScope } from '../../domain/interfaces/category-budget.interface';

export interface DatabaseHealthStats {
  connected: boolean;
  counts: {
    expenses: number;
    creditCards: number;
    members: number;
    recurringExpenses: number;
    budgets: number;
  };
}

export abstract class IExpensesRepository {
  abstract checkDatabaseHealth(): Promise<DatabaseHealthStats>;

  // Expenses
  abstract saveExpense(expense: Partial<ExpenseEntity>): Promise<ExpenseEntity>;
  abstract findExpenseById(id: string): Promise<ExpenseEntity | null>;
  abstract findExpenses(limit?: number, offset?: number): Promise<ExpenseEntity[]>;
  abstract findExpensesByDateRange(
    startDate: string,
    endDate: string,
    isInstallment?: boolean,
  ): Promise<ExpenseEntity[]>;
  abstract searchExpensesAndInstallments(
    searchTerm?: string,
    category?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{ expenses: ExpenseEntity[]; installments: ExpenseInstallmentEntity[] }>;
  abstract deleteExpense(id: string): Promise<boolean>;
  abstract updateExpensePaperlessId(id: string, paperlessDocumentId: number): Promise<void>;

  // Installments
  abstract findInstallmentsByDueDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ExpenseInstallmentEntity[]>;
  abstract findPendingInstallments(creditCardId?: string): Promise<ExpenseInstallmentEntity[]>;
  abstract findInstallmentById(id: string): Promise<ExpenseInstallmentEntity | null>;
  abstract saveInstallment(installment: ExpenseInstallmentEntity): Promise<ExpenseInstallmentEntity>;
  abstract searchPendingInstallments(
    query?: string,
    dueDate?: string,
  ): Promise<ExpenseInstallmentEntity[]>;
  abstract findPaidInstallmentsByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ExpenseInstallmentEntity[]>;
  abstract findPendingInstallmentsByDueDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ExpenseInstallmentEntity[]>;
  abstract findUpcomingPendingInstallments(days: number): Promise<ExpenseInstallmentEntity[]>;
  abstract deleteInstallment(id: string): Promise<boolean>;

  // Credit Cards
  abstract saveCreditCard(card: Partial<CreditCardEntity>): Promise<CreditCardEntity>;
  abstract findCreditCards(): Promise<CreditCardEntity[]>;
  abstract findCreditCardById(id: string): Promise<CreditCardEntity | null>;
  abstract findCreditCardByDetails(
    bank: string,
    cardName: string,
    holderName?: string,
  ): Promise<CreditCardEntity | null>;

  // Members & Shared Allocations
  abstract saveMember(member: Partial<MemberEntity>): Promise<MemberEntity>;
  abstract findMembers(activeOnly?: boolean): Promise<MemberEntity[]>;
  abstract findMemberByRef(ref: string): Promise<MemberEntity | null>;
  abstract deleteMember(id: string): Promise<boolean>;
  abstract countMemberReferences(memberId: string): Promise<number>;
  abstract replaceExpenseAllocations(
    expenseId: string,
    allocations: Array<Partial<ExpenseAllocationEntity>>,
  ): Promise<void>;
  abstract findSharedDirectExpenses(
    startDate?: string,
    endDate?: string,
  ): Promise<ExpenseEntity[]>;
  abstract findSharedPaidInstallments(
    startDate?: string,
    endDate?: string,
  ): Promise<ExpenseInstallmentEntity[]>;

  // Budgets
  abstract saveBudget(budget: Partial<CategoryBudgetEntity>): Promise<CategoryBudgetEntity>;
  abstract findBudgets(activeOnly?: boolean): Promise<CategoryBudgetEntity[]>;
  abstract findBudgetById(id: string): Promise<CategoryBudgetEntity | null>;
  abstract findBudgetByMatch(
    category: string,
    currency: string,
    scope: BudgetScope,
    memberId?: string,
  ): Promise<CategoryBudgetEntity | null>;
  abstract deleteBudget(id: string): Promise<boolean>;

  // Recurring / Fixed Expenses
  abstract saveRecurringExpense(
    recurring: Partial<RecurringExpenseEntity>,
  ): Promise<RecurringExpenseEntity>;
  abstract findRecurringExpenses(activeOnly?: boolean): Promise<RecurringExpenseEntity[]>;
  abstract findRecurringExpenseById(id: string): Promise<RecurringExpenseEntity | null>;
  abstract deleteRecurringExpense(id: string): Promise<boolean>;
  abstract findFixedExpensesInDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ExpenseEntity[]>;
}
