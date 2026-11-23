import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesController } from './expenses.controller';
import { IExpensesService } from '../../domain/services/i-expenses.service';
import { Result } from '../../../../common/errors/result.mapper';
import { NotFound } from '../../../../common/errors/errors';
import { NotFoundException } from '@nestjs/common';
import { ExpenseEntity } from '../../data/entities/expense.entity';
import { CreateExpenseDto } from '../dtos/create-expense.dto';

describe('ExpensesController', () => {
  let controller: ExpensesController;
  let mockService: Partial<Record<keyof IExpensesService, Mock>>;

  beforeEach(async () => {
    mockService = {
      registerExpense: vi.fn(),
      getExpenseById: vi.fn(),
      listExpenses: vi.fn(),
      registerCreditCard: vi.fn(),
      listCreditCards: vi.fn(),
      getMonthlyInstallmentsSummary: vi.fn(),
      createMember: vi.fn(),
      listMembers: vi.fn(),
      getSharedBalance: vi.fn(),
      setCategoryBudget: vi.fn(),
      getBudgetStatus: vi.fn(),
      createRecurringExpense: vi.fn(),
      getFixedExpensesStatus: vi.fn(),
      payRecurringExpense: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpensesController],
      providers: [
        {
          provide: IExpensesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ExpensesController>(ExpensesController);
    vi.clearAllMocks();
  });

  it('should return presentation dto when expense registration succeeds', async () => {
    const dto: CreateExpenseDto = {
      description: 'Cena Restaurante',
      merchantName: 'Don Julio',
      totalAmount: 48000,
      expenseDate: '2026-11-08',
    };

    const expenseEntity = new ExpenseEntity();
    Object.assign(expenseEntity, dto, {
      id: 'exp-123',
      paymentMethod: 'CREDIT_CARD',
      currency: 'ARS',
      scope: 'PERSONAL',
      isFixed: false,
      isInstallment: false,
      totalInstallments: 1,
      intervalMonths: 1,
      category: 'GASTRONOMIA',
      source: 'MANUAL',
      createdAt: new Date(),
    });

    mockService.registerExpense!.mockResolvedValue(Result.ok(expenseEntity));

    const response = await controller.createExpense(dto);

    expect(response.id).toBe('exp-123');
    expect(response.totalAmount).toBe(48000);
    expect(response.merchantName).toBe('Don Julio');
    expect(response.scope).toBe('PERSONAL');
  });

  it('should throw NotFoundException when service returns NotFound BaseError', async () => {
    const dto: CreateExpenseDto = {
      description: 'Gasto test',
      merchantName: 'Test',
      totalAmount: 1000,
      expenseDate: '2026-11-08',
      creditCardId: 'fake-id',
    };

    mockService.registerExpense!.mockResolvedValue(
      Result.fail(new NotFound('CreditCard with id fake-id')),
    );

    await expect(controller.createExpense(dto)).rejects.toThrow(NotFoundException);
  });

  it('should return shared balance summary', async () => {
    mockService.getSharedBalance!.mockResolvedValue(
      Result.ok({
        periodLabel: 'Mes 2026-11',
        totalShared: 40000,
        expensesCount: 2,
        members: [],
        settlements: [],
      }),
    );

    const res = await controller.getSharedBalance('2026-11');
    expect(res.totalShared).toBe(40000);
    expect(mockService.getSharedBalance).toHaveBeenCalledWith({
      month: '2026-11',
      startDate: undefined,
      endDate: undefined,
    });
  });
});
