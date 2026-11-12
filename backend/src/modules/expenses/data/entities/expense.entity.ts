import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { CreditCardEntity } from './credit-card.entity';
import { ExpenseInstallmentEntity } from './expense-installment.entity';
import {
  ExpenseSource,
  IExpense,
  PaymentMethod,
} from '../../domain/interfaces/expense.interface';

@Entity('expenses')
@Index('idx_expenses_date', ['expenseDate'])
@Index('idx_expenses_card', ['creditCardId'])
@Index('idx_expenses_source', ['source'])
export class ExpenseEntity implements IExpense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ name: 'merchant_name', type: 'varchar', length: 150 })
  merchantName: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 14, scale: 2 })
  totalAmount: number;

  @Column({ type: 'varchar', length: 3, default: 'ARS' })
  currency: string;

  @Column({ name: 'expense_date', type: 'date' })
  expenseDate: string;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: ['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'MERCADO_PAGO'],
    default: 'CREDIT_CARD',
  })
  paymentMethod: PaymentMethod;

  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true })
  bankName?: string;

  @Column({ name: 'credit_card_id', type: 'uuid', nullable: true })
  creditCardId?: string;

  @ManyToOne(() => CreditCardEntity, (card) => card.expenses, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'credit_card_id' })
  creditCard?: CreditCardEntity;

  @Column({ name: 'is_installment', type: 'boolean', default: false })
  isInstallment: boolean;

  @Column({ name: 'total_installments', type: 'integer', default: 1 })
  totalInstallments: number;

  @Column({ name: 'interval_months', type: 'integer', default: 1 })
  intervalMonths: number;

  @OneToMany(() => ExpenseInstallmentEntity, (inst) => inst.expense, {
    cascade: true,
    eager: true,
  })
  installmentsPlan: ExpenseInstallmentEntity[];

  @Column({ type: 'varchar', length: 100, default: 'GENERAL' })
  category: string;

  @Column({
    type: 'enum',
    enum: ['PAPERLESS_OCR', 'CHAT_MESSAGE', 'SMS_NOTIFICATION', 'MANUAL'],
    default: 'MANUAL',
  })
  source: ExpenseSource;

  @Column({ name: 'raw_source_text', type: 'text', nullable: true })
  rawSourceText?: string;

  @Column({ name: 'paperless_document_id', type: 'integer', nullable: true })
  paperlessDocumentId?: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
