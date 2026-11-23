import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { IMember } from '../../domain/interfaces/member.interface';

@Entity('members')
@Index('idx_members_slug', ['slug'], { unique: true })
@Index('idx_members_telegram_username', ['telegramUsername'])
@Index('idx_members_telegram_id', ['telegramId'])
export class MemberEntity implements IMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80, unique: true })
  slug: string;

  @Column({ name: 'display_name', type: 'varchar', length: 150 })
  displayName: string;

  @Column({ name: 'telegram_username', type: 'varchar', length: 100, nullable: true, unique: true })
  telegramUsername?: string;

  @Column({ name: 'telegram_id', type: 'varchar', length: 64, nullable: true, unique: true })
  telegramId?: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  aliases: string[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
