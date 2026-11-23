import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from './expenses.service';
import { IExpensesRepository } from '../../data/repositories/i-expenses.repository';
import { CreateExpenseDto } from '../../presentation/dtos/create-expense.dto';
import { ExpenseEntity } from '../../data/entities/expense.entity';
import { CreditCardEntity } from '../../data/entities/credit-card.entity';
import { MemberEntity } from '../../data/entities/member.entity';
import { RecurringExpenseEntity } from '../../data/entities/recurring-expense.entity';
import { CategoryBudgetEntity } from '../../data/entities/category-budget.entity';
import { InvalidOperation, NotFound } from '../../../../common/errors/errors';
import { PaperlessService } from '../../infrastructure/paperless.service';
import { ChartService } from '../../infrastructure/chart.service';
import { ExportService } from '../../infrastructure/export.service';

describe('ExpensesService', () => {
  let service: ExpensesService;
  let mockRepository: Partial<Record<keyof IExpensesRepository, Mock>>;
  let mockPaperless: Partial<Record<keyof PaperlessService, Mock>>;
  let mockChart: Partial<Record<keyof ChartService, Mock>>;
  let mockExport: Partial<Record<keyof ExportService, Mock>>;

  beforeEach(async () => {
    mockRepository = {
      checkDatabaseHealth: vi.fn(),
      saveExpense: vi.fn(),
      findExpenseById: vi.fn(),
      findExpenses: vi.fn(),
      findInstallmentsByDueDateRange: vi.fn(),
      findPendingInstallments: vi.fn(),
      saveCreditCard: vi.fn(),
      findCreditCards: vi.fn(),
      findCreditCardById: vi.fn(),
      findCreditCardByDetails: vi.fn(),
      findExpensesByDateRange: vi.fn(),
      findPaidInstallmentsByDateRange: vi.fn(),
      findPendingInstallmentsByDueDateRange: vi.fn(),
      findUpcomingPendingInstallments: vi.fn(),
      findInstallmentById: vi.fn(),
      saveInstallment: vi.fn(),
      searchExpensesAndInstallments: vi.fn(),
      deleteExpense: vi.fn(),
      deleteInstallment: vi.fn(),
      saveMember: vi.fn(),
      findMembers: vi.fn(),
      findMemberByRef: vi.fn(),
      deleteMember: vi.fn(),
      countMemberReferences: vi.fn(),
      replaceExpenseAllocations: vi.fn(),
      findSharedDirectExpenses: vi.fn(),
      findSharedPaidInstallments: vi.fn(),
      saveBudget: vi.fn(),
      findBudgets: vi.fn().mockResolvedValue([]),
      findBudgetById: vi.fn(),
      findBudgetByMatch: vi.fn(),
      deleteBudget: vi.fn(),
      saveRecurringExpense: vi.fn(),
      findRecurringExpenses: vi.fn(),
      findRecurringExpenseById: vi.fn(),
      deleteRecurringExpense: vi.fn(),
      findFixedExpensesInDateRange: vi.fn(),
    };

    mockPaperless = {
      checkHealth: vi.fn().mockResolvedValue({ configured: false, reachable: false }),
    };

    mockChart = {
      renderChartPng: vi.fn(),
    };

    mockExport = {
      exportToFile: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: IExpensesRepository, useValue: mockRepository },
        { provide: PaperlessService, useValue: mockPaperless },
        { provide: ChartService, useValue: mockChart },
        { provide: ExportService, useValue: mockExport },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
    vi.clearAllMocks();
    mockRepository.findBudgets!.mockResolvedValue([]);
  });

  describe('registerExpense', () => {
    it('should register single payment expense successfully', async () => {
      const dto: CreateExpenseDto = {
        description: 'Supermercado Vea',
        merchantName: 'Vea Cencosud',
        totalAmount: 12500.5,
        currency: 'ARS',
        expenseDate: '2026-11-08',
        paymentMethod: 'DEBIT_CARD',
      };

      const savedEntity = new ExpenseEntity();
      Object.assign(savedEntity, dto, { id: 'uuid-1', installmentsPlan: [] });
      mockRepository.saveExpense!.mockResolvedValue(savedEntity);

      const result = await service.registerExpense(dto);

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().id).toBe('uuid-1');
      expect(mockRepository.saveExpense).toHaveBeenCalledTimes(1);
    });

    it('should register bank transfer expense with bank name', async () => {
      const dto: CreateExpenseDto = {
        description: 'Pago alquiler cochera',
        merchantName: 'Garaje Central',
        totalAmount: 35000,
        currency: 'ARS',
        expenseDate: '2026-11-08',
        paymentMethod: 'BANK_TRANSFER',
        bankName: 'Galicia',
      };

      mockRepository.saveExpense!.mockImplementation(async (entity: any) => ({
        ...entity,
        id: 'expense-transfer-1',
      }));

      const result = await service.registerExpense(dto);

      expect(result.isSuccess).toBe(true);
      const saved = result.getValue();
      expect(saved.id).toBe('expense-transfer-1');
      expect(saved.paymentMethod).toBe('BANK_TRANSFER');
      expect(saved.bankName).toBe('Galicia');
      expect(mockRepository.findCreditCardByDetails).not.toHaveBeenCalled();
    });

    it('should generate installments plan and match credit card when card details are provided', async () => {
      const card = new CreditCardEntity();
      card.id = 'card-uuid-1';
      card.bank = 'Santander';
      card.cardName = 'Visa Black';
      card.isExtension = true;
      card.holderName = 'Mamá';
      card.dueDay = 10;

      mockRepository.findCreditCardByDetails!.mockResolvedValue(card);

      const dto: CreateExpenseDto = {
        description: 'Smart TV 55"',
        merchantName: 'Fravega',
        totalAmount: 300000,
        currency: 'ARS',
        expenseDate: '2026-11-08',
        cardBank: 'Santander',
        cardName: 'Visa Black',
        cardHolder: 'Mamá',
        isInstallment: true,
        totalInstallments: 3,
        intervalMonths: 2,
      };

      mockRepository.saveExpense!.mockImplementation(async (entity: any) => ({
        ...entity,
        id: 'expense-uuid-99',
      }));

      const result = await service.registerExpense(dto);

      expect(result.isSuccess).toBe(true);
      const savedExpense = result.getValue();
      expect(savedExpense.id).toBe('expense-uuid-99');
      expect(savedExpense.creditCardId).toBe('card-uuid-1');
      expect(savedExpense.installmentsPlan).toHaveLength(3);
      expect(savedExpense.installmentsPlan[0].dueDate).toBe('2026-12-10');
      expect(savedExpense.installmentsPlan[1].dueDate).toBe('2027-02-10');
      expect(savedExpense.installmentsPlan[2].dueDate).toBe('2027-04-10');
    });

    it('should return failure Result when creditCardId does not exist', async () => {
      const dto: CreateExpenseDto = {
        description: 'Combustible YPF',
        merchantName: 'YPF',
        totalAmount: 45000,
        expenseDate: '2026-11-08',
        creditCardId: 'non-existent-uuid',
      };
      mockRepository.findCreditCardById!.mockResolvedValue(null);

      const result = await service.registerExpense(dto);

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFound);
    });

    it('should split SHARED expense equally across active members when allocations are omitted', async () => {
      const m1 = { id: 'm1', slug: 'alice', displayName: 'Alice', aliases: [], isActive: true } as MemberEntity;
      const m2 = { id: 'm2', slug: 'bob', displayName: 'Bob', aliases: [], isActive: true } as MemberEntity;

      mockRepository.findMemberByRef!.mockResolvedValueOnce(m1);
      mockRepository.findMembers!.mockResolvedValueOnce([m1, m2]);
      mockRepository.saveExpense!.mockImplementation(async (e: any) => ({ ...e, id: 'exp-shared-1' }));

      const result = await service.registerExpense({
        merchantName: 'Coto',
        description: 'Compra semanal',
        totalAmount: 10000,
        expenseDate: '2026-11-20',
        scope: 'SHARED',
        paidBy: 'alice',
      });

      expect(result.isSuccess).toBe(true);
      const saved = result.getValue();
      expect(saved.scope).toBe('SHARED');
      expect(saved.paidByMemberId).toBe('m1');
      expect(saved.allocations).toHaveLength(2);
      expect(saved.allocations[0].percentage).toBe(50);
      expect(saved.allocations[0].amount).toBe(5000);
      expect(saved.allocations[1].amount).toBe(5000);
    });

    it('should reject allocations that do not sum to 100%', async () => {
      const result = await service.registerExpense({
        merchantName: 'Coto',
        description: 'Compra',
        totalAmount: 10000,
        expenseDate: '2026-11-20',
        scope: 'SHARED',
        allocations: [
          { member: 'alice', percentage: 60 },
          { member: 'bob', percentage: 30 },
        ],
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(InvalidOperation);
    });
  });

  describe('getMonthlyInstallmentsSummary', () => {
    it('should summarize installments grouped by holder and mark last installment', async () => {
      const inst1 = {
        id: 'inst-1',
        expenseId: 'exp-1',
        installmentNumber: 3,
        totalInstallments: 3,
        amount: 25000,
        dueDate: '2026-12-10',
        status: 'PENDING',
        expense: {
          merchantName: 'MercadoLibre',
          description: 'Auriculares Sony',
          scope: 'PERSONAL',
          isFixed: false,
          creditCard: {
            bank: 'Galicia',
            cardName: 'Mastercard',
            isExtension: false,
            holderName: 'Titular',
          },
        },
      };

      const inst2 = {
        id: 'inst-2',
        expenseId: 'exp-2',
        installmentNumber: 1,
        totalInstallments: 6,
        amount: 60000,
        dueDate: '2026-12-10',
        status: 'PENDING',
        expense: {
          merchantName: 'Zara',
          description: 'Campera',
          scope: 'PERSONAL',
          isFixed: false,
          creditCard: {
            bank: 'Galicia',
            cardName: 'Visa',
            isExtension: true,
            holderName: 'Pareja',
          },
        },
      };

      mockRepository.findInstallmentsByDueDateRange!.mockResolvedValue([inst1, inst2]);

      const result = await service.getMonthlyInstallmentsSummary('2026-12');

      expect(result.isSuccess).toBe(true);
      const summary = result.getValue();
      expect(summary.month).toBe('2026-12');
      expect(summary.totalAmountDue).toBe(85000);
      expect(summary.installmentsCount).toBe(2);
      expect(summary.byHolder).toHaveLength(2);
      expect(summary.byHolder[0].holderName).toBe('Pareja');
      expect(summary.byHolder[0].subtotal).toBe(60000);
      expect(summary.byHolder[1].items[0].isLastInstallment).toBe(true);
    });
  });

  describe('getFinancialSummary', () => {
    it('should calculate financial summary separating paid, pending, fixed vs variable and holders', async () => {
      const directExp = {
        id: 'exp-1',
        expenseDate: '2026-11-05',
        merchantName: 'Super',
        description: 'Compras',
        totalAmount: 15000,
        category: 'SUPERMERCADO',
        paymentMethod: 'DEBIT_CARD',
        bankName: 'Santander',
        scope: 'PERSONAL',
        isFixed: false,
      } as any;

      const paidInst = {
        id: 'inst-1',
        amount: 11478.17,
        status: 'PAID',
        dueDate: '2026-11-10',
        installmentNumber: 1,
        totalInstallments: 2,
        notes: 'Pagado vía BANK_TRANSFER (Galicia)',
        expense: {
          category: 'IMPUESTOS_Y_SERVICIOS',
          merchantName: 'Aysam',
          description: 'Agua',
          scope: 'SHARED',
          isFixed: true,
        },
      } as any;

      const pendingInst = {
        id: 'inst-2',
        amount: 11478.17,
        status: 'PENDING',
        dueDate: '2026-11-20',
        installmentNumber: 2,
        totalInstallments: 2,
        expense: {
          merchantName: 'Aysam',
          description: 'Agua',
        },
      } as any;

      mockRepository.findExpensesByDateRange!.mockResolvedValueOnce([directExp]).mockResolvedValueOnce([]);
      mockRepository.findPaidInstallmentsByDateRange!.mockResolvedValueOnce([paidInst]).mockResolvedValueOnce([]);
      mockRepository.findPendingInstallmentsByDueDateRange!.mockResolvedValueOnce([pendingInst]);
      mockRepository.findUpcomingPendingInstallments!.mockResolvedValueOnce([pendingInst]);

      const result = await service.getFinancialSummary({ month: '2026-11' });

      expect(result.isSuccess).toBe(true);
      const summary = result.getValue();
      expect(summary.totalPaid).toBe(26478.17);
      expect(summary.totalPending).toBe(11478.17);
      expect(summary.paidTransactionsCount).toBe(2);
      expect(summary.fixedVsVariable.fixedPaid).toBe(11478.17);
      expect(summary.fixedVsVariable.variablePaid).toBe(15000);
      expect(summary.topExpenses.length).toBe(2);
      expect(summary.comparison.trend).toBe('UP');
    });
  });

  describe('Shared Balances', () => {
    it('should calculate net balances and settlement suggestions for 2 and 3 members', async () => {
      const m1 = { id: 'm1', slug: 'alice', displayName: 'Alice' } as MemberEntity;
      const m2 = { id: 'm2', slug: 'bob', displayName: 'Bob' } as MemberEntity;
      const m3 = { id: 'm3', slug: 'carol', displayName: 'Carol' } as MemberEntity;

      mockRepository.findMembers!.mockResolvedValueOnce([m1, m2, m3]);
      mockRepository.findSharedDirectExpenses!.mockResolvedValueOnce([
        {
          id: 'e1',
          totalAmount: 30000,
          paidByMember: m1,
          allocations: [
            { member: m1, percentage: 33.34, amount: 10002 },
            { member: m2, percentage: 33.33, amount: 9999 },
            { member: m3, percentage: 33.33, amount: 9999 },
          ],
        } as any,
      ]);
      mockRepository.findSharedPaidInstallments!.mockResolvedValueOnce([]);

      const result = await service.getSharedBalance({ month: '2026-11' });

      expect(result.isSuccess).toBe(true);
      const balance = result.getValue();
      expect(balance.totalShared).toBe(30000);
      expect(balance.settlements).toHaveLength(2);
      expect(balance.settlements[0].toSlug).toBe('alice');
      expect(balance.settlements[1].toSlug).toBe('alice');
    });
  });

  describe('Recurring / Fixed Expenses', () => {
    it('should report fixed expenses status and allow paying with adjusted amount', async () => {
      const tpl1 = {
        id: 'rec-1',
        merchantName: 'Alquiler',
        description: 'Alquiler Depto',
        category: 'ALQUILER_Y_EXPENSAS',
        estimatedAmount: 500000,
        currency: 'ARS',
        dayOfMonth: 10,
        frequency: 'MONTHLY',
        paymentMethod: 'BANK_TRANSFER',
        bankName: 'Galicia',
        scope: 'SHARED',
        isActive: true,
        createdAt: new Date('2026-01-01'),
      } as RecurringExpenseEntity;

      const tpl2 = {
        id: 'rec-2',
        merchantName: 'Fibertel',
        description: 'Internet 300MB',
        category: 'IMPUESTOS_Y_SERVICIOS',
        estimatedAmount: 45000,
        currency: 'ARS',
        dayOfMonth: 28,
        frequency: 'MONTHLY',
        paymentMethod: 'BANK_TRANSFER',
        scope: 'PERSONAL',
        isActive: true,
        createdAt: new Date('2026-01-01'),
      } as RecurringExpenseEntity;

      mockRepository.findRecurringExpenses!.mockResolvedValueOnce([tpl1, tpl2]);
      mockRepository.findFixedExpensesInDateRange!.mockResolvedValueOnce([
        {
          id: 'exp-paid-1',
          recurringExpenseId: 'rec-1',
          merchantName: 'Alquiler',
          totalAmount: 520000,
          expenseDate: '2026-11-05',
        } as ExpenseEntity,
      ]);

      const statusRes = await service.getFixedExpensesStatus('2026-11');
      expect(statusRes.isSuccess).toBe(true);
      const status = statusRes.getValue();
      expect(status.paidCount).toBe(1);
      expect(status.pendingCount).toBe(1);
      expect(status.totalPaid).toBe(520000);
      expect(status.items[0].status).toBe('PAID');
      expect(status.items[1].status).not.toBe('PAID');

      // Now test payRecurringExpense with overridden amount
      mockRepository.findRecurringExpenses!.mockResolvedValueOnce([tpl1, tpl2]);
      mockRepository.findMembers!.mockResolvedValueOnce([]);
      mockRepository.saveExpense!.mockImplementation(async (e: any) => ({ ...e, id: 'exp-new-fixed' }));

      const payRes = await service.payRecurringExpense('Fibertel', { amount: 48500 });
      expect(payRes.isSuccess).toBe(true);
      const paid = payRes.getValue();
      expect(paid.isFixed).toBe(true);
      expect(paid.recurringExpenseId).toBe('rec-2');
      expect(paid.totalAmount).toBe(48500);
    });
  });

  describe('Category Budgets', () => {
    it('should detect triggered budget alerts when spending crosses threshold', async () => {
      const budget = {
        id: 'b1',
        category: 'SUPERMERCADO',
        monthlyAmount: 100000,
        currency: 'ARS',
        alertThresholdPct: 80,
        scope: 'ALL',
        isActive: true,
      } as CategoryBudgetEntity;

      mockRepository.findBudgets!.mockResolvedValueOnce([budget]);
      mockRepository.findExpensesByDateRange!.mockResolvedValueOnce([
        {
          id: 'e1',
          totalAmount: 85000,
          category: 'SUPERMERCADO',
          currency: 'ARS',
          scope: 'PERSONAL',
        } as ExpenseEntity,
      ]);
      mockRepository.findPaidInstallmentsByDateRange!.mockResolvedValueOnce([]);

      const res = await service.getBudgetStatus('2026-11', false);
      expect(res.isSuccess).toBe(true);
      const status = res.getValue();
      expect(status.alertsCount).toBe(1);
      expect(status.items[0].percentageUsed).toBe(85);
      expect(status.items[0].alertTriggered).toBe(true);
      expect(status.items[0].exceeded).toBe(false);
    });
  });

  describe('compareMonths & search & upcoming & updates', () => {
    it('should compare two months by category', async () => {
      mockRepository.findExpensesByDateRange!
        .mockResolvedValueOnce([{ id: 'e1', totalAmount: 10000, category: 'SUPERMERCADO' } as any])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'e2', totalAmount: 15000, category: 'SUPERMERCADO' } as any])
        .mockResolvedValueOnce([]);
      mockRepository.findPaidInstallmentsByDateRange!.mockResolvedValue([]);
      mockRepository.findPendingInstallmentsByDueDateRange!.mockResolvedValue([]);
      mockRepository.findUpcomingPendingInstallments!.mockResolvedValue([]);

      const res = await service.compareMonths('2026-10', '2026-11');
      expect(res.isSuccess).toBe(true);
      const cmp = res.getValue();
      expect(cmp.totalA).toBe(10000);
      expect(cmp.totalB).toBe(15000);
      expect(cmp.diffAmount).toBe(5000);
      expect(cmp.diffPercentage).toBe(50);
      expect(cmp.trend).toBe('UP');
    });

    it('should return matching expenses and installments', async () => {
      mockRepository.searchExpensesAndInstallments!.mockResolvedValueOnce({
        expenses: [
          {
            id: 'e1',
            expenseDate: '2026-11-01',
            merchantName: 'YPF Estacion',
            description: 'Nafta Infinia',
            totalAmount: 20000,
            currency: 'ARS',
            category: 'TRANSPORTE',
            paymentMethod: 'CREDIT_CARD',
          } as any,
        ],
        installments: [],
      });

      const result = await service.searchExpenses({ q: 'YPF' });
      expect(result.isSuccess).toBe(true);
      const searchRes = result.getValue();
      expect(searchRes.totalMatches).toBe(1);
      expect(searchRes.totalAmount).toBe(20000);
      expect(searchRes.items[0].merchantName).toBe('YPF Estacion');
    });

    it('should return upcoming installments within specified days', async () => {
      mockRepository.findUpcomingPendingInstallments!.mockResolvedValueOnce([
        {
          id: 'inst-due-1',
          expenseId: 'exp-1',
          installmentNumber: 1,
          totalInstallments: 3,
          amount: 5000,
          dueDate: '2026-11-12',
          expense: { merchantName: 'Ecogas', description: 'Gas domiciliario' },
        } as any,
      ]);

      const result = await service.getUpcomingInstallments(7);
      expect(result.isSuccess).toBe(true);
      const items = result.getValue();
      expect(items.length).toBe(1);
      expect(items[0].merchantName).toBe('Ecogas');
    });

    it('should update expense totalAmount and redistribute across pending installments', async () => {
      const inst1 = { id: 'i1', installmentNumber: 1, amount: 10000, status: 'PAID' };
      const inst2 = { id: 'i2', installmentNumber: 2, amount: 10000, status: 'PENDING' };
      const exp = {
        id: 'exp-1',
        merchantName: 'Aysam',
        totalAmount: 20000,
        isInstallment: true,
        installmentsPlan: [inst1, inst2],
      } as any;

      mockRepository.findExpenseById!.mockResolvedValue(exp);
      mockRepository.saveInstallment!.mockImplementation(async (i: any) => i);
      mockRepository.saveExpense!.mockImplementation(async (e: any) => e);

      const result = await service.updateExpense('exp-1', { totalAmount: 25000 });
      expect(result.isSuccess).toBe(true);
      expect(inst2.amount).toBe(15000);
      expect(exp.totalAmount).toBe(25000);
    });

    it('should delete expense by id', async () => {
      mockRepository.findExpenseById!.mockResolvedValueOnce({ id: 'exp-1', merchantName: 'BBVA' } as any);
      mockRepository.deleteExpense!.mockResolvedValueOnce(true);

      const result = await service.deleteExpense('exp-1');
      expect(result.isSuccess).toBe(true);
      expect(result.getValue().deleted).toBe(true);
    });

    it('should update installment amount and recalculate parent expense totalAmount', async () => {
      const inst1 = { id: 'i1', expenseId: 'exp-1', installmentNumber: 1, amount: 11478.17, status: 'PAID' } as any;
      const inst2 = { id: 'i2', expenseId: 'exp-1', installmentNumber: 2, amount: 11478.17, status: 'PENDING' } as any;
      const parent = {
        id: 'exp-1',
        totalAmount: 22956.34,
        installmentsPlan: [inst1, inst2],
      } as any;

      mockRepository.findInstallmentById!.mockResolvedValue(inst2);
      mockRepository.saveInstallment!.mockImplementation(async (i: any) => i);
      mockRepository.findExpenseById!.mockResolvedValue(parent);
      mockRepository.saveExpense!.mockImplementation(async (e: any) => e);

      const result = await service.updateInstallment('i2', { amount: 15000 });
      expect(result.isSuccess).toBe(true);
      expect(inst2.amount).toBe(15000);
      expect(parent.totalAmount).toBe(26478.17);
    });

    it('should delete installment and delete parent expense if no installments remain', async () => {
      const inst = { id: 'i1', expenseId: 'exp-1' } as any;
      mockRepository.findInstallmentById!.mockResolvedValueOnce(inst);
      mockRepository.deleteInstallment!.mockResolvedValueOnce(true);
      mockRepository.findExpenseById!.mockResolvedValueOnce({ id: 'exp-1', installmentsPlan: [] } as any);
      mockRepository.deleteExpense!.mockResolvedValueOnce(true);

      const result = await service.deleteInstallment('i1');
      expect(result.isSuccess).toBe(true);
      expect(result.getValue().expenseDeleted).toBe(true);
    });
  });
});
