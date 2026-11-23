import { OutingEntity } from '../entities/outing.entity';
import { OutingParticipantEntity } from '../entities/outing-participant.entity';
import { OutingExpenseEntity } from '../entities/outing-expense.entity';
import { OutingStatus } from '../../domain/interfaces/outing.interface';

export abstract class IOutingsRepository {
  abstract saveOuting(outing: Partial<OutingEntity>): Promise<OutingEntity>;
  abstract findOutings(status?: OutingStatus): Promise<OutingEntity[]>;
  abstract findOutingByRef(ref: string): Promise<OutingEntity | null>;
  abstract deleteOuting(id: string): Promise<boolean>;

  abstract saveParticipant(
    participant: Partial<OutingParticipantEntity>,
  ): Promise<OutingParticipantEntity>;
  abstract findParticipantByRef(
    outingId: string,
    ref: string,
  ): Promise<OutingParticipantEntity | null>;
  abstract countParticipantExpenses(participantId: string): Promise<number>;
  abstract deleteParticipant(id: string): Promise<boolean>;

  abstract saveOutingExpense(
    expense: Partial<OutingExpenseEntity>,
  ): Promise<OutingExpenseEntity>;
  abstract findOutingExpenses(outingId: string): Promise<OutingExpenseEntity[]>;
  abstract findOutingExpenseById(id: string): Promise<OutingExpenseEntity | null>;
  abstract deleteOutingExpense(id: string): Promise<boolean>;
}
