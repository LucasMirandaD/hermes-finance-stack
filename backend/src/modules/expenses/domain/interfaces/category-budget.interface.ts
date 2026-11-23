import { IMember } from './member.interface';

export type BudgetScope = 'ALL' | 'PERSONAL' | 'SHARED';

export interface ICategoryBudget {
  id: string;
  category: string;
  monthlyAmount: number;
  currency: string;
  alertThresholdPct: number;
  scope: BudgetScope;
  memberId?: string;
  member?: IMember;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
