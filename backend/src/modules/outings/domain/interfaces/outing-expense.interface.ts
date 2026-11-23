export type OutingSplitMode = 'EQUAL' | 'SUBSET' | 'EXACT' | 'PERCENTAGE';

export interface IOutingExpenseShare {
  participantId: string;
  participantName: string;
  participantSlug: string;
  amount: number;
  percentage?: number;
}

export interface IOutingExpense {
  id: string;
  outingId: string;
  paidByParticipantId: string;
  description: string;
  merchantName?: string;
  amount: number;
  expenseDate: string; // YYYY-MM-DD
  splitMode: OutingSplitMode;
  shares: IOutingExpenseShare[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
