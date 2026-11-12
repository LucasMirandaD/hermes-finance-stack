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
import { CreateCreditCardDto } from '../dtos/create-credit-card.dto';
import { PayInstallmentDto } from '../dtos/pay-installment.dto';
import {
  UpdateExpenseDto,
  UpdateInstallmentDto,
} from '../dtos/update-expense.dto';
import { ExpenseMapper } from '../mappers/expense.mapper';
import { ErrorMapperToHttp } from '../../../../common/errors/error.mapper';
import { ExpenseResponseDto } from '../dtos/expense-response.dto';
import { MonthlyInstallmentsSummaryDto } from '../dtos/installment-summary.dto';
import {
  FinancialSummaryQueryDto,
  FinancialSummaryResponseDto,
  UpcomingDueDto,
} from '../dtos/financial-summary.dto';
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
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return ExpenseMapper.toPresentation(result.getValue());
  }

  @Get()
  async listExpenses(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<ExpenseResponseDto[]> {
    const result = await this.expensesService.listExpenses(limit, offset);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue().map((exp) => ExpenseMapper.toPresentation(exp));
  }

  @Get('summary')
  async getFinancialSummary(
    @Query() query: FinancialSummaryQueryDto,
  ): Promise<FinancialSummaryResponseDto> {
    const result = await this.expensesService.getFinancialSummary(query);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Get('search')
  async searchExpenses(
    @Query() query: SearchExpensesQueryDto,
  ): Promise<SearchExpensesResponseDto> {
    const result = await this.expensesService.searchExpenses(query);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Get('installments/upcoming')
  async getUpcomingInstallments(
    @Query('days') days?: number,
  ): Promise<UpcomingDueDto[]> {
    const targetDays = days ? Number(days) : 7;
    const result = await this.expensesService.getUpcomingInstallments(targetDays);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Get('installments/summary')
  async getInstallmentsSummary(
    @Query('month') month?: string,
  ): Promise<MonthlyInstallmentsSummaryDto> {
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const result = await this.expensesService.getMonthlyInstallmentsSummary(targetMonth);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Get('installments/pending')
  async searchPendingInstallments(
    @Query('search') search?: string,
    @Query('dueDate') dueDate?: string,
  ) {
    const result = await this.expensesService.searchPendingInstallments(search, dueDate);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue().map((inst) => ({
      id: inst.id,
      expenseId: inst.expenseId,
      merchantName: inst.expense?.merchantName,
      description: inst.expense?.description,
      installmentNumber: inst.installmentNumber,
      totalInstallments: inst.totalInstallments,
      amount: Number(inst.amount),
      dueDate: inst.dueDate,
      status: inst.status,
      notes: inst.notes,
    }));
  }

  @Post('installments/:id/pay')
  @HttpCode(HttpStatus.OK)
  async payInstallment(
    @Param('id') id: string,
    @Body() dto: PayInstallmentDto,
  ) {
    const result = await this.expensesService.payInstallment(
      id,
      dto.paymentMethod,
      dto.bankName,
      dto.notes,
    );
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    const inst = result.getValue();
    return {
      id: inst.id,
      expenseId: inst.expenseId,
      merchantName: inst.expense?.merchantName,
      description: inst.expense?.description,
      installmentNumber: inst.installmentNumber,
      totalInstallments: inst.totalInstallments,
      amount: Number(inst.amount),
      dueDate: inst.dueDate,
      status: inst.status,
      notes: inst.notes,
      paidAt: inst.paidAt,
    };
  }

  @Patch('installments/:id')
  async updateInstallment(
    @Param('id') id: string,
    @Body() dto: UpdateInstallmentDto,
  ) {
    const result = await this.expensesService.updateInstallment(id, dto);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    const inst = result.getValue();
    return {
      id: inst.id,
      expenseId: inst.expenseId,
      merchantName: inst.expense?.merchantName,
      description: inst.expense?.description,
      installmentNumber: inst.installmentNumber,
      totalInstallments: inst.totalInstallments,
      amount: Number(inst.amount),
      dueDate: inst.dueDate,
      status: inst.status,
      notes: inst.notes,
    };
  }

  @Delete('installments/:id')
  async deleteInstallment(@Param('id') id: string) {
    const result = await this.expensesService.deleteInstallment(id);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Get('cards')
  async listCreditCards() {
    const result = await this.expensesService.listCreditCards();
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Post('cards')
  @HttpCode(HttpStatus.CREATED)
  async createCreditCard(@Body() dto: CreateCreditCardDto) {
    const result = await this.expensesService.registerCreditCard(dto);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Get(':id')
  async getExpenseById(@Param('id') id: string): Promise<ExpenseResponseDto> {
    const result = await this.expensesService.getExpenseById(id);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return ExpenseMapper.toPresentation(result.getValue());
  }

  @Patch(':id')
  async updateExpense(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ): Promise<ExpenseResponseDto> {
    const result = await this.expensesService.updateExpense(id, dto);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return ExpenseMapper.toPresentation(result.getValue());
  }

  @Delete(':id')
  async deleteExpense(@Param('id') id: string) {
    const result = await this.expensesService.deleteExpense(id);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }
}
