import { ExpenseScope } from '../../domain/interfaces/expense.interface';
import { ChartType } from '../../infrastructure/chart.service';
import { ExportFormat } from '../../infrastructure/export.service';

export interface HealthCheckResponseDto {
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
  database: {
    connected: boolean;
    counts: {
      expenses: number;
      creditCards: number;
      members: number;
      recurringExpenses: number;
      budgets: number;
    };
  };
  optionalServices: {
    paperless: {
      enabled: boolean;
      status: 'disabled' | 'ok' | 'unreachable';
    };
  };
}

export interface MonthCategoryDeltaDto {
  category: string;
  amountA: number;
  amountB: number;
  diffAmount: number;
  diffPercentage: number;
}

export interface CompareMonthsResponseDto {
  monthA: string;
  monthB: string;
  totalA: number;
  totalB: number;
  diffAmount: number; // B - A
  diffPercentage: number;
  trend: 'UP' | 'DOWN' | 'EQUAL';
  byCategory: MonthCategoryDeltaDto[];
}

export interface TopExpenseItemDto {
  rank: number;
  id: string;
  type: 'EXPENSE' | 'INSTALLMENT';
  date: string;
  merchantName: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  scope: string;
  isFixed: boolean;
  bank?: string;
  holderName: string;
  installmentInfo?: string;
}

export interface TopExpensesResponseDto {
  periodLabel: string;
  startDate: string;
  endDate: string;
  totalMatched: number;
  items: TopExpenseItemDto[];
}

export interface ExportExpensesQueryInput {
  format?: ExportFormat;
  month?: string;
  startDate?: string;
  endDate?: string;
  category?: string;
  scope?: 'ALL' | ExpenseScope;
  memberRef?: string;
  isFixed?: boolean;
}

export interface RenderChartQueryInput {
  chartType: ChartType;
  month?: string;
  year?: number;
  scope?: 'ALL' | ExpenseScope;
  memberRef?: string;
  limit?: number;
}
