export class ExpenseResponseDto {
  id: string;
  description: string;
  merchantName: string;
  totalAmount: number;
  currency: string;
  expenseDate: string;
  paymentMethod: string;
  bankName?: string;
  scope: string;
  isFixed: boolean;
  recurringExpenseId?: string;
  paidByMember?: {
    id: string;
    slug: string;
    displayName: string;
  };
  allocations?: {
    memberId: string;
    memberSlug: string;
    displayName: string;
    percentage: number;
    amount: number;
  }[];
  isInstallment: boolean;
  totalInstallments: number;
  intervalMonths: number;
  category: string;
  source: string;
  creditCard?: {
    id: string;
    bank: string;
    cardName: string;
    isExtension: boolean;
    holderName: string;
  };
  installments?: {
    id: string;
    installmentNumber: number;
    totalInstallments: number;
    amount: number;
    dueDate: string;
    status: string;
  }[];
  createdAt: Date;
}
