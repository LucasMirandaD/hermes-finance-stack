import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { OutingsController } from './outings.controller';
import { IOutingsService } from '../../domain/services/i-outings.service';
import { Result } from '../../../../common/errors/result.mapper';
import { NotFound } from '../../../../common/errors/errors';
import { NotFoundException } from '@nestjs/common';

describe('OutingsController', () => {
  let controller: OutingsController;
  let mockService: Partial<Record<keyof IOutingsService, Mock>>;

  beforeEach(async () => {
    mockService = {
      createOuting: vi.fn(),
      listOutings: vi.fn(),
      addParticipant: vi.fn(),
      addExpense: vi.fn(),
      deleteExpense: vi.fn(),
      getOutingBalance: vi.fn(),
      settleOuting: vi.fn(),
      deleteOuting: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OutingsController],
      providers: [
        {
          provide: IOutingsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<OutingsController>(OutingsController);
    vi.clearAllMocks();
  });

  it('should create outing and return summary', async () => {
    mockService.createOuting!.mockResolvedValue(
      Result.ok({
        id: 'o1',
        slug: 'asado-sabado',
        name: 'Asado sábado',
        eventDate: '2026-11-23',
        currency: 'ARS',
        status: 'OPEN',
        participantsCount: 2,
        expensesCount: 0,
        totalSpent: 0,
        participants: [],
        createdAt: new Date(),
      }),
    );

    const res = await controller.createOuting({
      name: 'Asado sábado',
      participants: ['Alice', 'Juan'],
    });
    expect(res.slug).toBe('asado-sabado');
  });

  it('should throw NotFoundException when outing does not exist', async () => {
    mockService.getOutingBalance!.mockResolvedValue(
      Result.fail(new NotFound("Outing 'inexistente'")),
    );
    await expect(controller.getOutingBalance('inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });
});
