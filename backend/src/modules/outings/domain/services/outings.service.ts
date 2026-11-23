import { Injectable, Logger, Optional } from '@nestjs/common';
import { IOutingsService } from './i-outings.service';
import { IOutingsRepository } from '../../data/repositories/i-outings.repository';
import { IExpensesRepository } from '../../../expenses/data/repositories/i-expenses.repository';
import { IExpensesService } from '../../../expenses/domain/services/i-expenses.service';
import { Result } from '../../../../common/errors/result.mapper';
import {
  CouldNotSave,
  InvalidOperation,
  NotFound,
} from '../../../../common/errors/errors';
import { OutingEntity } from '../../data/entities/outing.entity';
import { OutingParticipantEntity } from '../../data/entities/outing-participant.entity';
import { OutingExpenseEntity } from '../../data/entities/outing-expense.entity';
import {
  AddOutingExpenseDto,
  AddOutingParticipantDto,
  CreateOutingDto,
  OutingBalanceResponseDto,
  OutingExpenseResponseDto,
  OutingParticipantBalanceDto,
  OutingParticipantResponseDto,
  OutingSettlementDto,
  OutingSummaryResponseDto,
  SettleOutingDto,
} from '../../presentation/dtos/outing.dto';
import { OutingMapper } from '../../presentation/mappers/outing.mapper';
import { OutingStatus } from '../interfaces/outing.interface';
import {
  IOutingExpenseShare,
  OutingSplitMode,
} from '../interfaces/outing-expense.interface';

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class OutingsService implements IOutingsService {
  private readonly logger = new Logger(OutingsService.name);

  constructor(
    private readonly outingsRepo: IOutingsRepository,
    @Optional() private readonly expensesRepo?: IExpensesRepository,
    @Optional() private readonly expensesService?: IExpensesService,
  ) {}

  private async buildParticipantEntity(
    outingId: string | undefined,
    rawName: string,
    aliases: string[] = [],
  ): Promise<OutingParticipantEntity> {
    const cleanName = rawName.trim();
    const matchedMember = this.expensesRepo?.findMemberByRef
      ? await this.expensesRepo.findMemberByRef(cleanName)
      : null;

    const participant = new OutingParticipantEntity();
    if (outingId) participant.outingId = outingId;
    participant.name = matchedMember?.displayName || cleanName;
    participant.slug = matchedMember?.slug || slugify(cleanName) || `p-${Date.now()}`;
    participant.memberId = matchedMember?.id;

    const mergedAliases = new Set<string>(
      [
        ...aliases,
        cleanName !== participant.name ? cleanName : '',
        ...(matchedMember?.aliases || []),
      ]
        .map((a) => a.trim())
        .filter(Boolean),
    );
    participant.aliases = Array.from(mergedAliases);
    return participant;
  }

  private async resolveOrAutoAddParticipant(
    outing: OutingEntity,
    ref: string,
    autoAdd: boolean,
  ): Promise<Result<OutingParticipantEntity>> {
    const clean = ref.trim();
    const cleanLower = clean.toLowerCase();

    const localMatch =
      (outing.participants || []).find((p) => p.id === clean) ||
      (outing.participants || []).find((p) => p.slug.toLowerCase() === cleanLower) ||
      (outing.participants || []).find((p) => p.name.toLowerCase() === cleanLower) ||
      (outing.participants || []).find((p) =>
        (p.aliases || []).some((a) => a.trim().toLowerCase() === cleanLower),
      );

    if (localMatch) {
      return Result.ok(localMatch);
    }

    const repoMatch = await this.outingsRepo.findParticipantByRef(outing.id, clean);
    if (repoMatch) {
      return Result.ok(repoMatch);
    }

    if (this.expensesRepo?.findMemberByRef) {
      const member = await this.expensesRepo.findMemberByRef(clean);
      if (member) {
        const byMember = (outing.participants || []).find(
          (p) => p.memberId === member.id,
        );
        if (byMember) return Result.ok(byMember);
      }
    }

    if (!autoAdd) {
      return Result.fail(
        new NotFound(`Participante '${ref}' en la salida '${outing.name}'`),
      );
    }

    const createdEntity = await this.buildParticipantEntity(outing.id, clean);
    const saved = await this.outingsRepo.saveParticipant(createdEntity);
    outing.participants = [...(outing.participants || []), saved];
    return Result.ok(saved);
  }

  async createOuting(dto: CreateOutingDto): Promise<Result<OutingSummaryResponseDto>> {
    try {
      const eventDate = dto.eventDate || new Date().toISOString().slice(0, 10);
      const baseSlug = slugify(dto.slug || dto.name) || `salida-${eventDate}`;
      let finalSlug = baseSlug;

      const collision = await this.outingsRepo.findOutingByRef(baseSlug);
      if (collision && collision.slug.toLowerCase() === baseSlug.toLowerCase()) {
        finalSlug = `${baseSlug}-${eventDate}`;
        const collision2 = await this.outingsRepo.findOutingByRef(finalSlug);
        if (collision2 && collision2.slug.toLowerCase() === finalSlug.toLowerCase()) {
          finalSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
        }
      }

      let createdByMemberId: string | undefined;
      if (dto.createdBy && this.expensesRepo?.findMemberByRef) {
        const member = await this.expensesRepo.findMemberByRef(dto.createdBy);
        createdByMemberId = member?.id;
      }

      const participantNames = new Map<string, string>();
      for (const rawName of dto.participants || []) {
        const clean = rawName.trim();
        const key = slugify(clean);
        if (key && !participantNames.has(key)) {
          participantNames.set(key, clean);
        }
      }

      const participants: OutingParticipantEntity[] = [];
      for (const name of participantNames.values()) {
        const p = await this.buildParticipantEntity(undefined, name);
        if (!participants.some((existing) => existing.slug === p.slug)) {
          participants.push(p);
        }
      }

      const outing = new OutingEntity();
      outing.name = dto.name.trim();
      outing.slug = finalSlug;
      outing.description = dto.description?.trim();
      outing.eventDate = eventDate;
      outing.currency = (dto.currency || 'ARS').trim().toUpperCase();
      outing.status = 'OPEN';
      outing.createdByMemberId = createdByMemberId;
      outing.participants = participants;

      const saved = await this.outingsRepo.saveOuting(outing);
      const refreshed = (await this.outingsRepo.findOutingByRef(saved.id)) || saved;
      return Result.ok(OutingMapper.toSummaryDto(refreshed, []));
    } catch (error: any) {
      this.logger.error(`Error creating outing: ${error.message}`, error.stack);
      return Result.fail(new CouldNotSave('Outing', error.message));
    }
  }

  async listOutings(status?: OutingStatus): Promise<Result<OutingSummaryResponseDto[]>> {
    try {
      const outings = await this.outingsRepo.findOutings(status);
      return Result.ok(
        outings.map((o) => OutingMapper.toSummaryDto(o, o.expenses || [])),
      );
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async addParticipant(
    outingRef: string,
    dto: AddOutingParticipantDto,
  ): Promise<Result<OutingParticipantResponseDto>> {
    try {
      const outing = await this.outingsRepo.findOutingByRef(outingRef);
      if (!outing) {
        return Result.fail(new NotFound(`Outing '${outingRef}'`));
      }

      const existing = await this.outingsRepo.findParticipantByRef(outing.id, dto.name);
      if (existing) {
        return Result.ok(OutingMapper.toParticipantDto(existing));
      }

      const entity = await this.buildParticipantEntity(
        outing.id,
        dto.name,
        dto.aliases || [],
      );
      const saved = await this.outingsRepo.saveParticipant(entity);
      return Result.ok(OutingMapper.toParticipantDto(saved));
    } catch (error: any) {
      return Result.fail(new CouldNotSave('OutingParticipant', error.message));
    }
  }

  private buildEqualShares(
    participants: OutingParticipantEntity[],
    totalAmount: number,
  ): IOutingExpenseShare[] {
    const count = participants.length;
    const baseAmt = Math.floor((totalAmount / count) * 100) / 100;
    const basePct = round2(100 / count);
    let amtAcc = 0;
    let pctAcc = 0;

    return participants.map((p, idx) => {
      const isLast = idx === count - 1;
      const shareAmt = isLast ? round2(totalAmount - amtAcc) : baseAmt;
      const sharePct = isLast ? round2(100 - pctAcc) : basePct;
      amtAcc += shareAmt;
      pctAcc += sharePct;

      return {
        participantId: p.id,
        participantName: p.name,
        participantSlug: p.slug,
        amount: shareAmt,
        percentage: sharePct,
      };
    });
  }

  async addExpense(
    outingRef: string,
    dto: AddOutingExpenseDto,
  ): Promise<Result<OutingExpenseResponseDto>> {
    try {
      const outing = await this.outingsRepo.findOutingByRef(outingRef);
      if (!outing) {
        return Result.fail(new NotFound(`Outing '${outingRef}'`));
      }
      if (outing.status === 'SETTLED' || outing.status === 'ARCHIVED') {
        return Result.fail(
          new InvalidOperation(`La salida '${outing.name}' está ${outing.status} y no acepta nuevos gastos.`),
        );
      }

      const autoAdd = dto.autoAddParticipants !== false;
      const payerRes = await this.resolveOrAutoAddParticipant(outing, dto.paidBy, autoAdd);
      if (payerRes.isFailure) return Result.fail(payerRes.getError());
      const payer = payerRes.getValue();

      const totalAmount = round2(Number(dto.amount));
      if (totalAmount <= 0) {
        return Result.fail(new InvalidOperation('El monto del gasto debe ser mayor a 0.'));
      }

      let splitMode: OutingSplitMode = 'EQUAL';
      let shares: IOutingExpenseShare[] = [];

      if (dto.customShares && dto.customShares.length > 0) {
        const hasPct = dto.customShares.some((s) => s.percentage !== undefined);
        const hasAmt = dto.customShares.some((s) => s.amount !== undefined);

        if (hasPct && hasAmt) {
          return Result.fail(
            new InvalidOperation('No mezcles montos y porcentajes en customShares; usá un solo criterio.'),
          );
        }

        const resolvedEntries: Array<{
          participant: OutingParticipantEntity;
          amount?: number;
          percentage?: number;
        }> = [];
        for (const item of dto.customShares) {
          const pRes = await this.resolveOrAutoAddParticipant(outing, item.participant, autoAdd);
          if (pRes.isFailure) return Result.fail(pRes.getError());
          resolvedEntries.push({
            participant: pRes.getValue(),
            amount: item.amount,
            percentage: item.percentage,
          });
        }

        if (hasPct) {
          const sumPct = resolvedEntries.reduce((s, e) => s + Number(e.percentage || 0), 0);
          if (Math.abs(sumPct - 100) > 0.05) {
            return Result.fail(
              new InvalidOperation(`Los porcentajes de customShares deben sumar 100% (actual: ${round2(sumPct)}%).`),
            );
          }
          splitMode = 'PERCENTAGE';
          let amtAcc = 0;
          shares = resolvedEntries.map((entry, idx) => {
            const pct = round2(Number(entry.percentage || 0));
            const isLast = idx === resolvedEntries.length - 1;
            const shareAmt = isLast
              ? round2(totalAmount - amtAcc)
              : round2((totalAmount * pct) / 100);
            amtAcc += shareAmt;
            return {
              participantId: entry.participant.id,
              participantName: entry.participant.name,
              participantSlug: entry.participant.slug,
              amount: shareAmt,
              percentage: pct,
            };
          });
        } else if (hasAmt) {
          const sumAmt = resolvedEntries.reduce((s, e) => s + Number(e.amount || 0), 0);
          if (Math.abs(sumAmt - totalAmount) > 0.05) {
            return Result.fail(
              new InvalidOperation(
                `La suma de customShares ($${round2(sumAmt)}) debe coincidir con el monto total ($${totalAmount}).`,
              ),
            );
          }
          splitMode = 'EXACT';
          shares = resolvedEntries.map((entry) => {
            const amt = round2(Number(entry.amount || 0));
            return {
              participantId: entry.participant.id,
              participantName: entry.participant.name,
              participantSlug: entry.participant.slug,
              amount: amt,
              percentage: round2((amt / totalAmount) * 100),
            };
          });
        } else {
          return Result.fail(
            new InvalidOperation('Cada entrada en customShares debe incluir amount o percentage.'),
          );
        }
      } else if (dto.splitBetween && dto.splitBetween.length > 0) {
        splitMode = 'SUBSET';
        const uniqueMap = new Map<string, OutingParticipantEntity>();
        for (const ref of dto.splitBetween) {
          const pRes = await this.resolveOrAutoAddParticipant(outing, ref, autoAdd);
          if (pRes.isFailure) return Result.fail(pRes.getError());
          const p = pRes.getValue();
          uniqueMap.set(p.id, p);
        }
        shares = this.buildEqualShares(Array.from(uniqueMap.values()), totalAmount);
      } else {
        const allParticipants = outing.participants?.length ? outing.participants : [payer];
        splitMode = 'EQUAL';
        shares = this.buildEqualShares(allParticipants, totalAmount);
      }

      const expense = new OutingExpenseEntity();
      expense.outingId = outing.id;
      expense.paidByParticipantId = payer.id;
      expense.paidByParticipant = payer;
      expense.description = dto.description.trim();
      expense.merchantName = dto.merchantName?.trim();
      expense.amount = totalAmount;
      expense.expenseDate = dto.expenseDate || outing.eventDate;
      expense.splitMode = splitMode;
      expense.shares = shares;
      expense.notes = dto.notes?.trim();

      const saved = await this.outingsRepo.saveOutingExpense(expense);
      const refreshed = (await this.outingsRepo.findOutingExpenseById(saved.id)) || saved;
      return Result.ok(OutingMapper.toExpenseDto(refreshed));
    } catch (error: any) {
      this.logger.error(`Error adding outing expense: ${error.message}`, error.stack);
      return Result.fail(new CouldNotSave('OutingExpense', error.message));
    }
  }

  async deleteExpense(
    expenseId: string,
  ): Promise<Result<{ deleted: boolean; id: string }>> {
    try {
      const existing = await this.outingsRepo.findOutingExpenseById(expenseId);
      if (!existing) {
        return Result.fail(new NotFound(`OutingExpense '${expenseId}'`));
      }
      const deleted = await this.outingsRepo.deleteOutingExpense(expenseId);
      return Result.ok({ deleted, id: expenseId });
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async getOutingBalance(outingRef: string): Promise<Result<OutingBalanceResponseDto>> {
    try {
      const outing = await this.outingsRepo.findOutingByRef(outingRef);
      if (!outing) {
        return Result.fail(new NotFound(`Outing '${outingRef}'`));
      }

      const expenses = await this.outingsRepo.findOutingExpenses(outing.id);
      const ledger = new Map<string, OutingParticipantBalanceDto>();

      for (const p of outing.participants || []) {
        ledger.set(p.id, {
          participantId: p.id,
          slug: p.slug,
          name: p.name,
          totalPaid: 0,
          totalShare: 0,
          netBalance: 0,
        });
      }

      let totalSpent = 0;
      for (const exp of expenses) {
        const amt = Number(exp.amount);
        totalSpent += amt;

        if (!ledger.has(exp.paidByParticipantId) && exp.paidByParticipant) {
          ledger.set(exp.paidByParticipantId, {
            participantId: exp.paidByParticipantId,
            slug: exp.paidByParticipant.slug,
            name: exp.paidByParticipant.name,
            totalPaid: 0,
            totalShare: 0,
            netBalance: 0,
          });
        }
        const payerEntry = ledger.get(exp.paidByParticipantId);
        if (payerEntry) {
          payerEntry.totalPaid += amt;
        }

        for (const share of exp.shares || []) {
          if (!ledger.has(share.participantId)) {
            ledger.set(share.participantId, {
              participantId: share.participantId,
              slug: share.participantSlug,
              name: share.participantName,
              totalPaid: 0,
              totalShare: 0,
              netBalance: 0,
            });
          }
          ledger.get(share.participantId)!.totalShare += Number(share.amount);
        }
      }

      const participants = Array.from(ledger.values())
        .map((p) => {
          const totalPaid = round2(p.totalPaid);
          const totalShare = round2(p.totalShare);
          return {
            ...p,
            totalPaid,
            totalShare,
            netBalance: round2(totalPaid - totalShare),
          };
        })
        .sort((a, b) => b.netBalance - a.netBalance);

      const debtors = participants
        .filter((p) => p.netBalance < -0.01)
        .map((p) => ({ ...p, remaining: round2(-p.netBalance) }))
        .sort((a, b) => b.remaining - a.remaining);

      const creditors = participants
        .filter((p) => p.netBalance > 0.01)
        .map((p) => ({ ...p, remaining: round2(p.netBalance) }))
        .sort((a, b) => b.remaining - a.remaining);

      const settlements: OutingSettlementDto[] = [];
      let dIdx = 0;
      let cIdx = 0;
      while (dIdx < debtors.length && cIdx < creditors.length) {
        const debtor = debtors[dIdx];
        const creditor = creditors[cIdx];
        const transfer = round2(Math.min(debtor.remaining, creditor.remaining));
        if (transfer >= 0.01) {
          settlements.push({
            fromParticipantId: debtor.participantId,
            fromSlug: debtor.slug,
            fromName: debtor.name,
            toParticipantId: creditor.participantId,
            toSlug: creditor.slug,
            toName: creditor.name,
            amount: transfer,
          });
        }
        debtor.remaining = round2(debtor.remaining - transfer);
        creditor.remaining = round2(creditor.remaining - transfer);
        if (debtor.remaining < 0.01) dIdx++;
        if (creditor.remaining < 0.01) cIdx++;
      }

      const participantsCount = participants.length;
      return Result.ok({
        outing: {
          id: outing.id,
          slug: outing.slug,
          name: outing.name,
          eventDate: outing.eventDate,
          currency: outing.currency,
          status: outing.status,
        },
        totalSpent: round2(totalSpent),
        expensesCount: expenses.length,
        participantsCount,
        perPersonAverage:
          participantsCount > 0 ? round2(totalSpent / participantsCount) : 0,
        participants,
        settlements,
        expenses: expenses.map((e) => OutingMapper.toExpenseDto(e)),
      });
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async settleOuting(
    outingRef: string,
    dto: SettleOutingDto,
  ): Promise<
    Result<{
      outing: OutingSummaryResponseDto;
      balance: OutingBalanceResponseDto;
      recordedPersonalExpenseId?: string;
    }>
  > {
    try {
      const outing = await this.outingsRepo.findOutingByRef(outingRef);
      if (!outing) {
        return Result.fail(new NotFound(`Outing '${outingRef}'`));
      }

      const balanceRes = await this.getOutingBalance(outing.id);
      if (balanceRes.isFailure) return Result.fail(balanceRes.getError());
      const balance = balanceRes.getValue();

      outing.status = 'SETTLED';
      const savedOuting = await this.outingsRepo.saveOuting(outing);
      balance.outing.status = 'SETTLED';

      let recordedPersonalExpenseId: string | undefined;
      if (dto.recordPersonalExpenseFor && this.expensesService) {
        const refClean = dto.recordPersonalExpenseFor.trim().toLowerCase();
        const participantEntity = await this.outingsRepo.findParticipantByRef(
          outing.id,
          dto.recordPersonalExpenseFor,
        );
        const participantBalance = balance.participants.find(
          (p) =>
            (participantEntity && p.participantId === participantEntity.id) ||
            p.slug.toLowerCase() === refClean ||
            p.name.toLowerCase() === refClean,
        );

        if (!participantBalance) {
          return Result.fail(
            new NotFound(
              `Participante '${dto.recordPersonalExpenseFor}' en la salida '${outing.name}'`,
            ),
          );
        }

        if (participantBalance.totalShare > 0) {
          let paidBySlug: string | undefined;
          if (participantEntity?.memberId && this.expensesRepo?.findMemberByRef) {
            const member = await this.expensesRepo.findMemberByRef(participantEntity.memberId);
            paidBySlug = member?.slug;
          } else if (this.expensesRepo?.findMemberByRef) {
            const member = await this.expensesRepo.findMemberByRef(dto.recordPersonalExpenseFor);
            paidBySlug = member?.slug;
          }

          const regRes = await this.expensesService.registerExpense({
            merchantName: outing.name,
            description: `Parte en salida: ${outing.name} (${participantBalance.name})`,
            totalAmount: participantBalance.totalShare,
            currency: outing.currency,
            expenseDate: outing.eventDate,
            paymentMethod: dto.paymentMethod || 'BANK_TRANSFER',
            bankName: dto.bankName,
            category: dto.category || 'COMIDA_Y_SALIDAS',
            scope: 'PERSONAL',
            paidBy: paidBySlug,
            source: 'CHAT_MESSAGE',
          });

          if (regRes.isFailure) {
            return Result.fail(regRes.getError());
          }
          recordedPersonalExpenseId = regRes.getValue().id;
        }
      }

      const expenses = await this.outingsRepo.findOutingExpenses(outing.id);
      return Result.ok({
        outing: OutingMapper.toSummaryDto(savedOuting, expenses),
        balance,
        recordedPersonalExpenseId,
      });
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async deleteOuting(
    outingRef: string,
  ): Promise<Result<{ deleted: boolean; id: string; slug: string }>> {
    try {
      const outing = await this.outingsRepo.findOutingByRef(outingRef);
      if (!outing) {
        return Result.fail(new NotFound(`Outing '${outingRef}'`));
      }
      const deleted = await this.outingsRepo.deleteOuting(outing.id);
      return Result.ok({ deleted, id: outing.id, slug: outing.slug });
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }
}
