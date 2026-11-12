import { ICreditCard } from './credit-card.interface';
import { IExpenseInstallment } from './expense-installment.interface';

export type PaymentMethod = 'CASH' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'BANK_TRANSFER' | 'MERCADO_PAGO';
export type ExpenseSource = 'PAPERLESS_OCR' | 'CHAT_MESSAGE' | 'SMS_NOTIFICATION' | 'MANUAL';

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
