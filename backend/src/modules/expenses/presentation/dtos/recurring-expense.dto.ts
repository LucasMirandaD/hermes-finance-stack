import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ExpenseScope, PaymentMethod } from '../../domain/interfaces/expense.interface';
import { RecurringFrequency } from '../../domain/interfaces/recurring-expense.interface';
import { ExpenseAllocationInputDto } from './create-expense.dto';

export class CreateRecurringExpenseDto {
  @IsNotEmpty()
  @IsString()
  merchantName: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  category?: string = 'IMPUESTOS_Y_SERVICIOS';

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  estimatedAmount: number;

  @IsOptional()
  @IsString()
  currency?: string = 'ARS';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  @Type(() => Number)
  dayOfMonth?: number = 10;

  @IsOptional()
  @IsEnum(['MONTHLY', 'BIMONTHLY', 'YEARLY'])
  frequency?: RecurringFrequency = 'MONTHLY';

  @IsOptional()
  @IsEnum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'MERCADO_PAGO'])
  paymentMethod?: PaymentMethod = 'BANK_TRANSFER';

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  cardBank?: string;

  @IsOptional()
  @IsString()
  cardName?: string;

  @IsOptional()
  @IsString()
  cardHolder?: string;

  @IsOptional()
  @IsEnum(['PERSONAL', 'SHARED'])
  scope?: ExpenseScope = 'PERSONAL';

  @IsOptional()
  @IsString()
  paidBy?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseAllocationInputDto)
  allocations?: ExpenseAllocationInputDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateRecurringExpenseDto {
  @IsOptional()
  @IsString()
  merchantName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  estimatedAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  @Type(() => Number)
  dayOfMonth?: number;

  @IsOptional()
  @IsEnum(['MONTHLY', 'BIMONTHLY', 'YEARLY'])
  frequency?: RecurringFrequency;

  @IsOptional()
  @IsEnum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'MERCADO_PAGO'])
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsEnum(['PERSONAL', 'SHARED'])
  scope?: ExpenseScope;

  @IsOptional()
  @IsString()
  paidBy?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseAllocationInputDto)
  allocations?: ExpenseAllocationInputDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PayRecurringExpenseDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'expenseDate must match YYYY-MM-DD format',
  })
  expenseDate?: string;

  @IsOptional()
  @IsEnum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'MERCADO_PAGO'])
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  paidBy?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export interface FixedExpenseStatusItemDto {
  recurringId: string;
  merchantName: string;
  description: string;
  category: string;
  estimatedAmount: number;
  currency: string;
  dayOfMonth: number;
  frequency: RecurringFrequency;
  scope: ExpenseScope;
  paymentMethod: PaymentMethod;
  bankName?: string;
  status: 'PAID' | 'PENDING' | 'OVERDUE';
  paidExpenseId?: string;
  paidAmount?: number;
  paidDate?: string;
}

export interface FixedExpensesStatusResponseDto {
  month: string;
  totalEstimated: number;
  totalPaid: number;
  totalPendingEstimated: number;
  paidCount: number;
  pendingCount: number;
  items: FixedExpenseStatusItemDto[];
}
