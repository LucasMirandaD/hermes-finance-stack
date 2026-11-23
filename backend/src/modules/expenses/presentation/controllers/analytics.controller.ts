import { Controller, Get, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { IExpensesService } from '../../domain/services/i-expenses.service';
import {
  FinancialSummaryQueryDto,
  FinancialSummaryResponseDto,
} from '../dtos/financial-summary.dto';
import { ChartType } from '../../infrastructure/chart.service';
import { ExportFormat } from '../../infrastructure/export.service';
import { ExpenseScope } from '../../domain/interfaces/expense.interface';
import { ErrorMapperToHttp } from '../../../../common/errors/error.mapper';

@Controller('analytics')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AnalyticsController {
  constructor(private readonly expensesService: IExpensesService) {}

  @Get('summary')
  async getFinancialSummary(
    @Query() query: FinancialSummaryQueryDto,
  ): Promise<FinancialSummaryResponseDto> {
    const result = await this.expensesService.getFinancialSummary(query);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Get('compare')
  async compareMonths(
    @Query('monthA') monthA: string,
    @Query('monthB') monthB: string,
    @Query('scope') scope?: 'ALL' | ExpenseScope,
    @Query('memberRef') memberRef?: string,
  ) {
    const result = await this.expensesService.compareMonths(
      monthA,
      monthB,
      scope,
      memberRef,
    );
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
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
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
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
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
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
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }
}
