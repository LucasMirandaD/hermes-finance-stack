export interface IOutingParticipant {
  id: string;
  outingId: string;
  name: string;
  slug: string;
  memberId?: string;
  aliases: string[];
  createdAt: Date;
}
