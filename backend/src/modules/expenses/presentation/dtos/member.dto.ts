import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMemberDto {
  @IsNotEmpty()
  @IsString()
  displayName: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  telegramUsername?: string;

  @IsOptional()
  @IsString()
  telegramId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];
}

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  telegramUsername?: string;

  @IsOptional()
  @IsString()
  telegramId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export interface MemberResponseDto {
  id: string;
  slug: string;
  displayName: string;
  telegramUsername?: string;
  telegramId?: string;
  aliases: string[];
  isActive: boolean;
  createdAt: Date;
}

export interface MemberBalanceItemDto {
  memberId: string;
  slug: string;
  displayName: string;
  totalPaid: number;
  totalAttributed: number;
  netBalance: number; // positive = owed money by others; negative = owes money
}

export interface SettlementSuggestionDto {
  fromMemberId: string;
  fromSlug: string;
  fromDisplayName: string;
  toMemberId: string;
  toSlug: string;
  toDisplayName: string;
  amount: number;
}

export interface SharedBalanceResponseDto {
  periodLabel: string;
  startDate?: string;
  endDate?: string;
  totalShared: number;
  expensesCount: number;
  members: MemberBalanceItemDto[];
  settlements: SettlementSuggestionDto[];
}
