export interface ICreditCard {
  id: string;
  bank: string;
  cardName: string;
  lastFourDigits?: string;
  isExtension: boolean;
  holderName: string;
  closingDay?: number;
  dueDay?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
