import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpenseEntity } from './data/entities/expense.entity';
import { CreditCardEntity } from './data/entities/credit-card.entity';
import { ExpenseInstallmentEntity } from './data/entities/expense-installment.entity';
import { MemberEntity } from './data/entities/member.entity';
import { ExpenseAllocationEntity } from './data/entities/expense-allocation.entity';
import { CategoryBudgetEntity } from './data/entities/category-budget.entity';
import { RecurringExpenseEntity } from './data/entities/recurring-expense.entity';
import { IExpensesService } from './domain/services/i-expenses.service';
import { ExpensesService } from './domain/services/expenses.service';
import { IExpensesRepository } from './data/repositories/i-expenses.repository';
import { ExpensesRepository } from './data/repositories/expenses.repository';
import { ExpensesController } from './presentation/controllers/expenses.controller';
import { InstallmentsController } from './presentation/controllers/installments.controller';
import { CreditCardsController } from './presentation/controllers/credit-cards.controller';
import { MembersController } from './presentation/controllers/members.controller';
import { BudgetsController } from './presentation/controllers/budgets.controller';
import { RecurringExpensesController } from './presentation/controllers/recurring-expenses.controller';
import { AnalyticsController } from './presentation/controllers/analytics.controller';
import { PaperlessService } from './infrastructure/paperless.service';
import { ChartService } from './infrastructure/chart.service';
import { ExportService } from './infrastructure/export.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExpenseEntity,
      CreditCardEntity,
      ExpenseInstallmentEntity,
      MemberEntity,
      ExpenseAllocationEntity,
      CategoryBudgetEntity,
      RecurringExpenseEntity,
    ]),
  ],
  controllers: [
    ExpensesController,
    InstallmentsController,
    CreditCardsController,
    MembersController,
    BudgetsController,
    RecurringExpensesController,
    AnalyticsController,
  ],
  providers: [
    PaperlessService,
    ChartService,
    ExportService,
    {
      provide: IExpensesService,
      useClass: ExpensesService,
    },
    {
      provide: IExpensesRepository,
      useClass: ExpensesRepository,
    },
  ],
  exports: [
    IExpensesService,
    IExpensesRepository,
    PaperlessService,
    ChartService,
    ExportService,
  ],
})
export class ExpensesModule {}
