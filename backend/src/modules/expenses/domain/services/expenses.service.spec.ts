import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from './expenses.service';
import { IExpensesRepository } from '../../data/repositories/i-expenses.repository';
import { CreateExpenseDto } from '../../presentation/dtos/create-expense.dto';
import { ExpenseEntity } from '../../data/entities/expense.entity';
import { CreditCardEntity } from '../../data/entities/credit-card.entity';
import { NotFound } from '../../../../common/errors/errors';

describe('ExpensesService', () => {
  let service: ExpensesService;
  let mockRepository: Partial<Record<keyof IExpensesRepository, Mock>>;

  beforeEach(async () => {
    mockRepository = {
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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        {
          provide: IExpensesRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
    vi.clearAllMocks();
  });

  describe('registerExpense', () => {
    it('should register single payment expense successfully', async () => {
      // Arrange
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

      // Act
      const result = await service.registerExpense(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.getValue().id).toBe('uuid-1');
      expect(mockRepository.saveExpense).toHaveBeenCalledTimes(1);
    });

    it('should register bank transfer expense with bank name', async () => {
      // Arrange
      const dto: CreateExpenseDto = {
        description: 'Pago alquiler cochera',
        merchantName: 'Garaje Central',
        totalAmount: 35000,
        currency: 'ARS',
        expenseDate: '2026-11-08',
        paymentMethod: 'BANK_TRANSFER',
        bankName: 'Galicia',
      };

      mockRepository.saveExpense!.mockImplementation(async (entity: any) => {
        return { ...entity, id: 'expense-transfer-1' };
      });

      // Act
      const result = await service.registerExpense(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      const saved = result.getValue();
      expect(saved.id).toBe('expense-transfer-1');
      expect(saved.paymentMethod).toBe('BANK_TRANSFER');
      expect(saved.bankName).toBe('Galicia');
      expect(mockRepository.findCreditCardByDetails).not.toHaveBeenCalled();
      expect(mockRepository.findCreditCardById).not.toHaveBeenCalled();
    });

    it('should generate installments plan and match credit card when card details are provided', async () => {
      // Arrange
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
        intervalMonths: 2, // Cuotas cada 2 meses
      };

      mockRepository.saveExpense!.mockImplementation(async (entity: any) => {
        return { ...entity, id: 'expense-uuid-99' };
      });

      // Act
      const result = await service.registerExpense(dto);

      // Assert
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
      // Arrange
      const dto: CreateExpenseDto = {
        description: 'Combustible YPF',
        merchantName: 'YPF',
        totalAmount: 45000,
        expenseDate: '2026-11-08',
        creditCardId: 'non-existent-uuid',
      };
      mockRepository.findCreditCardById!.mockResolvedValue(null);

      // Act
      const result = await service.registerExpense(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFound);
    });
  });

  describe('getMonthlyInstallmentsSummary', () => {
    it('should summarize installments for given month', async () => {
      // Arrange
      const mockInstallment = {
        id: 'inst-1',
        expenseId: 'exp-1',
        installmentNumber: 2,
        totalInstallments: 6,
        amount: 25000,
        dueDate: '2026-12-10',
        status: 'PENDING',
        expense: {
          merchantName: 'MercadoLibre',
          description: 'Auriculares Sony',
          creditCard: {
            bank: 'Galicia',
            cardName: 'Mastercard',
            isExtension: false,
            holderName: 'Titular',
          },
        },
      };

      mockRepository.findInstallmentsByDueDateRange!.mockResolvedValue([mockInstallment]);

      // Act
      const result = await service.getMonthlyInstallmentsSummary('2026-12');

      // Assert
      expect(result.isSuccess).toBe(true);
      const summary = result.getValue();
      expect(summary.month).toBe('2026-12');
      expect(summary.totalAmountDue).toBe(25000);
      expect(summary.installmentsCount).toBe(1);
      expect(summary.items[0].cardBank).toBe('Galicia');
    });
  });

  describe('getFinancialSummary', () => {
    it('should calculate financial summary accurately separating paid and pending', async () => {
      // Direct paid expense
      const directExp = {
        id: 'exp-1',
        totalAmount: 15000,
        category: 'SUPERMERCADO',
        paymentMethod: 'DEBIT_CARD',
        bankName: 'Santander',
      } as any;

      // Paid installment
      const paidInst = {
        id: 'inst-1',
        amount: 11478.17,
        status: 'PAID',
        notes: 'Pagado vía BANK_TRANSFER (Galicia)',
        expense: {
          category: 'SERVICIOS',
          merchantName: 'Aysam',
        },
      } as any;

      // Pending installment
      const pendingInst = {
        id: 'inst-2',
        amount: 11478.17,
        status: 'PENDING',
        dueDate: '2026-11-20',
        expense: {
          merchantName: 'Aysam',
        },
      } as any;

      mockRepository.findExpensesByDateRange!.mockResolvedValueOnce([directExp]).mockResolvedValueOnce([]);
      mockRepository.findPaidInstallmentsByDateRange!.mockResolvedValueOnce([paidInst]).mockResolvedValueOnce([]);
      mockRepository.findPendingInstallmentsByDueDateRange!.mockResolvedValueOnce([pendingInst]);
      mockRepository.findUpcomingPendingInstallments!.mockResolvedValueOnce([pendingInst]);

      const result = await service.getFinancialSummary({ month: '2026-11' });

      expect(result.isSuccess).toBe(true);
      const summary = result.getValue();
      expect(summary.totalPaid).toBe(26478.17); // 15000 + 11478.17
      expect(summary.totalPending).toBe(11478.17);
      expect(summary.paidTransactionsCount).toBe(2);
      expect(summary.byCategory.length).toBe(2);
      expect(summary.byBank.length).toBe(2);
      expect(summary.comparison.trend).toBe('UP');
    });
  });

  describe('searchExpenses', () => {
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
  });

  describe('getUpcomingInstallments', () => {
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
  });

  describe('updateExpense & deleteExpense', () => {
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
  });

  describe('updateInstallment & deleteInstallment', () => {
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
