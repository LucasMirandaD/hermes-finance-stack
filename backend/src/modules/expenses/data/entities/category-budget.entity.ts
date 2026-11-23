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
import { BudgetScope, ICategoryBudget } from '../../domain/interfaces/category-budget.interface';
import { MemberEntity } from './member.entity';

@Entity('category_budgets')
@Index('idx_budgets_category_currency', ['category', 'currency'])
@Index('idx_budgets_active', ['isActive'])
export class CategoryBudgetEntity implements ICategoryBudget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  category: string;

  @Column({ name: 'monthly_amount', type: 'decimal', precision: 14, scale: 2 })
  monthlyAmount: number;

  @Column({ type: 'varchar', length: 3, default: 'ARS' })
  currency: string;

  @Column({ name: 'alert_threshold_pct', type: 'smallint', default: 80 })
  alertThresholdPct: number;

  @Column({ type: 'varchar', length: 20, default: 'ALL' })
  scope: BudgetScope;

  @Column({ name: 'member_id', type: 'uuid', nullable: true })
  memberId?: string;

  @ManyToOne(() => MemberEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'member_id' })
  member?: MemberEntity;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
