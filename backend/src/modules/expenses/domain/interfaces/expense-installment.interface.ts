export type InstallmentStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export interface IExpenseInstallment {
  id: string;
  expenseId: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  status: InstallmentStatus;
  paidAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
