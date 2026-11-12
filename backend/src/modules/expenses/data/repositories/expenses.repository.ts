import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { IExpensesRepository } from './i-expenses.repository';
import { ExpenseEntity } from '../entities/expense.entity';
import { CreditCardEntity } from '../entities/credit-card.entity';
import { ExpenseInstallmentEntity } from '../entities/expense-installment.entity';

@Injectable()
export class ExpensesRepository implements IExpensesRepository {
  constructor(
    @InjectRepository(ExpenseEntity)
    private readonly expenseRepo: Repository<ExpenseEntity>,
    @InjectRepository(CreditCardEntity)
    private readonly cardRepo: Repository<CreditCardEntity>,
    @InjectRepository(ExpenseInstallmentEntity)
    private readonly installmentRepo: Repository<ExpenseInstallmentEntity>,
  ) {}

  async saveExpense(expense: Partial<ExpenseEntity>): Promise<ExpenseEntity> {
    return this.expenseRepo.save(expense);
  }

  async findExpenseById(id: string): Promise<ExpenseEntity | null> {
    return this.expenseRepo.findOne({
      where: { id },
      relations: { creditCard: true, installmentsPlan: true },
    });
  }

  async findExpenses(limit = 50, offset = 0): Promise<ExpenseEntity[]> {
    return this.expenseRepo.find({
      order: { expenseDate: 'DESC', createdAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: { creditCard: true, installmentsPlan: true },
    });
  }

  async findInstallmentsByDueDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ExpenseInstallmentEntity[]> {
    return this.installmentRepo.find({
      where: {
        dueDate: Between(startDate, endDate),
      },
      order: { dueDate: 'ASC' },
      relations: { expense: { creditCard: true } },
    });
  }

  async findPendingInstallments(creditCardId?: string): Promise<ExpenseInstallmentEntity[]> {
    const query = this.installmentRepo
      .createQueryBuilder('inst')
      .innerJoinAndSelect('inst.expense', 'exp')
      .leftJoinAndSelect('exp.creditCard', 'card')
      .where('inst.status = :status', { status: 'PENDING' });

    if (creditCardId) {
      query.andWhere('exp.credit_card_id = :creditCardId', { creditCardId });
    }

    return query.orderBy('inst.dueDate', 'ASC').getMany();
  }

  async findInstallmentById(id: string): Promise<ExpenseInstallmentEntity | null> {
    return this.installmentRepo.findOne({
      where: { id },
      relations: { expense: { creditCard: true } },
    });
  }

  async saveInstallment(installment: ExpenseInstallmentEntity): Promise<ExpenseInstallmentEntity> {
    return this.installmentRepo.save(installment);
  }

  private resolveSearchAlias(searchTerm?: string): string | undefined {
    const ALIASES: Record<string, string> = {
      aysam: 'agua',
      edemsa: 'electricidad',
    };
    const cleanTerm = searchTerm?.trim().toLowerCase();
    return cleanTerm ? ALIASES[cleanTerm] || cleanTerm : undefined;
  }

  async searchPendingInstallments(searchTerm?: string, dueDate?: string): Promise<ExpenseInstallmentEntity[]> {
    const query = this.installmentRepo
      .createQueryBuilder('inst')
      .innerJoinAndSelect('inst.expense', 'exp')
      .leftJoinAndSelect('exp.creditCard', 'card')
      .where('inst.status = :status', { status: 'PENDING' });

    const resolvedTerm = this.resolveSearchAlias(searchTerm);
    if (resolvedTerm) {
      query.andWhere(
        '(LOWER(exp.merchantName) LIKE :term OR LOWER(exp.description) LIKE :term OR LOWER(COALESCE(exp.rawSourceText, \'\')) LIKE :term)',
        { term: `%${resolvedTerm}%` },
      );
    }

    if (dueDate) {
      query.andWhere('inst.dueDate = :dueDate', { dueDate });
    }

    return query.orderBy('inst.dueDate', 'ASC').getMany();
  }

  async saveCreditCard(card: Partial<CreditCardEntity>): Promise<CreditCardEntity> {
    return this.cardRepo.save(card);
  }

  async findCreditCards(): Promise<CreditCardEntity[]> {
    return this.cardRepo.find({
      where: { isActive: true },
      order: { bank: 'ASC', cardName: 'ASC' },
    });
  }

  async findCreditCardById(id: string): Promise<CreditCardEntity | null> {
    return this.cardRepo.findOne({ where: { id } });
  }

  async findCreditCardByDetails(
    bank: string,
    cardName: string,
    holderName?: string,
  ): Promise<CreditCardEntity | null> {
    const query = this.cardRepo
      .createQueryBuilder('card')
      .where('LOWER(card.bank) = LOWER(:bank)', { bank })
      .andWhere('LOWER(card.cardName) = LOWER(:cardName)', { cardName });

    if (holderName) {
      query.andWhere('LOWER(card.holderName) LIKE LOWER(:holderName)', {
        holderName: `%${holderName}%`,
      });
    }

    return query.getOne();
  }

  async findExpensesByDateRange(
    startDate: string,
    endDate: string,
    isInstallment?: boolean,
  ): Promise<ExpenseEntity[]> {
    const query = this.expenseRepo
      .createQueryBuilder('exp')
      .leftJoinAndSelect('exp.creditCard', 'card')
      .where('exp.expenseDate BETWEEN :startDate AND :endDate', { startDate, endDate });

    if (isInstallment !== undefined) {
      query.andWhere('exp.isInstallment = :isInstallment', { isInstallment });
    }

    return query.orderBy('exp.expenseDate', 'DESC').getMany();
  }

  async findPaidInstallmentsByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ExpenseInstallmentEntity[]> {
    return this.installmentRepo
      .createQueryBuilder('inst')
      .innerJoinAndSelect('inst.expense', 'exp')
      .leftJoinAndSelect('exp.creditCard', 'card')
      .where('inst.status = :status', { status: 'PAID' })
      .andWhere(
        '((inst.paidAt IS NOT NULL AND DATE(inst.paidAt) BETWEEN :startDate AND :endDate) OR (inst.paidAt IS NULL AND inst.dueDate BETWEEN :startDate AND :endDate))',
        { startDate, endDate },
      )
      .orderBy('inst.dueDate', 'ASC')
      .getMany();
  }

  async findPendingInstallmentsByDueDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ExpenseInstallmentEntity[]> {
    return this.installmentRepo
      .createQueryBuilder('inst')
      .innerJoinAndSelect('inst.expense', 'exp')
      .leftJoinAndSelect('exp.creditCard', 'card')
      .where('inst.status = :status', { status: 'PENDING' })
      .andWhere('inst.dueDate BETWEEN :startDate AND :endDate', { startDate, endDate })
      .orderBy('inst.dueDate', 'ASC')
      .getMany();
  }

  async findUpcomingPendingInstallments(days = 30): Promise<ExpenseInstallmentEntity[]> {
    return this.installmentRepo
      .createQueryBuilder('inst')
      .innerJoinAndSelect('inst.expense', 'exp')
      .leftJoinAndSelect('exp.creditCard', 'card')
      .where('inst.status = :status', { status: 'PENDING' })
      .andWhere(`inst.dueDate <= CURRENT_DATE + (:days * INTERVAL '1 day')`, { days })
      .orderBy('inst.dueDate', 'ASC')
      .getMany();
  }

  async searchExpensesAndInstallments(
    searchTerm?: string,
    category?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{ expenses: ExpenseEntity[]; installments: ExpenseInstallmentEntity[] }> {
    const resolvedTerm = this.resolveSearchAlias(searchTerm);

    const expQuery = this.expenseRepo
      .createQueryBuilder('exp')
      .leftJoinAndSelect('exp.creditCard', 'card')
      .where('exp.isInstallment = false');

    if (resolvedTerm) {
      expQuery.andWhere(
        '(LOWER(exp.merchantName) LIKE :term OR LOWER(exp.description) LIKE :term OR LOWER(COALESCE(exp.rawSourceText, \'\')) LIKE :term)',
        { term: `%${resolvedTerm}%` },
      );
    }
    if (category) {
      expQuery.andWhere('LOWER(exp.category) = LOWER(:category)', { category });
    }
    if (startDate && endDate) {
      expQuery.andWhere('exp.expenseDate BETWEEN :startDate AND :endDate', { startDate, endDate });
    }
    const expenses = await expQuery.orderBy('exp.expenseDate', 'DESC').getMany();

    const instQuery = this.installmentRepo
      .createQueryBuilder('inst')
      .innerJoinAndSelect('inst.expense', 'exp')
      .leftJoinAndSelect('exp.creditCard', 'card');

    if (resolvedTerm) {
      instQuery.andWhere(
        '(LOWER(exp.merchantName) LIKE :term OR LOWER(exp.description) LIKE :term OR LOWER(COALESCE(exp.rawSourceText, \'\')) LIKE :term OR LOWER(COALESCE(inst.notes, \'\')) LIKE :term)',
        { term: `%${resolvedTerm}%` },
      );
    }
    if (category) {
      instQuery.andWhere('LOWER(exp.category) = LOWER(:category)', { category });
    }
    if (startDate && endDate) {
      instQuery.andWhere('inst.dueDate BETWEEN :startDate AND :endDate', { startDate, endDate });
    }
    const installments = await instQuery.orderBy('inst.dueDate', 'DESC').getMany();

    return { expenses, installments };
  }

  async deleteExpense(id: string): Promise<boolean> {
    const result = await this.expenseRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async deleteInstallment(id: string): Promise<boolean> {
    const result = await this.installmentRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async updateExpensePaperlessId(id: string, paperlessDocumentId: number): Promise<void> {
    await this.expenseRepo.update(id, { paperlessDocumentId });
  }
}
