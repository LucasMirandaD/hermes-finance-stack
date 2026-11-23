import { IMember } from './member.interface';

export interface IExpenseAllocation {
  id: string;
  expenseId: string;
  memberId: string;
  member?: IMember;
  percentage: number;
  amount: number;
  createdAt: Date;
}
