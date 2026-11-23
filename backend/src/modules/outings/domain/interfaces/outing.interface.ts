export type OutingStatus = 'OPEN' | 'SETTLED' | 'ARCHIVED';

export interface IOuting {
  id: string;
  slug: string;
  name: string;
  description?: string;
  eventDate: string; // YYYY-MM-DD
  currency: string;
  status: OutingStatus;
  createdByMemberId?: string;
  createdAt: Date;
  updatedAt: Date;
}
