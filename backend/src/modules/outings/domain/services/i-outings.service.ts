import { Result } from '../../../../common/errors/result.mapper';
import {
  AddOutingExpenseDto,
  AddOutingParticipantDto,
  CreateOutingDto,
  OutingBalanceResponseDto,
  OutingExpenseResponseDto,
  OutingParticipantResponseDto,
  OutingSummaryResponseDto,
  SettleOutingDto,
} from '../../presentation/dtos/outing.dto';
import { OutingStatus } from '../interfaces/outing.interface';

export abstract class IOutingsService {
  abstract createOuting(dto: CreateOutingDto): Promise<Result<OutingSummaryResponseDto>>;
  abstract listOutings(status?: OutingStatus): Promise<Result<OutingSummaryResponseDto[]>>;
  abstract addParticipant(
    outingRef: string,
    dto: AddOutingParticipantDto,
  ): Promise<Result<OutingParticipantResponseDto>>;
  abstract addExpense(
    outingRef: string,
    dto: AddOutingExpenseDto,
  ): Promise<Result<OutingExpenseResponseDto>>;
  abstract deleteExpense(
    expenseId: string,
  ): Promise<Result<{ deleted: boolean; id: string }>>;
  abstract getOutingBalance(outingRef: string): Promise<Result<OutingBalanceResponseDto>>;
  abstract settleOuting(
    outingRef: string,
    dto: SettleOutingDto,
  ): Promise<
    Result<{
      outing: OutingSummaryResponseDto;
      balance: OutingBalanceResponseDto;
      recordedPersonalExpenseId?: string;
    }>
  >;
  abstract deleteOuting(
    outingRef: string,
  ): Promise<Result<{ deleted: boolean; id: string; slug: string }>>;
}
