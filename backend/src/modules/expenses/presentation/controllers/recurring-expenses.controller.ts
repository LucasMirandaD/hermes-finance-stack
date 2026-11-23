import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IExpensesService } from '../../domain/services/i-expenses.service';
import {
  CreateRecurringExpenseDto,
  PayRecurringExpenseDto,
  UpdateRecurringExpenseDto,
} from '../dtos/recurring-expense.dto';
import { ExpenseMapper } from '../mappers/expense.mapper';
import { ErrorMapperToHttp } from '../../../../common/errors/error.mapper';

@Controller('recurring-expenses')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class RecurringExpensesController {
  constructor(private readonly expensesService: IExpensesService) {}

  @Get()
  async listRecurring(@Query('activeOnly') activeOnly?: string) {
    const result = await this.expensesService.listRecurringExpenses(activeOnly !== 'false');
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createRecurring(@Body() dto: CreateRecurringExpenseDto) {
    const result = await this.expensesService.createRecurringExpense(dto);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Get('status')
  async getRecurringStatus(@Query('month') month?: string) {
    const result = await this.expensesService.getFixedExpensesStatus(month);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Post(':ref/pay')
  @HttpCode(HttpStatus.CREATED)
  async payRecurring(@Param('ref') ref: string, @Body() dto: PayRecurringExpenseDto) {
    const result = await this.expensesService.payRecurringExpense(ref, dto);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return ExpenseMapper.toPresentation(result.getValue());
  }

  @Patch(':id')
  async updateRecurring(@Param('id') id: string, @Body() dto: UpdateRecurringExpenseDto) {
    const result = await this.expensesService.updateRecurringExpense(id, dto);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Delete(':id')
  async deleteRecurring(@Param('id') id: string) {
    const result = await this.expensesService.deleteRecurringExpense(id);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }
}
