import { OutingEntity } from '../../data/entities/outing.entity';
import { OutingExpenseEntity } from '../../data/entities/outing-expense.entity';
import { OutingParticipantEntity } from '../../data/entities/outing-participant.entity';
import {
  OutingExpenseResponseDto,
  OutingParticipantResponseDto,
  OutingSummaryResponseDto,
} from '../dtos/outing.dto';

export class OutingMapper {
  static toParticipantDto(p: OutingParticipantEntity): OutingParticipantResponseDto {
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      memberId: p.memberId,
      aliases: p.aliases || [],
    };
  }

  static toExpenseDto(e: OutingExpenseEntity): OutingExpenseResponseDto {
    return {
      id: e.id,
      outingId: e.outingId,
      paidByParticipantId: e.paidByParticipantId,
      paidByName: e.paidByParticipant?.name || e.paidByParticipantId,
      paidBySlug: e.paidByParticipant?.slug || '',
      description: e.description,
      merchantName: e.merchantName,
      amount: Number(e.amount),
      expenseDate: e.expenseDate,
      splitMode: e.splitMode,
      shares: e.shares || [],
      notes: e.notes,
      createdAt: e.createdAt,
    };
  }

  static toSummaryDto(
    outing: OutingEntity,
    expenses: OutingExpenseEntity[] = outing.expenses || [],
  ): OutingSummaryResponseDto {
    const totalSpent =
      Math.round(expenses.reduce((s, e) => s + Number(e.amount), 0) * 100) / 100;
    const participants = (outing.participants || []).map((p) =>
      this.toParticipantDto(p),
    );
    return {
      id: outing.id,
      slug: outing.slug,
      name: outing.name,
      description: outing.description,
      eventDate: outing.eventDate,
      currency: outing.currency,
      status: outing.status,
      participantsCount: participants.length,
      expensesCount: expenses.length,
      totalSpent,
      participants,
      createdAt: outing.createdAt,
    };
  }
}
