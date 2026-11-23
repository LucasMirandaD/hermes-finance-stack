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
import { CreateExpenseDto } from '../dtos/create-expense.dto';
import { UpdateExpenseDto } from '../dtos/update-expense.dto';
import { ExpenseMapper } from '../mappers/expense.mapper';
import { ErrorMapperToHttp } from '../../../../common/errors/error.mapper';
import { ExpenseResponseDto } from '../dtos/expense-response.dto';
import {
  SearchExpensesQueryDto,
  SearchExpensesResponseDto,
} from '../dtos/search-expenses.dto';

@Controller('expenses')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ExpensesController {
  constructor(private readonly expensesService: IExpensesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createExpense(@Body() dto: CreateExpenseDto): Promise<ExpenseResponseDto> {
    const result = await this.expensesService.registerExpense(dto);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return ExpenseMapper.toPresentation(result.getValue());
  }

  @Get()
  async listExpenses(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<ExpenseResponseDto[]> {
    const result = await this.expensesService.listExpenses(limit, offset);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue().map((exp) => ExpenseMapper.toPresentation(exp));
  }

  @Get('search')
  async searchExpenses(
    @Query() query: SearchExpensesQueryDto,
  ): Promise<SearchExpensesResponseDto> {
    const result = await this.expensesService.searchExpenses(query);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Get(':id')
  async getExpenseById(@Param('id') id: string): Promise<ExpenseResponseDto> {
    const result = await this.expensesService.getExpenseById(id);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return ExpenseMapper.toPresentation(result.getValue());
  }

  @Patch(':id')
  async updateExpense(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ): Promise<ExpenseResponseDto> {
    const result = await this.expensesService.updateExpense(id, dto);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return ExpenseMapper.toPresentation(result.getValue());
  }

  @Delete(':id')
  async deleteExpense(@Param('id') id: string) {
    const result = await this.expensesService.deleteExpense(id);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }
}
