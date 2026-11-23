import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { MembersController } from './members.controller';
import { IExpensesService } from '../../domain/services/i-expenses.service';
import { Result } from '../../../../common/errors/result.mapper';

describe('MembersController', () => {
  let controller: MembersController;
  let mockService: Partial<Record<keyof IExpensesService, Mock>>;

  beforeEach(async () => {
    mockService = {
      listMembers: vi.fn(),
      createMember: vi.fn(),
      updateMember: vi.fn(),
      deleteMember: vi.fn(),
      getSharedBalance: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MembersController],
      providers: [
        {
          provide: IExpensesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<MembersController>(MembersController);
    vi.clearAllMocks();
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

  it('should create a household member', async () => {
    mockService.createMember!.mockResolvedValue(
      Result.ok({ id: 'm1', slug: 'alice', displayName: 'Alice' }),
    );

    const res = await controller.createMember({ displayName: 'Alice' });
    expect(res.slug).toBe('alice');
  });
});
