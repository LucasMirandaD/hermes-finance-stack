import { IsOptional, IsString, Matches } from 'class-validator';

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
  comparison: PeriodComparisonDto;
  upcomingDue: UpcomingDueDto[];
}
