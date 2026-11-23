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
import { PayInstallmentDto } from '../dtos/pay-installment.dto';
import { UpdateInstallmentDto } from '../dtos/update-expense.dto';
import { MonthlyInstallmentsSummaryDto } from '../dtos/installment-summary.dto';
import { UpcomingDueDto } from '../dtos/financial-summary.dto';
import { ErrorMapperToHttp } from '../../../../common/errors/error.mapper';

@Controller('installments')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class InstallmentsController {
  constructor(private readonly expensesService: IExpensesService) {}

  @Get('upcoming')
  async getUpcomingInstallments(@Query('days') days?: number): Promise<UpcomingDueDto[]> {
    const targetDays = days ? Number(days) : 7;
    const result = await this.expensesService.getUpcomingInstallments(targetDays);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Get('summary')
  async getInstallmentsSummary(
    @Query('month') month?: string,
  ): Promise<MonthlyInstallmentsSummaryDto> {
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const result = await this.expensesService.getMonthlyInstallmentsSummary(targetMonth);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Get('pending')
  async searchPendingInstallments(
    @Query('search') search?: string,
    @Query('dueDate') dueDate?: string,
  ) {
    const result = await this.expensesService.searchPendingInstallments(search, dueDate);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
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

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  async payInstallment(@Param('id') id: string, @Body() dto: PayInstallmentDto) {
    const result = await this.expensesService.payInstallment(
      id,
      dto.paymentMethod,
      dto.bankName,
      dto.notes,
    );
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
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

  @Patch(':id')
  async updateInstallment(@Param('id') id: string, @Body() dto: UpdateInstallmentDto) {
    const result = await this.expensesService.updateInstallment(id, dto);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
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

  @Delete(':id')
  async deleteInstallment(@Param('id') id: string) {
    const result = await this.expensesService.deleteInstallment(id);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }
}
