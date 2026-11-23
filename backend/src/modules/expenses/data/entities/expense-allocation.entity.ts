import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { IExpenseAllocation } from '../../domain/interfaces/expense-allocation.interface';
import { ExpenseEntity } from './expense.entity';
import { MemberEntity } from './member.entity';

@Entity('expense_allocations')
@Index('idx_allocations_expense', ['expenseId'])
@Index('idx_allocations_member', ['memberId'])
export class ExpenseAllocationEntity implements IExpenseAllocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'expense_id', type: 'uuid' })
  expenseId: string;

  @ManyToOne(() => ExpenseEntity, (expense) => expense.allocations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'expense_id' })
  expense: ExpenseEntity;

  @Column({ name: 'member_id', type: 'uuid' })
  memberId: string;

  @ManyToOne(() => MemberEntity, {
    onDelete: 'CASCADE',
    eager: true,
  })
  @JoinColumn({ name: 'member_id' })
  member: MemberEntity;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  percentage: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
