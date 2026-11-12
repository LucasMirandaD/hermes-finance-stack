import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ExpenseEntity } from './expense.entity';
import { ICreditCard } from '../../domain/interfaces/credit-card.interface';

@Entity('credit_cards')
@Index('idx_credit_cards_bank_name', ['bank', 'cardName'])
@Index('idx_credit_cards_holder', ['holderName'])
export class CreditCardEntity implements ICreditCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  bank: string;

  @Column({ name: 'card_name', type: 'varchar', length: 100 })
  cardName: string;

  @Column({ name: 'last_four_digits', type: 'varchar', length: 4, nullable: true })
  lastFourDigits?: string;

  @Column({ name: 'is_extension', type: 'boolean', default: false })
  isExtension: boolean;

  @Column({ name: 'holder_name', type: 'varchar', length: 150 })
  holderName: string;

  @Column({ name: 'closing_day', type: 'smallint', nullable: true })
  closingDay?: number;

  @Column({ name: 'due_day', type: 'smallint', nullable: true })
  dueDay?: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => ExpenseEntity, (expense) => expense.creditCard)
  expenses: ExpenseEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
