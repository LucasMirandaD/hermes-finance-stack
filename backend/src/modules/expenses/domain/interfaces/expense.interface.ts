import { ICreditCard } from './credit-card.interface';
import { IExpenseAllocation } from './expense-allocation.interface';
import { IExpenseInstallment } from './expense-installment.interface';
import { IMember } from './member.interface';

export type PaymentMethod = 'CASH' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'BANK_TRANSFER' | 'MERCADO_PAGO';
export type ExpenseSource = 'PAPERLESS_OCR' | 'CHAT_MESSAGE' | 'SMS_NOTIFICATION' | 'MANUAL';
export type ExpenseScope = 'PERSONAL' | 'SHARED';

export interface IExpense {
  id: string;
  description: string;
  merchantName: string;
  totalAmount: number;
  currency: string;
  expenseDate: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  bankName?: string;
  creditCardId?: string;
  creditCard?: ICreditCard;
  scope: ExpenseScope;
  isFixed: boolean;
  paidByMemberId?: string;
  paidByMember?: IMember;
  recurringExpenseId?: string;
  allocations?: IExpenseAllocation[];
  isInstallment: boolean;
  totalInstallments: number;
  intervalMonths: number;
  installmentsPlan?: IExpenseInstallment[];
  category: string;
  source: ExpenseSource;
  rawSourceText?: string;
  paperlessDocumentId?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
