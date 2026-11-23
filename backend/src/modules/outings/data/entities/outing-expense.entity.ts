import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import {
  IOutingExpense,
  IOutingExpenseShare,
  OutingSplitMode,
} from '../../domain/interfaces/outing-expense.interface';
import { OutingEntity } from './outing.entity';
import { OutingParticipantEntity } from './outing-participant.entity';

@Entity('outing_expenses')
@Index('idx_outing_expenses_outing', ['outingId'])
@Index('idx_outing_expenses_payer', ['paidByParticipantId'])
export class OutingExpenseEntity implements IOutingExpense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'outing_id', type: 'uuid' })
  outingId: string;

  @ManyToOne(() => OutingEntity, (outing) => outing.expenses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'outing_id' })
  outing: OutingEntity;

  @Column({ name: 'paid_by_participant_id', type: 'uuid' })
  paidByParticipantId: string;

  @ManyToOne(() => OutingParticipantEntity, {
    onDelete: 'RESTRICT',
    eager: true,
  })
  @JoinColumn({ name: 'paid_by_participant_id' })
  paidByParticipant: OutingParticipantEntity;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ name: 'merchant_name', type: 'varchar', length: 150, nullable: true })
  merchantName?: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  @Column({ name: 'expense_date', type: 'date' })
  expenseDate: string;

  @Column({ name: 'split_mode', type: 'varchar', length: 20, default: 'EQUAL' })
  splitMode: OutingSplitMode;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  shares: IOutingExpenseShare[];

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
