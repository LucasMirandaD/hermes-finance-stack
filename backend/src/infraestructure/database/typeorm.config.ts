import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ExpenseEntity } from '../../modules/expenses/data/entities/expense.entity';
import { CreditCardEntity } from '../../modules/expenses/data/entities/credit-card.entity';
import { ExpenseInstallmentEntity } from '../../modules/expenses/data/entities/expense-installment.entity';
import { MemberEntity } from '../../modules/expenses/data/entities/member.entity';
import { ExpenseAllocationEntity } from '../../modules/expenses/data/entities/expense-allocation.entity';
import { CategoryBudgetEntity } from '../../modules/expenses/data/entities/category-budget.entity';
import { RecurringExpenseEntity } from '../../modules/expenses/data/entities/recurring-expense.entity';
import { OutingEntity } from '../../modules/outings/data/entities/outing.entity';
import { OutingParticipantEntity } from '../../modules/outings/data/entities/outing-participant.entity';
import { OutingExpenseEntity } from '../../modules/outings/data/entities/outing-expense.entity';

export const typeOrmAsyncConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => ({
    type: 'postgres',
    host: configService.get<string>('DB_HOST'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get<string>('DB_USER'),
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_NAME'),
    entities: [
      ExpenseEntity,
      CreditCardEntity,
      ExpenseInstallmentEntity,
      MemberEntity,
      ExpenseAllocationEntity,
      CategoryBudgetEntity,
      RecurringExpenseEntity,
      OutingEntity,
      OutingParticipantEntity,
      OutingExpenseEntity,
    ],
    synchronize: configService.get<boolean>('DB_SYNCHRONIZE', false),
    logging: configService.get<boolean>('DB_LOGGING', false),
  }),
};
