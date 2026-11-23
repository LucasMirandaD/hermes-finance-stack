import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExpenseScope, PaymentMethod } from '../../domain/interfaces/expense.interface';
import { ExpenseAllocationInputDto } from './create-expense.dto';

export class UpdateExpenseDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  totalAmount?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  merchantName?: string;

  @IsOptional()
  @IsString()
  category?: string;

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
  @IsBoolean()
  isFixed?: boolean;

  @IsOptional()
  @IsString()
  paidBy?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseAllocationInputDto)
  allocations?: ExpenseAllocationInputDto[];
}

export class UpdateInstallmentDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dueDate must match YYYY-MM-DD format',
  })
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
