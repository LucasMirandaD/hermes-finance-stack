import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IOutingsRepository } from './i-outings.repository';
import { OutingEntity } from '../entities/outing.entity';
import { OutingParticipantEntity } from '../entities/outing-participant.entity';
import { OutingExpenseEntity } from '../entities/outing-expense.entity';
import { OutingStatus } from '../../domain/interfaces/outing.interface';

@Injectable()
export class OutingsRepository implements IOutingsRepository {
  constructor(
    @InjectRepository(OutingEntity)
    private readonly outingRepo: Repository<OutingEntity>,
    @InjectRepository(OutingParticipantEntity)
    private readonly participantRepo: Repository<OutingParticipantEntity>,
    @InjectRepository(OutingExpenseEntity)
    private readonly expenseRepo: Repository<OutingExpenseEntity>,
  ) {}

  async saveOuting(outing: Partial<OutingEntity>): Promise<OutingEntity> {
    return this.outingRepo.save(outing);
  }

  async findOutings(status?: OutingStatus): Promise<OutingEntity[]> {
    return this.outingRepo.find({
      where: status ? { status } : {},
      relations: { participants: true, expenses: { paidByParticipant: true } },
      order: { eventDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOutingByRef(ref: string): Promise<OutingEntity | null> {
    const clean = ref?.trim();
    if (!clean) return null;
    const cleanLower = clean.toLowerCase();

    const outings = await this.outingRepo.find({
      relations: { participants: true },
      order: { createdAt: 'DESC' },
    });

    return (
      outings.find((o) => o.id === clean) ||
      outings.find((o) => o.slug.toLowerCase() === cleanLower) ||
      outings.find((o) => o.name.toLowerCase() === cleanLower) ||
      outings.find((o) => o.name.toLowerCase().includes(cleanLower)) ||
      null
    );
  }

  async deleteOuting(id: string): Promise<boolean> {
    const res = await this.outingRepo.delete(id);
    return (res.affected ?? 0) > 0;
  }

  async saveParticipant(
    participant: Partial<OutingParticipantEntity>,
  ): Promise<OutingParticipantEntity> {
    return this.participantRepo.save(participant);
  }

  async findParticipantByRef(
    outingId: string,
    ref: string,
  ): Promise<OutingParticipantEntity | null> {
    const clean = ref?.trim();
    if (!clean) return null;
    const cleanLower = clean.toLowerCase();

    const participants = await this.participantRepo.find({
      where: { outingId },
      order: { createdAt: 'ASC' },
    });

    return (
      participants.find((p) => p.id === clean) ||
      participants.find((p) => p.slug.toLowerCase() === cleanLower) ||
      participants.find((p) => p.name.toLowerCase() === cleanLower) ||
      participants.find((p) =>
        (p.aliases || []).some((a) => String(a).trim().toLowerCase() === cleanLower),
      ) ||
      null
    );
  }

  async countParticipantExpenses(participantId: string): Promise<number> {
    return this.expenseRepo.count({ where: { paidByParticipantId: participantId } });
  }

  async deleteParticipant(id: string): Promise<boolean> {
    const res = await this.participantRepo.delete(id);
    return (res.affected ?? 0) > 0;
  }

  async saveOutingExpense(
    expense: Partial<OutingExpenseEntity>,
  ): Promise<OutingExpenseEntity> {
    return this.expenseRepo.save(expense);
  }

  async findOutingExpenses(outingId: string): Promise<OutingExpenseEntity[]> {
    return this.expenseRepo.find({
      where: { outingId },
      relations: { paidByParticipant: true },
      order: { expenseDate: 'ASC', createdAt: 'ASC' },
    });
  }

  async findOutingExpenseById(id: string): Promise<OutingExpenseEntity | null> {
    return this.expenseRepo.findOne({
      where: { id },
      relations: { paidByParticipant: true },
    });
  }

  async deleteOutingExpense(id: string): Promise<boolean> {
    const res = await this.expenseRepo.delete(id);
    return (res.affected ?? 0) > 0;
  }
}
