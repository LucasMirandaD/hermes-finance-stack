export class InstallmentItemDto {
  installmentId: string;
  expenseId: string;
  merchantName: string;
  description: string;
  installmentNumber: number;
  totalInstallments: number;
  isLastInstallment: boolean;
  amount: number;
  dueDate: string;
  status: string;
  scope: string;
  isFixed: boolean;
  cardBank?: string;
  cardName?: string;
  isExtension?: boolean;
  holderName?: string;
}

export class HolderInstallmentGroupDto {
  holderName: string;
  subtotal: number;
  count: number;
  items: InstallmentItemDto[];
}

export class MonthlyInstallmentsSummaryDto {
  month: string; // YYYY-MM
  totalAmountDue: number;
  installmentsCount: number;
  byHolder: HolderInstallmentGroupDto[];
  items: InstallmentItemDto[];
}
