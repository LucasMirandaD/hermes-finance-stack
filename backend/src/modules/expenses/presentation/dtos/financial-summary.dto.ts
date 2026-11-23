import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export class FinancialSummaryQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be in YYYY-MM-DD format' })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be in YYYY-MM-DD format' })
  endDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month must be in YYYY-MM format' })
  month?: string;

  @IsOptional()
  @IsEnum(['ALL', 'PERSONAL', 'SHARED'])
  scope?: 'ALL' | 'PERSONAL' | 'SHARED';

  @IsOptional()
  @IsString()
  memberRef?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === true || value === 'true',
  )
  @IsBoolean()
  isFixed?: boolean;
}

export interface CategoryBreakdownDto {
  category: string;
  amount: number;
  percentage: number;
}

export interface BankBreakdownDto {
  bank: string;
  amount: number;
  percentage: number;
}

export interface HolderBreakdownDto {
  holderName: string;
  paidAmount: number;
  pendingAmount: number;
  totalAmount: number;
  percentage: number;
}

export interface FixedVsVariableDto {
  fixedPaid: number;
  variablePaid: number;
  fixedPercentage: number;
  variablePercentage: number;
}

export interface TopExpenseSummaryItemDto {
  id: string;
  date: string;
  merchantName: string;
  description: string;
  amount: number;
  category: string;
  scope: string;
  isFixed: boolean;
  holderName: string;
}

export interface BudgetAlertItemDto {
  category: string;
  monthlyBudget: number;
  spent: number;
  percentageUsed: number;
  alertThresholdPct: number;
  exceeded: boolean;
}

export interface PeriodComparisonDto {
  previousStartDate: string;
  previousEndDate: string;
  previousTotalPaid: number;
  diffAmount: number;
  diffPercentage: number;
  trend: 'UP' | 'DOWN' | 'EQUAL';
}

export interface UpcomingDueDto {
  id: string;
  expenseId: string;
  merchantName: string;
  description: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: number;
  dueDate: string;
  bank?: string;
  holderName?: string;
}

export interface FinancialSummaryResponseDto {
  startDate: string;
  endDate: string;
  periodLabel: string;
  totalPaid: number;
  paidTransactionsCount: number;
  totalPending: number;
  pendingTransactionsCount: number;
  byCategory: CategoryBreakdownDto[];
  byBank: BankBreakdownDto[];
  byHolder: HolderBreakdownDto[];
  fixedVsVariable: FixedVsVariableDto;
  topExpenses: TopExpenseSummaryItemDto[];
  budgetAlerts: BudgetAlertItemDto[];
  comparison: PeriodComparisonDto;
  upcomingDue: UpcomingDueDto[];
}
