import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ExpenseSource,
  PaymentMethod,
} from '../../domain/interfaces/expense.interface';

export class CreateExpenseDto {
  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsString()
  merchantName: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  totalAmount: number;

  @IsOptional()
  @IsString()
  currency?: string = 'ARS';

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'expenseDate must match YYYY-MM-DD format',
  })
  expenseDate: string;

  @IsOptional()
  @IsEnum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'MERCADO_PAGO'])
  paymentMethod?: PaymentMethod = 'CREDIT_CARD';

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  creditCardId?: string;

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
  @IsBoolean()
  isInstallment?: boolean = false;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  totalInstallments?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  intervalMonths?: number = 1;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'firstDueDate must match YYYY-MM-DD format',
  })
  firstDueDate?: string;

  @IsOptional()
  @IsString()
  category?: string = 'GENERAL';

  @IsOptional()
  @IsEnum(['PAPERLESS_OCR', 'CHAT_MESSAGE', 'SMS_NOTIFICATION', 'MANUAL'])
  source?: ExpenseSource = 'MANUAL';

  @IsOptional()
  @IsString()
  rawSourceText?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  paperlessDocumentId?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
