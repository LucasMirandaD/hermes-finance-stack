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
  IDefaultAllocation,
  IRecurringExpense,
  RecurringFrequency,
} from '../../domain/interfaces/recurring-expense.interface';
import { ExpenseScope, PaymentMethod } from '../../domain/interfaces/expense.interface';
import { CreditCardEntity } from './credit-card.entity';
import { MemberEntity } from './member.entity';

@Entity('recurring_expenses')
@Index('idx_recurring_active', ['isActive'])
@Index('idx_recurring_merchant', ['merchantName'])
export class RecurringExpenseEntity implements IRecurringExpense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_name', type: 'varchar', length: 150 })
  merchantName: string;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'varchar', length: 100, default: 'IMPUESTOS_Y_SERVICIOS' })
  category: string;

  @Column({ name: 'estimated_amount', type: 'decimal', precision: 14, scale: 2 })
  estimatedAmount: number;

  @Column({ type: 'varchar', length: 3, default: 'ARS' })
  currency: string;

  @Column({ name: 'day_of_month', type: 'smallint', default: 10 })
  dayOfMonth: number;

  @Column({ type: 'varchar', length: 20, default: 'MONTHLY' })
  frequency: RecurringFrequency;

  @Column({ name: 'payment_method', type: 'varchar', length: 30, default: 'BANK_TRANSFER' })
  paymentMethod: PaymentMethod;

  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true })
  bankName?: string;

  @Column({ name: 'credit_card_id', type: 'uuid', nullable: true })
  creditCardId?: string;

  @ManyToOne(() => CreditCardEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'credit_card_id' })
  creditCard?: CreditCardEntity;

  @Column({ type: 'varchar', length: 20, default: 'PERSONAL' })
  scope: ExpenseScope;

  @Column({ name: 'paid_by_member_id', type: 'uuid', nullable: true })
  paidByMemberId?: string;

  @ManyToOne(() => MemberEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'paid_by_member_id' })
  paidByMember?: MemberEntity;

  @Column({ name: 'default_allocations', type: 'jsonb', nullable: true })
  defaultAllocations?: IDefaultAllocation[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
