export class InstallmentItemDto {
  installmentId: string;
  expenseId: string;
  merchantName: string;
  description: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: number;
  dueDate: string;
  status: string;
  cardBank?: string;
  cardName?: string;
  isExtension?: boolean;
  holderName?: string;
}

export class MonthlyInstallmentsSummaryDto {
  month: string; // YYYY-MM
  totalAmountDue: number;
  installmentsCount: number;
  items: InstallmentItemDto[];
}
