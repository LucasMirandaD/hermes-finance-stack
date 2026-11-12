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
import { ExpenseEntity } from './expense.entity';
import {
  IExpenseInstallment,
  InstallmentStatus,
} from '../../domain/interfaces/expense-installment.interface';

@Entity('expense_installments')
@Index('idx_installments_due_date', ['dueDate'])
@Index('idx_installments_status', ['status'])
@Index('idx_installments_expense', ['expenseId'])
export class ExpenseInstallmentEntity implements IExpenseInstallment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'expense_id', type: 'uuid' })
  expenseId: string;

  @ManyToOne(() => ExpenseEntity, (expense) => expense.installmentsPlan, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'expense_id' })
  expense: ExpenseEntity;

  @Column({ name: 'installment_number', type: 'smallint' })
  installmentNumber: number;

  @Column({ name: 'total_installments', type: 'smallint' })
  totalInstallments: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string; // YYYY-MM-DD

  @Column({
    type: 'enum',
    enum: ['PENDING', 'PAID', 'CANCELLED'],
    default: 'PENDING',
  })
  status: InstallmentStatus;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
