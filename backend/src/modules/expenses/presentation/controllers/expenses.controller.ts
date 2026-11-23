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
import { CreateMemberDto, UpdateMemberDto } from '../dtos/member.dto';
import { SetCategoryBudgetDto } from '../dtos/budget.dto';
import {
  CreateRecurringExpenseDto,
  PayRecurringExpenseDto,
  UpdateRecurringExpenseDto,
} from '../dtos/recurring-expense.dto';
import { ChartType } from '../../infrastructure/chart.service';
import { ExportFormat } from '../../infrastructure/export.service';
import { ExpenseScope } from '../../domain/interfaces/expense.interface';

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

  @Get('compare')
  async compareMonths(
    @Query('monthA') monthA: string,
    @Query('monthB') monthB: string,
    @Query('scope') scope?: 'ALL' | ExpenseScope,
    @Query('memberRef') memberRef?: string,
  ) {
    const result = await this.expensesService.compareMonths(monthA, monthB, scope, memberRef);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Get('top')
  async getTopExpenses(
    @Query('month') month?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('category') category?: string,
    @Query('scope') scope?: 'ALL' | ExpenseScope,
    @Query('memberRef') memberRef?: string,
    @Query('limit') limit?: number,
  ) {
    const result = await this.expensesService.getTopExpenses({
      month,
      startDate,
      endDate,
      category,
      scope,
      memberRef,
      limit: limit ? Number(limit) : undefined,
    });
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Get('export')
  async exportExpenses(
    @Query('format') format?: ExportFormat,
    @Query('month') month?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('category') category?: string,
    @Query('scope') scope?: 'ALL' | ExpenseScope,
    @Query('memberRef') memberRef?: string,
  ) {
    const result = await this.expensesService.exportExpenses({
      format,
      month,
      startDate,
      endDate,
      category,
      scope,
      memberRef,
    });
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Get('charts/render')
  async renderChart(
    @Query('chartType') chartType: ChartType = 'by_category',
    @Query('month') month?: string,
    @Query('year') year?: number,
    @Query('scope') scope?: 'ALL' | ExpenseScope,
    @Query('memberRef') memberRef?: string,
  ) {
    const result = await this.expensesService.renderChart({
      chartType,
      month,
      year: year ? Number(year) : undefined,
      scope,
      memberRef,
    });
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  // --- Members & Shared ---

  @Get('members')
  async listMembers(@Query('activeOnly') activeOnly?: string) {
    const result = await this.expensesService.listMembers(activeOnly !== 'false');
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Post('members')
  @HttpCode(HttpStatus.CREATED)
  async createMember(@Body() dto: CreateMemberDto) {
    const result = await this.expensesService.createMember(dto);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Patch('members/:ref')
  async updateMember(@Param('ref') ref: string, @Body() dto: UpdateMemberDto) {
    const result = await this.expensesService.updateMember(ref, dto);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Delete('members/:ref')
  async deleteMember(@Param('ref') ref: string) {
    const result = await this.expensesService.deleteMember(ref);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Get('shared/balance')
  async getSharedBalance(
    @Query('month') month?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const result = await this.expensesService.getSharedBalance({ month, startDate, endDate });
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  // --- Budgets ---

  @Get('budgets')
  async listBudgets(@Query('activeOnly') activeOnly?: string) {
    const result = await this.expensesService.listCategoryBudgets(activeOnly !== 'false');
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Post('budgets')
  @HttpCode(HttpStatus.OK)
  async setBudget(@Body() dto: SetCategoryBudgetDto) {
    const result = await this.expensesService.setCategoryBudget(dto);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Get('budgets/status')
  async getBudgetStatus(
    @Query('month') month?: string,
    @Query('alertsOnly') alertsOnly?: string,
  ) {
    const result = await this.expensesService.getBudgetStatus(month, alertsOnly === 'true');
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Delete('budgets/:id')
  async deleteBudget(@Param('id') id: string) {
    const result = await this.expensesService.deleteCategoryBudget(id);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  // --- Recurring / Fixed Expenses ---

  @Get('recurring')
  async listRecurring(@Query('activeOnly') activeOnly?: string) {
    const result = await this.expensesService.listRecurringExpenses(activeOnly !== 'false');
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Post('recurring')
  @HttpCode(HttpStatus.CREATED)
  async createRecurring(@Body() dto: CreateRecurringExpenseDto) {
    const result = await this.expensesService.createRecurringExpense(dto);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Get('recurring/status')
  async getRecurringStatus(@Query('month') month?: string) {
    const result = await this.expensesService.getFixedExpensesStatus(month);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Post('recurring/:ref/pay')
  @HttpCode(HttpStatus.CREATED)
  async payRecurring(@Param('ref') ref: string, @Body() dto: PayRecurringExpenseDto) {
    const result = await this.expensesService.payRecurringExpense(ref, dto);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return ExpenseMapper.toPresentation(result.getValue());
  }

  @Patch('recurring/:id')
  async updateRecurring(@Param('id') id: string, @Body() dto: UpdateRecurringExpenseDto) {
    const result = await this.expensesService.updateRecurringExpense(id, dto);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Delete('recurring/:id')
  async deleteRecurring(@Param('id') id: string) {
    const result = await this.expensesService.deleteRecurringExpense(id);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  // --- Installments & Cards ---

  @Get('installments/upcoming')
  async getUpcomingInstallments(@Query('days') days?: number): Promise<UpcomingDueDto[]> {
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
  async payInstallment(@Param('id') id: string, @Body() dto: PayInstallmentDto) {
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
  async updateInstallment(@Param('id') id: string, @Body() dto: UpdateInstallmentDto) {
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

  // --- Parameterized :id routes MUST remain last ---

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
