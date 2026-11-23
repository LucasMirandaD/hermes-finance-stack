import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IExpensesService } from '../../domain/services/i-expenses.service';
import { CreateCreditCardDto } from '../dtos/create-credit-card.dto';
import { ErrorMapperToHttp } from '../../../../common/errors/error.mapper';

@Controller('credit-cards')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CreditCardsController {
  constructor(private readonly expensesService: IExpensesService) {}

  @Get()
  async listCreditCards() {
    const result = await this.expensesService.listCreditCards();
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCreditCard(@Body() dto: CreateCreditCardDto) {
    const result = await this.expensesService.registerCreditCard(dto);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }
}
