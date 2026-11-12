import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateCreditCardDto {
  @IsNotEmpty()
  @IsString()
  bank: string;

  @IsNotEmpty()
  @IsString()
  cardName: string;

  @IsOptional()
  @IsString()
  @Length(4, 4)
  lastFourDigits?: string;

  @IsBoolean()
  @IsOptional()
  isExtension?: boolean = false;

  @IsNotEmpty()
  @IsString()
  holderName: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  closingDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;
}
