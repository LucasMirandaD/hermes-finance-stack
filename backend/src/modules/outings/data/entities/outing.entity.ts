import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { IOuting, OutingStatus } from '../../domain/interfaces/outing.interface';
import { OutingParticipantEntity } from './outing-participant.entity';
import { OutingExpenseEntity } from './outing-expense.entity';

@Entity('outings')
@Index('idx_outings_slug', ['slug'], { unique: true })
@Index('idx_outings_status', ['status'])
export class OutingEntity implements IOuting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'event_date', type: 'date' })
  eventDate: string;

  @Column({ type: 'varchar', length: 3, default: 'ARS' })
  currency: string;

  @Column({ type: 'varchar', length: 20, default: 'OPEN' })
  status: OutingStatus;

  @Column({ name: 'created_by_member_id', type: 'uuid', nullable: true })
  createdByMemberId?: string;

  @OneToMany(() => OutingParticipantEntity, (p) => p.outing, {
    cascade: true,
    eager: true,
  })
  participants: OutingParticipantEntity[];

  @OneToMany(() => OutingExpenseEntity, (e) => e.outing, {
    cascade: true,
  })
  expenses: OutingExpenseEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
