import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '../../../expenses/domain/interfaces/expense.interface';
import { OutingStatus } from '../../domain/interfaces/outing.interface';
import {
  IOutingExpenseShare,
  OutingSplitMode,
} from '../../domain/interfaces/outing-expense.interface';

export class CreateOutingDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'eventDate must match YYYY-MM-DD format',
  })
  eventDate?: string;

  @IsOptional()
  @IsString()
  currency?: string = 'ARS';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participants?: string[];

  @IsOptional()
  @IsString()
  createdBy?: string;
}

export class AddOutingParticipantDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];
}

export class OutingCustomShareInputDto {
  @IsNotEmpty()
  @IsString()
  participant: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  percentage?: number;
}

export class AddOutingExpenseDto {
  @IsNotEmpty()
  @IsString()
  paidBy: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @IsOptional()
  @IsString()
  merchantName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'expenseDate must match YYYY-MM-DD format',
  })
  expenseDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  splitBetween?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OutingCustomShareInputDto)
  customShares?: OutingCustomShareInputDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  autoAddParticipants?: boolean = true;
}

export class SettleOutingDto {
  @IsOptional()
  @IsString()
  recordPersonalExpenseFor?: string;

  @IsOptional()
  @IsEnum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'MERCADO_PAGO'])
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  category?: string;
}

export interface OutingParticipantResponseDto {
  id: string;
  name: string;
  slug: string;
  memberId?: string;
  aliases: string[];
}

export interface OutingExpenseResponseDto {
  id: string;
  outingId: string;
  paidByParticipantId: string;
  paidByName: string;
  paidBySlug: string;
  description: string;
  merchantName?: string;
  amount: number;
  expenseDate: string;
  splitMode: OutingSplitMode;
  shares: IOutingExpenseShare[];
  notes?: string;
  createdAt: Date;
}

export interface OutingSummaryResponseDto {
  id: string;
  slug: string;
  name: string;
  description?: string;
  eventDate: string;
  currency: string;
  status: OutingStatus;
  participantsCount: number;
  expensesCount: number;
  totalSpent: number;
  participants: OutingParticipantResponseDto[];
  createdAt: Date;
}

export interface OutingParticipantBalanceDto {
  participantId: string;
  slug: string;
  name: string;
  totalPaid: number;
  totalShare: number;
  netBalance: number;
}

export interface OutingSettlementDto {
  fromParticipantId: string;
  fromSlug: string;
  fromName: string;
  toParticipantId: string;
  toSlug: string;
  toName: string;
  amount: number;
}

export interface OutingBalanceResponseDto {
  outing: {
    id: string;
    slug: string;
    name: string;
    eventDate: string;
    currency: string;
    status: OutingStatus;
  };
  totalSpent: number;
  expensesCount: number;
  participantsCount: number;
  perPersonAverage: number;
  participants: OutingParticipantBalanceDto[];
  settlements: OutingSettlementDto[];
  expenses: OutingExpenseResponseDto[];
}
