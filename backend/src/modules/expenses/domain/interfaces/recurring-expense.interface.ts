import { ICreditCard } from './credit-card.interface';
import { ExpenseScope, PaymentMethod } from './expense.interface';
import { IMember } from './member.interface';

export type RecurringFrequency = 'MONTHLY' | 'BIMONTHLY' | 'YEARLY';

export interface IDefaultAllocation {
  memberSlug: string;
  percentage: number;
}

export interface IRecurringExpense {
  id: string;
  merchantName: string;
  description: string;
  category: string;
  estimatedAmount: number;
  currency: string;
  dayOfMonth: number;
  frequency: RecurringFrequency;
  paymentMethod: PaymentMethod;
  bankName?: string;
  creditCardId?: string;
  creditCard?: ICreditCard;
  scope: ExpenseScope;
  paidByMemberId?: string;
  paidByMember?: IMember;
  defaultAllocations?: IDefaultAllocation[];
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
