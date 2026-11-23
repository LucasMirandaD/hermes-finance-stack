import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IExpensesService } from '../../domain/services/i-expenses.service';
import { SetCategoryBudgetDto } from '../dtos/budget.dto';
import { ErrorMapperToHttp } from '../../../../common/errors/error.mapper';

@Controller('budgets')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class BudgetsController {
  constructor(private readonly expensesService: IExpensesService) {}

  @Get()
  async listBudgets(@Query('activeOnly') activeOnly?: string) {
    const result = await this.expensesService.listCategoryBudgets(activeOnly !== 'false');
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async setBudget(@Body() dto: SetCategoryBudgetDto) {
    const result = await this.expensesService.setCategoryBudget(dto);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Get('status')
  async getBudgetStatus(
    @Query('month') month?: string,
    @Query('alertsOnly') alertsOnly?: string,
  ) {
    const result = await this.expensesService.getBudgetStatus(
      month,
      alertsOnly === 'true',
    );
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Delete(':id')
  async deleteBudget(@Param('id') id: string) {
    const result = await this.expensesService.deleteCategoryBudget(id);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }
}
