import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpenseEntity } from './data/entities/expense.entity';
import { CreditCardEntity } from './data/entities/credit-card.entity';
import { ExpenseInstallmentEntity } from './data/entities/expense-installment.entity';
import { IExpensesService } from './domain/services/i-expenses.service';
import { ExpensesService } from './domain/services/expenses.service';
import { IExpensesRepository } from './data/repositories/i-expenses.repository';
import { ExpensesRepository } from './data/repositories/expenses.repository';
import { ExpensesController } from './presentation/controllers/expenses.controller';
import { ExpensesMcpController } from './presentation/mcp/expenses-mcp.controller';
import { PaperlessService } from './infrastructure/paperless.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExpenseEntity,
      CreditCardEntity,
      ExpenseInstallmentEntity,
    ]),
  ],
  controllers: [ExpensesController, ExpensesMcpController],
  providers: [
    PaperlessService,
    {
      provide: IExpensesService,
      useClass: ExpensesService,
    },
    {
      provide: IExpensesRepository,
      useClass: ExpensesRepository,
    },
  ],
  exports: [IExpensesService, IExpensesRepository, PaperlessService],
})
export class ExpensesModule {}
