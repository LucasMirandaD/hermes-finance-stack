import { IsOptional, IsString } from 'class-validator';

export class PayInstallmentDto {
  @IsOptional()
  @IsString()
  paymentMethod?: string = 'BANK_TRANSFER';

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
