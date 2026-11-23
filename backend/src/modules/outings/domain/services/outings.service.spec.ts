import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { OutingsService } from './outings.service';
import { IOutingsRepository } from '../../data/repositories/i-outings.repository';
import { IExpensesRepository } from '../../../expenses/data/repositories/i-expenses.repository';
import { IExpensesService } from '../../../expenses/domain/services/i-expenses.service';
import { OutingEntity } from '../../data/entities/outing.entity';
import { OutingParticipantEntity } from '../../data/entities/outing-participant.entity';
import { OutingExpenseEntity } from '../../data/entities/outing-expense.entity';
import { Result } from '../../../../common/errors/result.mapper';
import { InvalidOperation } from '../../../../common/errors/errors';

describe('OutingsService', () => {
  let service: OutingsService;
  let mockOutingsRepo: Partial<Record<keyof IOutingsRepository, Mock>>;
  let mockExpensesRepo: Partial<Record<keyof IExpensesRepository, Mock>>;
  let mockExpensesService: Partial<Record<keyof IExpensesService, Mock>>;

  beforeEach(async () => {
    mockOutingsRepo = {
      saveOuting: vi.fn(),
      findOutings: vi.fn(),
      findOutingByRef: vi.fn(),
      deleteOuting: vi.fn(),
      saveParticipant: vi.fn(),
      findParticipantByRef: vi.fn(),
      countParticipantExpenses: vi.fn(),
      deleteParticipant: vi.fn(),
      saveOutingExpense: vi.fn(),
      findOutingExpenses: vi.fn(),
      findOutingExpenseById: vi.fn(),
      deleteOutingExpense: vi.fn(),
    };

    mockExpensesRepo = {
      findMemberByRef: vi.fn().mockResolvedValue(null),
    };

    mockExpensesService = {
      registerExpense: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutingsService,
        { provide: IOutingsRepository, useValue: mockOutingsRepo },
        { provide: IExpensesRepository, useValue: mockExpensesRepo },
        { provide: IExpensesService, useValue: mockExpensesService },
      ],
    }).compile();

    service = module.get<OutingsService>(OutingsService);
    vi.clearAllMocks();
    mockExpensesRepo.findMemberByRef!.mockResolvedValue(null);
  });

  it('should create outing with participants and auto-link matching household members', async () => {
    mockOutingsRepo.findOutingByRef!.mockResolvedValue(null);
    mockExpensesRepo.findMemberByRef!.mockImplementation(async (ref: string) => {
      if (ref.toLowerCase() === 'alice') {
        return { id: 'member-alice', slug: 'alice', displayName: 'Alice', aliases: [] };
      }
      return null;
    });
    mockOutingsRepo.saveOuting!.mockImplementation(async (o: any) => ({
      ...o,
      id: 'outing-1',
      createdAt: new Date(),
      participants: o.participants.map((p: any, i: number) => ({ ...p, id: `p-${i}` })),
    }));
    mockOutingsRepo.findOutingByRef!.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'outing-1',
      slug: 'asado-sabado',
      name: 'Asado sábado',
      eventDate: '2026-11-23',
      currency: 'ARS',
      status: 'OPEN',
      participants: [
        { id: 'p-0', name: 'Alice', slug: 'alice', memberId: 'member-alice', aliases: [] },
        { id: 'p-1', name: 'Juan', slug: 'juan', aliases: [] },
      ],
      createdAt: new Date(),
    });

    const res = await service.createOuting({
      name: 'Asado sábado',
      participants: ['Alice', 'Juan'],
    });

    expect(res.isSuccess).toBe(true);
    const val = res.getValue();
    expect(val.slug).toBe('asado-sabado');
    expect(val.participantsCount).toBe(2);
    expect(val.participants[0].memberId).toBe('member-alice');
    expect(val.participants[1].memberId).toBeUndefined();
  });

  it('should auto-add third-party payer for a single user and split equally', async () => {
    const alice = { id: 'p-1', name: 'Alice', slug: 'alice', aliases: [] } as OutingParticipantEntity;
    const outing = {
      id: 'outing-1',
      slug: 'asado',
      name: 'Asado',
      eventDate: '2026-11-23',
      currency: 'ARS',
      status: 'OPEN',
      participants: [alice],
    } as OutingEntity;

    mockOutingsRepo.findOutingByRef!.mockResolvedValue(outing);
    mockOutingsRepo.findParticipantByRef!.mockResolvedValue(null);
    mockOutingsRepo.saveParticipant!.mockImplementation(async (p: any) => ({
      ...p,
      id: 'p-2',
    }));
    mockOutingsRepo.saveOutingExpense!.mockImplementation(async (e: any) => ({
      ...e,
      id: 'oe-1',
      createdAt: new Date(),
    }));
    mockOutingsRepo.findOutingExpenseById!.mockResolvedValue(null);

    const res = await service.addExpense('asado', {
      paidBy: 'Juan',
      description: 'Carne y carbón',
      amount: 45000,
    });

    expect(res.isSuccess).toBe(true);
    const exp = res.getValue();
    expect(exp.paidByName).toBe('Juan');
    expect(exp.splitMode).toBe('EQUAL');
    expect(exp.shares).toHaveLength(2);
    expect(exp.shares[0].amount).toBe(22500);
    expect(exp.shares[1].amount).toBe(22500);
  });

  it('should split subset expenses only among splitBetween participants and reject invalid customShares', async () => {
    const p1 = { id: 'p1', name: 'Alice', slug: 'alice', aliases: [] } as OutingParticipantEntity;
    const p2 = { id: 'p2', name: 'Juan', slug: 'juan', aliases: [] } as OutingParticipantEntity;
    const p3 = { id: 'p3', name: 'Sofia', slug: 'sofia', aliases: [] } as OutingParticipantEntity;
    const outing = {
      id: 'o1',
      slug: 'cena',
      name: 'Cena',
      eventDate: '2026-11-23',
      currency: 'ARS',
      status: 'OPEN',
      participants: [p1, p2, p3],
    } as OutingEntity;

    mockOutingsRepo.findOutingByRef!.mockResolvedValue(outing);
    mockOutingsRepo.saveOutingExpense!.mockImplementation(async (e: any) => ({
      ...e,
      id: 'oe-subset',
      createdAt: new Date(),
    }));
    mockOutingsRepo.findOutingExpenseById!.mockResolvedValue(null);

    const subsetRes = await service.addExpense('cena', {
      paidBy: 'Juan',
      description: 'Vino',
      amount: 18000,
      splitBetween: ['Juan', 'Sofia'],
    });

    expect(subsetRes.isSuccess).toBe(true);
    const subsetExp = subsetRes.getValue();
    expect(subsetExp.splitMode).toBe('SUBSET');
    expect(subsetExp.shares).toHaveLength(2);
    expect(subsetExp.shares.map((s) => s.participantSlug)).toEqual(['juan', 'sofia']);
    expect(subsetExp.shares[0].amount).toBe(9000);

    const invalidCustom = await service.addExpense('cena', {
      paidBy: 'Alice',
      description: 'Postre',
      amount: 10000,
      customShares: [
        { participant: 'Alice', amount: 4000 },
        { participant: 'Sofia', amount: 4000 },
      ],
    });
    expect(invalidCustom.isFailure).toBe(true);
    expect(invalidCustom.getError()).toBeInstanceOf(InvalidOperation);
  });

  it('should compute accurate multi-participant outing balance and settlements', async () => {
    const p1 = { id: 'p1', name: 'Alice', slug: 'alice', aliases: [] } as OutingParticipantEntity;
    const p2 = { id: 'p2', name: 'Juan', slug: 'juan', aliases: [] } as OutingParticipantEntity;
    const p3 = { id: 'p3', name: 'Sofia', slug: 'sofia', aliases: [] } as OutingParticipantEntity;
    const outing = {
      id: 'o1',
      slug: 'asado',
      name: 'Asado',
      eventDate: '2026-11-23',
      currency: 'ARS',
      status: 'OPEN',
      participants: [p1, p2, p3],
    } as OutingEntity;

    const expenses: OutingExpenseEntity[] = [
      {
        id: 'e1',
        outingId: 'o1',
        paidByParticipantId: 'p1',
        paidByParticipant: p1,
        description: 'Carne',
        amount: 60000,
        expenseDate: '2026-11-23',
        splitMode: 'EQUAL',
        shares: [
          { participantId: 'p1', participantName: 'Alice', participantSlug: 'alice', amount: 20000 },
          { participantId: 'p2', participantName: 'Juan', participantSlug: 'juan', amount: 20000 },
          { participantId: 'p3', participantName: 'Sofia', participantSlug: 'sofia', amount: 20000 },
        ],
      } as OutingExpenseEntity,
      {
        id: 'e2',
        outingId: 'o1',
        paidByParticipantId: 'p2',
        paidByParticipant: p2,
        description: 'Vino',
        amount: 30000,
        expenseDate: '2026-11-23',
        splitMode: 'SUBSET',
        shares: [
          { participantId: 'p2', participantName: 'Juan', participantSlug: 'juan', amount: 15000 },
          { participantId: 'p3', participantName: 'Sofia', participantSlug: 'sofia', amount: 15000 },
        ],
      } as OutingExpenseEntity,
    ];

    mockOutingsRepo.findOutingByRef!.mockResolvedValue(outing);
    mockOutingsRepo.findOutingExpenses!.mockResolvedValue(expenses);

    const res = await service.getOutingBalance('asado');
    expect(res.isSuccess).toBe(true);
    const bal = res.getValue();
    expect(bal.totalSpent).toBe(90000);
    // Alice: paid 60k, share 20k => +40k
    // Juan: paid 30k, share 35k => -5k
    // Sofia: paid 0, share 35k => -35k
    const aliceBal = bal.participants.find((p) => p.slug === 'alice')!;
    const juanBal = bal.participants.find((p) => p.slug === 'juan')!;
    const sofiaBal = bal.participants.find((p) => p.slug === 'sofia')!;
    expect(aliceBal.netBalance).toBe(40000);
    expect(juanBal.netBalance).toBe(-5000);
    expect(sofiaBal.netBalance).toBe(-35000);

    expect(bal.settlements).toHaveLength(2);
    const sumTransfers = bal.settlements.reduce((s, t) => s + t.amount, 0);
    expect(sumTransfers).toBe(40000);
    expect(bal.settlements.every((s) => s.toSlug === 'alice')).toBe(true);
  });

  it('should settle outing and record personal expense for requested participant', async () => {
    const p1 = {
      id: 'p1',
      name: 'Alice',
      slug: 'alice',
      memberId: 'm-alice',
      aliases: [],
    } as OutingParticipantEntity;
    const p2 = { id: 'p2', name: 'Juan', slug: 'juan', aliases: [] } as OutingParticipantEntity;
    const outing = {
      id: 'o1',
      slug: 'asado',
      name: 'Asado',
      eventDate: '2026-11-23',
      currency: 'ARS',
      status: 'OPEN',
      participants: [p1, p2],
    } as OutingEntity;

    mockOutingsRepo.findOutingByRef!.mockResolvedValue(outing);
    mockOutingsRepo.findOutingExpenses!.mockResolvedValue([
      {
        id: 'e1',
        outingId: 'o1',
        paidByParticipantId: 'p2',
        paidByParticipant: p2,
        description: 'Asado completo',
        amount: 50000,
        expenseDate: '2026-11-23',
        splitMode: 'EQUAL',
        shares: [
          { participantId: 'p1', participantName: 'Alice', participantSlug: 'alice', amount: 25000 },
          { participantId: 'p2', participantName: 'Juan', participantSlug: 'juan', amount: 25000 },
        ],
      } as OutingExpenseEntity,
    ]);
    mockOutingsRepo.saveOuting!.mockImplementation(async (o: any) => o);
    mockOutingsRepo.findParticipantByRef!.mockResolvedValue(p1);
    mockExpensesRepo.findMemberByRef!.mockResolvedValue({ id: 'm-alice', slug: 'alice' });
    mockExpensesService.registerExpense!.mockResolvedValue(Result.ok({ id: 'personal-exp-1' }));

    const res = await service.settleOuting('asado', {
      recordPersonalExpenseFor: 'Alice',
      paymentMethod: 'BANK_TRANSFER',
      bankName: 'Galicia',
    });

    expect(res.isSuccess).toBe(true);
    const val = res.getValue();
    expect(val.outing.status).toBe('SETTLED');
    expect(val.recordedPersonalExpenseId).toBe('personal-exp-1');
    expect(mockExpensesService.registerExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        totalAmount: 25000,
        scope: 'PERSONAL',
        paidBy: 'alice',
        category: 'COMIDA_Y_SALIDAS',
      }),
    );
  });
});
