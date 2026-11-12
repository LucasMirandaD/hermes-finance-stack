import { IsOptional, IsString } from 'class-validator';

export class SearchExpensesQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export interface SearchExpenseItemDto {
  id: string;
  type: 'EXPENSE' | 'INSTALLMENT';
  date: string;
  merchantName: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  paymentMethod: string;
  bank?: string;
  status: string; // 'PAID' | 'PENDING'
  installmentInfo?: string; // e.g. "Cuota 1/2"
}

export interface SearchExpensesResponseDto {
  query?: string;
  category?: string;
  totalMatches: number;
  totalAmount: number;
  items: SearchExpenseItemDto[];
}
