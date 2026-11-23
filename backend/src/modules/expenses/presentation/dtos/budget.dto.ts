import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { BudgetScope } from '../../domain/interfaces/category-budget.interface';

export class SetCategoryBudgetDto {
  @IsNotEmpty()
  @IsString()
  category: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  monthlyAmount: number;

  @IsOptional()
  @IsString()
  currency?: string = 'ARS';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  alertThresholdPct?: number = 80;

  @IsOptional()
  @IsEnum(['ALL', 'PERSONAL', 'SHARED'])
  scope?: BudgetScope = 'ALL';

  @IsOptional()
  @IsString()
  memberRef?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export interface BudgetStatusItemDto {
  id: string;
  category: string;
  currency: string;
  scope: BudgetScope;
  memberSlug?: string;
  monthlyBudget: number;
  spent: number;
  remaining: number;
  percentageUsed: number;
  alertThresholdPct: number;
  alertTriggered: boolean;
  exceeded: boolean;
  notes?: string;
}

export interface BudgetStatusResponseDto {
  month: string;
  totalBudgeted: number;
  totalSpent: number;
  alertsCount: number;
  items: BudgetStatusItemDto[];
}
