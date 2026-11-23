export interface IMember {
  id: string;
  slug: string;
  displayName: string;
  telegramUsername?: string;
  telegramId?: string;
  aliases: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
