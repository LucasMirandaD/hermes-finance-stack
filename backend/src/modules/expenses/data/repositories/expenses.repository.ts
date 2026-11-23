import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, IsNull, Repository } from 'typeorm';
import { DatabaseHealthStats, IExpensesRepository } from './i-expenses.repository';
import { ExpenseEntity } from '../entities/expense.entity';
import { CreditCardEntity } from '../entities/credit-card.entity';
import { ExpenseInstallmentEntity } from '../entities/expense-installment.entity';
import { MemberEntity } from '../entities/member.entity';
import { ExpenseAllocationEntity } from '../entities/expense-allocation.entity';
import { CategoryBudgetEntity } from '../entities/category-budget.entity';
import { RecurringExpenseEntity } from '../entities/recurring-expense.entity';
import { BudgetScope } from '../../domain/interfaces/category-budget.interface';

@Injectable()
export class ExpensesRepository implements IExpensesRepository {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(ExpenseEntity)
    private readonly expenseRepo: Repository<ExpenseEntity>,
    @InjectRepository(CreditCardEntity)
    private readonly cardRepo: Repository<CreditCardEntity>,
    @InjectRepository(ExpenseInstallmentEntity)
    private readonly installmentRepo: Repository<ExpenseInstallmentEntity>,
    @InjectRepository(MemberEntity)
    private readonly memberRepo: Repository<MemberEntity>,
    @InjectRepository(ExpenseAllocationEntity)
    private readonly allocationRepo: Repository<ExpenseAllocationEntity>,
    @InjectRepository(CategoryBudgetEntity)
    private readonly budgetRepo: Repository<CategoryBudgetEntity>,
    @InjectRepository(RecurringExpenseEntity)
    private readonly recurringRepo: Repository<RecurringExpenseEntity>,
  ) {}

  async checkDatabaseHealth(): Promise<DatabaseHealthStats> {
    await this.dataSource.query('SELECT 1');
    const [expenses, creditCards, members, recurringExpenses, budgets] = await Promise.all([
      this.expenseRepo.count(),
      this.cardRepo.count({ where: { isActive: true } }),
      this.memberRepo.count({ where: { isActive: true } }),
      this.recurringRepo.count({ where: { isActive: true } }),
      this.budgetRepo.count({ where: { isActive: true } }),
    ]);

    return {
      connected: true,
      counts: {
        expenses,
        creditCards,
        members,
        recurringExpenses,
        budgets,
      },
    };
  }

  async saveExpense(expense: Partial<ExpenseEntity>): Promise<ExpenseEntity> {
    return this.expenseRepo.save(expense);
  }

  async findExpenseById(id: string): Promise<ExpenseEntity | null> {
    return this.expenseRepo.findOne({
      where: { id },
      relations: {
        creditCard: true,
        installmentsPlan: true,
        paidByMember: true,
        allocations: { member: true },
      },
    });
  }

  async findExpenses(limit = 50, offset = 0): Promise<ExpenseEntity[]> {
    return this.expenseRepo.find({
      order: { expenseDate: 'DESC', createdAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: {
        creditCard: true,
        installmentsPlan: true,
        paidByMember: true,
        allocations: { member: true },
      },
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
      relations: {
        expense: {
          creditCard: true,
          paidByMember: true,
          allocations: { member: true },
        },
      },
    });
  }

  async findPendingInstallments(creditCardId?: string): Promise<ExpenseInstallmentEntity[]> {
    const query = this.installmentRepo
      .createQueryBuilder('inst')
      .innerJoinAndSelect('inst.expense', 'exp')
      .leftJoinAndSelect('exp.creditCard', 'card')
      .leftJoinAndSelect('exp.paidByMember', 'paidByMember')
      .leftJoinAndSelect('exp.allocations', 'allocations')
      .leftJoinAndSelect('allocations.member', 'allocationMember')
      .where('inst.status = :status', { status: 'PENDING' });

    if (creditCardId) {
      query.andWhere('exp.credit_card_id = :creditCardId', { creditCardId });
    }

    return query.orderBy('inst.dueDate', 'ASC').getMany();
  }

  async findInstallmentById(id: string): Promise<ExpenseInstallmentEntity | null> {
    return this.installmentRepo.findOne({
      where: { id },
      relations: {
        expense: {
          creditCard: true,
          paidByMember: true,
          allocations: { member: true },
        },
      },
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

  async searchPendingInstallments(
    searchTerm?: string,
    dueDate?: string,
  ): Promise<ExpenseInstallmentEntity[]> {
    const query = this.installmentRepo
      .createQueryBuilder('inst')
      .innerJoinAndSelect('inst.expense', 'exp')
      .leftJoinAndSelect('exp.creditCard', 'card')
      .leftJoinAndSelect('exp.paidByMember', 'paidByMember')
      .where('inst.status = :status', { status: 'PENDING' });

    const resolvedTerm = this.resolveSearchAlias(searchTerm);
    if (resolvedTerm) {
      query.andWhere(
        "(LOWER(exp.merchantName) LIKE :term OR LOWER(exp.description) LIKE :term OR LOWER(COALESCE(exp.rawSourceText, '')) LIKE :term)",
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
      .leftJoinAndSelect('exp.paidByMember', 'paidByMember')
      .leftJoinAndSelect('exp.allocations', 'allocations')
      .leftJoinAndSelect('allocations.member', 'allocationMember')
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
      .leftJoinAndSelect('exp.paidByMember', 'paidByMember')
      .leftJoinAndSelect('exp.allocations', 'allocations')
      .leftJoinAndSelect('allocations.member', 'allocationMember')
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
      .leftJoinAndSelect('exp.paidByMember', 'paidByMember')
      .leftJoinAndSelect('exp.allocations', 'allocations')
      .leftJoinAndSelect('allocations.member', 'allocationMember')
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
      .leftJoinAndSelect('exp.paidByMember', 'paidByMember')
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
      .leftJoinAndSelect('exp.paidByMember', 'paidByMember')
      .leftJoinAndSelect('exp.allocations', 'allocations')
      .leftJoinAndSelect('allocations.member', 'allocationMember')
      .where('exp.isInstallment = false');

    if (resolvedTerm) {
      expQuery.andWhere(
        "(LOWER(exp.merchantName) LIKE :term OR LOWER(exp.description) LIKE :term OR LOWER(COALESCE(exp.rawSourceText, '')) LIKE :term)",
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
      .leftJoinAndSelect('exp.creditCard', 'card')
      .leftJoinAndSelect('exp.paidByMember', 'paidByMember')
      .leftJoinAndSelect('exp.allocations', 'allocations')
      .leftJoinAndSelect('allocations.member', 'allocationMember');

    if (resolvedTerm) {
      instQuery.andWhere(
        "(LOWER(exp.merchantName) LIKE :term OR LOWER(exp.description) LIKE :term OR LOWER(COALESCE(exp.rawSourceText, '')) LIKE :term OR LOWER(COALESCE(inst.notes, '')) LIKE :term)",
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

  // --- Members & Shared Allocations ---

  async saveMember(member: Partial<MemberEntity>): Promise<MemberEntity> {
    return this.memberRepo.save(member);
  }

  async findMembers(activeOnly = true): Promise<MemberEntity[]> {
    return this.memberRepo.find({
      where: activeOnly ? { isActive: true } : {},
      order: { createdAt: 'ASC' },
    });
  }

  async findMemberByRef(ref: string): Promise<MemberEntity | null> {
    const clean = ref?.trim();
    if (!clean) return null;

    const cleanLower = clean.toLowerCase();
    const cleanHandle = cleanLower.replace(/^@/, '');
    const members = await this.memberRepo.find({ order: { createdAt: 'ASC' } });

    return (
      members.find((m) => m.id === clean) ||
      members.find((m) => m.slug.toLowerCase() === cleanLower) ||
      members.find((m) => m.telegramId && m.telegramId === clean) ||
      members.find(
        (m) => m.telegramUsername && m.telegramUsername.toLowerCase().replace(/^@/, '') === cleanHandle,
      ) ||
      members.find((m) => m.displayName.toLowerCase() === cleanLower) ||
      members.find((m) =>
        (m.aliases || []).some((alias) => String(alias).trim().toLowerCase() === cleanLower),
      ) ||
      null
    );
  }

  async deleteMember(id: string): Promise<boolean> {
    const result = await this.memberRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async countMemberReferences(memberId: string): Promise<number> {
    const [paidCount, allocCount] = await Promise.all([
      this.expenseRepo.count({ where: { paidByMemberId: memberId } }),
      this.allocationRepo.count({ where: { memberId } }),
    ]);
    return paidCount + allocCount;
  }

  async replaceExpenseAllocations(
    expenseId: string,
    allocations: Array<Partial<ExpenseAllocationEntity>>,
  ): Promise<void> {
    await this.allocationRepo.delete({ expenseId });
    if (allocations.length > 0) {
      await this.allocationRepo.save(
        allocations.map((a) => ({ ...a, expenseId })),
      );
    }
  }

  async findSharedDirectExpenses(
    startDate?: string,
    endDate?: string,
  ): Promise<ExpenseEntity[]> {
    const query = this.expenseRepo
      .createQueryBuilder('exp')
      .leftJoinAndSelect('exp.creditCard', 'card')
      .leftJoinAndSelect('exp.paidByMember', 'paidByMember')
      .leftJoinAndSelect('exp.allocations', 'allocations')
      .leftJoinAndSelect('allocations.member', 'allocationMember')
      .where('exp.scope = :scope', { scope: 'SHARED' })
      .andWhere('exp.isInstallment = false');

    if (startDate && endDate) {
      query.andWhere('exp.expenseDate BETWEEN :startDate AND :endDate', { startDate, endDate });
    }

    return query.orderBy('exp.expenseDate', 'DESC').getMany();
  }

  async findSharedPaidInstallments(
    startDate?: string,
    endDate?: string,
  ): Promise<ExpenseInstallmentEntity[]> {
    const query = this.installmentRepo
      .createQueryBuilder('inst')
      .innerJoinAndSelect('inst.expense', 'exp')
      .leftJoinAndSelect('exp.creditCard', 'card')
      .leftJoinAndSelect('exp.paidByMember', 'paidByMember')
      .leftJoinAndSelect('exp.allocations', 'allocations')
      .leftJoinAndSelect('allocations.member', 'allocationMember')
      .where('exp.scope = :scope', { scope: 'SHARED' })
      .andWhere('inst.status = :status', { status: 'PAID' });

    if (startDate && endDate) {
      query.andWhere(
        '((inst.paidAt IS NOT NULL AND DATE(inst.paidAt) BETWEEN :startDate AND :endDate) OR (inst.paidAt IS NULL AND inst.dueDate BETWEEN :startDate AND :endDate))',
        { startDate, endDate },
      );
    }

    return query.orderBy('inst.dueDate', 'ASC').getMany();
  }

  // --- Budgets ---

  async saveBudget(budget: Partial<CategoryBudgetEntity>): Promise<CategoryBudgetEntity> {
    return this.budgetRepo.save(budget);
  }

  async findBudgets(activeOnly = true): Promise<CategoryBudgetEntity[]> {
    return this.budgetRepo.find({
      where: activeOnly ? { isActive: true } : {},
      relations: { member: true },
      order: { category: 'ASC' },
    });
  }

  async findBudgetById(id: string): Promise<CategoryBudgetEntity | null> {
    return this.budgetRepo.findOne({
      where: { id },
      relations: { member: true },
    });
  }

  async findBudgetByMatch(
    category: string,
    currency: string,
    scope: BudgetScope,
    memberId?: string,
  ): Promise<CategoryBudgetEntity | null> {
    return this.budgetRepo.findOne({
      where: {
        category: category.toUpperCase(),
        currency: currency.toUpperCase(),
        scope,
        memberId: memberId ? memberId : IsNull(),
      },
      relations: { member: true },
    });
  }

  async deleteBudget(id: string): Promise<boolean> {
    const result = await this.budgetRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  // --- Recurring / Fixed Expenses ---

  async saveRecurringExpense(
    recurring: Partial<RecurringExpenseEntity>,
  ): Promise<RecurringExpenseEntity> {
    return this.recurringRepo.save(recurring);
  }

  async findRecurringExpenses(activeOnly = true): Promise<RecurringExpenseEntity[]> {
    return this.recurringRepo.find({
      where: activeOnly ? { isActive: true } : {},
      relations: { creditCard: true, paidByMember: true },
      order: { dayOfMonth: 'ASC', merchantName: 'ASC' },
    });
  }

  async findRecurringExpenseById(id: string): Promise<RecurringExpenseEntity | null> {
    return this.recurringRepo.findOne({
      where: { id },
      relations: { creditCard: true, paidByMember: true },
    });
  }

  async deleteRecurringExpense(id: string): Promise<boolean> {
    const result = await this.recurringRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async findFixedExpensesInDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ExpenseEntity[]> {
    return this.expenseRepo
      .createQueryBuilder('exp')
      .leftJoinAndSelect('exp.creditCard', 'card')
      .leftJoinAndSelect('exp.paidByMember', 'paidByMember')
      .where('exp.expenseDate BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('(exp.isFixed = true OR exp.recurringExpenseId IS NOT NULL)')
      .orderBy('exp.expenseDate', 'DESC')
      .getMany();
  }
}
