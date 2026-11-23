import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutingEntity } from './data/entities/outing.entity';
import { OutingParticipantEntity } from './data/entities/outing-participant.entity';
import { OutingExpenseEntity } from './data/entities/outing-expense.entity';
import { IOutingsRepository } from './data/repositories/i-outings.repository';
import { OutingsRepository } from './data/repositories/outings.repository';
import { IOutingsService } from './domain/services/i-outings.service';
import { OutingsService } from './domain/services/outings.service';
import { OutingsController } from './presentation/controllers/outings.controller';
import { ExpensesModule } from '../expenses/expenses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OutingEntity,
      OutingParticipantEntity,
      OutingExpenseEntity,
    ]),
    ExpensesModule,
  ],
  controllers: [OutingsController],
  providers: [
    {
      provide: IOutingsRepository,
      useClass: OutingsRepository,
    },
    {
      provide: IOutingsService,
      useClass: OutingsService,
    },
  ],
  exports: [IOutingsService, IOutingsRepository],
})
export class OutingsModule {}
