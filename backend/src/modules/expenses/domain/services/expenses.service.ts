import { Injectable, Logger } from '@nestjs/common';
import { IExpensesService } from './i-expenses.service';
import { IExpensesRepository } from '../../data/repositories/i-expenses.repository';
import { Result } from '../../../../common/errors/result.mapper';
import {
  BaseError,
  CouldNotSave,
  InvalidOperation,
  NotFound,
} from '../../../../common/errors/errors';
import { CreateExpenseDto } from '../../presentation/dtos/create-expense.dto';
import { CreateCreditCardDto } from '../../presentation/dtos/create-credit-card.dto';
import { ExpenseEntity } from '../../data/entities/expense.entity';
import { CreditCardEntity } from '../../data/entities/credit-card.entity';
import { ExpenseInstallmentEntity } from '../../data/entities/expense-installment.entity';
import { InstallmentPlanGenerator } from './installment-plan-generator';
import {
  InstallmentItemDto,
  MonthlyInstallmentsSummaryDto,
} from '../../presentation/dtos/installment-summary.dto';
import {
  FinancialSummaryQueryDto,
  FinancialSummaryResponseDto,
  CategoryBreakdownDto,
  BankBreakdownDto,
  UpcomingDueDto,
} from '../../presentation/dtos/financial-summary.dto';
import {
  SearchExpensesQueryDto,
  SearchExpensesResponseDto,
  SearchExpenseItemDto,
} from '../../presentation/dtos/search-expenses.dto';
import {
  UpdateExpenseDto,
  UpdateInstallmentDto,
} from '../../presentation/dtos/update-expense.dto';
import { ExpenseMapper } from '../../presentation/mappers/expense.mapper';

@Injectable()
export class ExpensesService implements IExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(private readonly expensesRepo: IExpensesRepository) {}

  async registerExpense(dto: CreateExpenseDto): Promise<Result<ExpenseEntity>> {
    try {
      let matchedCard: CreditCardEntity | null = null;

      // 1. Resolve Credit Card if provided
      if (dto.paymentMethod !== 'BANK_TRANSFER') {
        if (dto.creditCardId) {
          matchedCard = await this.expensesRepo.findCreditCardById(dto.creditCardId);
          if (!matchedCard) {
            return Result.fail(new NotFound(`CreditCard with id ${dto.creditCardId}`));
          }
        } else if (dto.cardBank && dto.cardName) {
          matchedCard = await this.expensesRepo.findCreditCardByDetails(
            dto.cardBank,
            dto.cardName,
            dto.cardHolder,
          );
        }
      }

      const totalInstallments = dto.totalInstallments && dto.totalInstallments > 1 ? dto.totalInstallments : 1;
      const isInstallment = dto.isInstallment || totalInstallments > 1;
      const intervalMonths = dto.intervalMonths && dto.intervalMonths > 0 ? dto.intervalMonths : 1;

      // 2. Generate Installments Plan if multi-installment
      const installmentsPlan: ExpenseInstallmentEntity[] = [];

      if (isInstallment) {
        const firstDueDate = dto.firstDueDate || this.calculateFirstDueDate(dto.expenseDate, matchedCard?.dueDay);
        const generated = InstallmentPlanGenerator.generate(
          dto.totalAmount,
          totalInstallments,
          firstDueDate,
          intervalMonths,
        );

        for (const item of generated) {
          const installment = new ExpenseInstallmentEntity();
          installment.installmentNumber = item.installmentNumber;
          installment.totalInstallments = item.totalInstallments;
          installment.amount = item.amount;
          installment.dueDate = item.dueDate;
          installment.status = 'PENDING';
          installmentsPlan.push(installment);
        }
      }

      // 3. Build Expense Entity
      const expense = new ExpenseEntity();
      expense.description = dto.description;
      expense.merchantName = dto.merchantName;
      expense.totalAmount = dto.totalAmount;
      expense.currency = dto.currency || 'ARS';
      expense.expenseDate = dto.expenseDate;
      expense.paymentMethod = dto.paymentMethod || (matchedCard ? 'CREDIT_CARD' : 'CASH');
      expense.bankName = dto.bankName || (dto.paymentMethod === 'BANK_TRANSFER' ? dto.cardBank : undefined);
      expense.creditCardId = matchedCard?.id;
      expense.creditCard = matchedCard || undefined;
      expense.isInstallment = isInstallment;
      expense.totalInstallments = totalInstallments;
      expense.intervalMonths = intervalMonths;
      expense.category = dto.category || 'GENERAL';
      expense.source = dto.source || 'MANUAL';
      expense.rawSourceText = dto.rawSourceText;
      expense.paperlessDocumentId = dto.paperlessDocumentId;
      expense.metadata = dto.metadata;
      expense.installmentsPlan = installmentsPlan;

      const saved = await this.expensesRepo.saveExpense(expense);
      this.logger.log(`Registered expense ${saved.id} - Total: ${saved.totalAmount} ${saved.currency}`);
      return Result.ok(saved);
    } catch (error: any) {
      this.logger.error(`Failed to register expense: ${error.message}`, error.stack);
      return Result.fail(new CouldNotSave('Expense', error.message));
    }
  }

  async getExpenseById(id: string): Promise<Result<ExpenseEntity>> {
    try {
      const expense = await this.expensesRepo.findExpenseById(id);
      if (!expense) {
        return Result.fail(new NotFound(`Expense with id ${id}`));
      }
      return Result.ok(expense);
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async listExpenses(limit = 50, offset = 0): Promise<Result<ExpenseEntity[]>> {
    try {
      const expenses = await this.expensesRepo.findExpenses(limit, offset);
      return Result.ok(expenses);
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async registerCreditCard(dto: CreateCreditCardDto): Promise<Result<CreditCardEntity>> {
    try {
      const cardEntity = ExpenseMapper.toCardEntity(dto);
      const saved = await this.expensesRepo.saveCreditCard(cardEntity);
      return Result.ok(saved);
    } catch (error: any) {
      return Result.fail(new CouldNotSave('CreditCard', error.message));
    }
  }

  async listCreditCards(): Promise<Result<CreditCardEntity[]>> {
    try {
      const cards = await this.expensesRepo.findCreditCards();
      return Result.ok(cards);
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async getMonthlyInstallmentsSummary(yearMonth: string): Promise<Result<MonthlyInstallmentsSummaryDto>> {
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      return Result.fail(new InvalidOperation('yearMonth must be in YYYY-MM format'));
    }

    try {
      const [yearStr, monthStr] = yearMonth.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const lastDay = new Date(year, month, 0).getDate();

      const startDate = `${yearMonth}-01`;
      const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

      const installments = await this.expensesRepo.findInstallmentsByDueDateRange(startDate, endDate);

      const items: InstallmentItemDto[] = installments.map((inst) => ({
        installmentId: inst.id,
        expenseId: inst.expenseId,
        merchantName: inst.expense?.merchantName || 'Desconocido',
        description: inst.expense?.description || '',
        installmentNumber: inst.installmentNumber,
        totalInstallments: inst.totalInstallments,
        amount: Number(inst.amount),
        dueDate: inst.dueDate,
        status: inst.status,
        cardBank: inst.expense?.creditCard?.bank,
        cardName: inst.expense?.creditCard?.cardName,
        isExtension: inst.expense?.creditCard?.isExtension,
        holderName: inst.expense?.creditCard?.holderName,
      }));

      const totalAmountDue = Math.round(
        items.reduce((sum, item) => sum + item.amount, 0) * 100,
      ) / 100;

      return Result.ok({
        month: yearMonth,
        totalAmountDue,
        installmentsCount: items.length,
        items,
      });
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async searchPendingInstallments(
    query?: string,
    dueDate?: string,
  ): Promise<Result<ExpenseInstallmentEntity[]>> {
    try {
      const items = await this.expensesRepo.searchPendingInstallments(query, dueDate);
      return Result.ok(items);
    } catch (error: any) {
      this.logger.error(`Error searching pending installments: ${error.message}`);
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async payInstallment(
    id: string,
    paymentMethod: string = 'BANK_TRANSFER',
    bankName?: string,
    notes?: string,
  ): Promise<Result<ExpenseInstallmentEntity>> {
    try {
      const installment = await this.expensesRepo.findInstallmentById(id);
      if (!installment) {
        return Result.fail(new NotFound(`Installment with id ${id}`));
      }

      installment.status = 'PAID';
      installment.paidAt = new Date();
      const paymentInfo = [paymentMethod, bankName].filter(Boolean).join(' - ');
      installment.notes = notes || (paymentInfo ? `Pagado vía ${paymentInfo}` : 'Pagado');

      const saved = await this.expensesRepo.saveInstallment(installment);
      this.logger.log(`Installment ${id} marked as PAID via ${paymentInfo}`);
      return Result.ok(saved);
    } catch (error: any) {
      this.logger.error(`Error paying installment: ${error.message}`);
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  private calculateFirstDueDate(expenseDate: string, dueDay?: number): string {
    const [yearStr, monthStr, dayStr] = expenseDate.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1; // 0-based
    const day = parseInt(dayStr, 10);

    const targetDueDay = dueDay && dueDay >= 1 && dueDay <= 31 ? dueDay : day;

    const nextMonthIndex = month + 1;
    const nextYear = year + Math.floor(nextMonthIndex / 12);
    const nextMonth = nextMonthIndex % 12;

    const daysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
    const actualDay = Math.min(targetDueDay, daysInNextMonth);

    return new Date(Date.UTC(nextYear, nextMonth, actualDay)).toISOString().slice(0, 10);
  }

  async getFinancialSummary(
    query: FinancialSummaryQueryDto,
  ): Promise<Result<FinancialSummaryResponseDto>> {
    try {
      let startDate: string;
      let endDate: string;
      let periodLabel: string;
      let prevStartDate: string;
      let prevEndDate: string;

      if (query.month) {
        const [y, m] = query.month.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        startDate = `${query.month}-01`;
        endDate = `${query.month}-${String(lastDay).padStart(2, '0')}`;
        periodLabel = `Mes ${query.month}`;

        // Previous month
        const prevMonthDate = new Date(y, m - 2, 1);
        const prevY = prevMonthDate.getFullYear();
        const prevM = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
        const prevLastDay = new Date(prevY, prevMonthDate.getMonth() + 1, 0).getDate();
        prevStartDate = `${prevY}-${prevM}-01`;
        prevEndDate = `${prevY}-${prevM}-${String(prevLastDay).padStart(2, '0')}`;
      } else if (query.startDate && query.endDate) {
        startDate = query.startDate;
        endDate = query.endDate;
        periodLabel = `Del ${startDate} al ${endDate}`;

        const startMs = new Date(startDate).getTime();
        const endMs = new Date(endDate).getTime();
        const durationMs = endMs - startMs;
        const prevEndMs = startMs - 24 * 60 * 60 * 1000;
        const prevStartMs = prevEndMs - durationMs;
        prevStartDate = new Date(prevStartMs).toISOString().slice(0, 10);
        prevEndDate = new Date(prevEndMs).toISOString().slice(0, 10);
      } else {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
        startDate = `${y}-${m}-01`;
        endDate = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
        periodLabel = `Mes actual (${y}-${m})`;

        const prevMonthDate = new Date(y, now.getMonth() - 1, 1);
        const prevY = prevMonthDate.getFullYear();
        const prevM = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
        const prevLastDay = new Date(prevY, prevMonthDate.getMonth() + 1, 0).getDate();
        prevStartDate = `${prevY}-${prevM}-01`;
        prevEndDate = `${prevY}-${prevM}-${String(prevLastDay).padStart(2, '0')}`;
      }

      // 1. Fetch current period data
      const directExpenses = await this.expensesRepo.findExpensesByDateRange(startDate, endDate, false);
      const paidInstallments = await this.expensesRepo.findPaidInstallmentsByDateRange(startDate, endDate);
      const pendingInstallments = await this.expensesRepo.findPendingInstallmentsByDueDateRange(startDate, endDate);

      const directPaid = directExpenses.reduce((sum, e) => sum + Number(e.totalAmount), 0);
      const installmentsPaid = paidInstallments.reduce((sum, i) => sum + Number(i.amount), 0);
      const totalPaid = Math.round((directPaid + installmentsPaid) * 100) / 100;
      const paidTransactionsCount = directExpenses.length + paidInstallments.length;

      const totalPending = Math.round(
        pendingInstallments.reduce((sum, i) => sum + Number(i.amount), 0) * 100,
      ) / 100;
      const pendingTransactionsCount = pendingInstallments.length;

      // 2. Breakdowns by Category & Bank
      const categoryMap = new Map<string, number>();
      const bankMap = new Map<string, number>();

      for (const e of directExpenses) {
        const cat = e.category || 'VARIOS';
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + Number(e.totalAmount));

        const bank = e.creditCard?.bank || e.bankName || (e.paymentMethod === 'BANK_TRANSFER' ? 'Transferencia' : e.paymentMethod || 'Otros');
        bankMap.set(bank, (bankMap.get(bank) || 0) + Number(e.totalAmount));
      }

      for (const i of paidInstallments) {
        const cat = i.expense?.category || 'VARIOS';
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + Number(i.amount));

        let bank = i.expense?.creditCard?.bank;
        if (!bank && i.notes) {
          const match = i.notes.match(/\((.*?)\)/);
          if (match) bank = match[1];
        }
        bank = bank || i.expense?.bankName || 'Transferencia / Tarjeta';
        bankMap.set(bank, (bankMap.get(bank) || 0) + Number(i.amount));
      }

      const totalDisbursed = totalPaid > 0 ? totalPaid : (totalPending > 0 ? totalPending : 1);

      const byCategory: CategoryBreakdownDto[] = Array.from(categoryMap.entries())
        .map(([category, amount]) => ({
          category,
          amount: Math.round(amount * 100) / 100,
          percentage: Math.round((amount / totalDisbursed) * 1000) / 10,
        }))
        .sort((a, b) => b.amount - a.amount);

      const byBank: BankBreakdownDto[] = Array.from(bankMap.entries())
        .map(([bank, amount]) => ({
          bank,
          amount: Math.round(amount * 100) / 100,
          percentage: Math.round((amount / totalDisbursed) * 1000) / 10,
        }))
        .sort((a, b) => b.amount - a.amount);

      // 3. Comparison with previous period
      const prevDirect = await this.expensesRepo.findExpensesByDateRange(prevStartDate, prevEndDate, false);
      const prevPaidInst = await this.expensesRepo.findPaidInstallmentsByDateRange(prevStartDate, prevEndDate);
      const prevTotalPaid = Math.round(
        (prevDirect.reduce((s, e) => s + Number(e.totalAmount), 0) +
          prevPaidInst.reduce((s, i) => s + Number(i.amount), 0)) * 100,
      ) / 100;

      const diffAmount = Math.round((totalPaid - prevTotalPaid) * 100) / 100;
      const diffPercentage = prevTotalPaid > 0
        ? Math.round(((totalPaid - prevTotalPaid) / prevTotalPaid) * 1000) / 10
        : 0;
      const trend = diffAmount > 0 ? 'UP' : diffAmount < 0 ? 'DOWN' : 'EQUAL';

      // 4. Upcoming due (next 15 days)
      const upcomingItems = await this.expensesRepo.findUpcomingPendingInstallments(15);
      const upcomingDue: UpcomingDueDto[] = upcomingItems.map((inst) => ({
        id: inst.id,
        expenseId: inst.expenseId,
        merchantName: inst.expense?.merchantName || 'Desconocido',
        description: inst.expense?.description || '',
        installmentNumber: inst.installmentNumber,
        totalInstallments: inst.totalInstallments,
        amount: Number(inst.amount),
        dueDate: inst.dueDate,
        bank: inst.expense?.creditCard?.bank || inst.expense?.bankName,
        holderName: inst.expense?.creditCard?.holderName,
      }));

      return Result.ok({
        startDate,
        endDate,
        periodLabel,
        totalPaid,
        paidTransactionsCount,
        totalPending,
        pendingTransactionsCount,
        byCategory,
        byBank,
        comparison: {
          previousStartDate: prevStartDate,
          previousEndDate: prevEndDate,
          previousTotalPaid: prevTotalPaid,
          diffAmount,
          diffPercentage,
          trend,
        },
        upcomingDue,
      });
    } catch (error: any) {
      this.logger.error(`Error calculating financial summary: ${error.message}`, error.stack);
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async searchExpenses(
    query: SearchExpensesQueryDto,
  ): Promise<Result<SearchExpensesResponseDto>> {
    try {
      const { expenses, installments } = await this.expensesRepo.searchExpensesAndInstallments(
        query.q,
        query.category,
        query.startDate,
        query.endDate,
      );

      const items: SearchExpenseItemDto[] = [];

      for (const exp of expenses) {
        items.push({
          id: exp.id,
          type: 'EXPENSE',
          date: exp.expenseDate,
          merchantName: exp.merchantName,
          description: exp.description,
          amount: Number(exp.totalAmount),
          currency: exp.currency || 'ARS',
          category: exp.category,
          paymentMethod: exp.paymentMethod,
          bank: exp.creditCard?.bank || exp.bankName,
          status: 'PAID',
        });
      }

      for (const inst of installments) {
        items.push({
          id: inst.id,
          type: 'INSTALLMENT',
          date: inst.paidAt ? new Date(inst.paidAt).toISOString().slice(0, 10) : inst.dueDate,
          merchantName: inst.expense?.merchantName || 'Desconocido',
          description: inst.expense?.description || '',
          amount: Number(inst.amount),
          currency: inst.expense?.currency || 'ARS',
          category: inst.expense?.category || 'VARIOS',
          paymentMethod: inst.expense?.paymentMethod || 'CREDIT_CARD',
          bank: inst.expense?.creditCard?.bank || inst.expense?.bankName,
          status: inst.status,
          installmentInfo: `Cuota ${inst.installmentNumber}/${inst.totalInstallments}`,
        });
      }

      // Sort by date DESC
      items.sort((a, b) => b.date.localeCompare(a.date));

      const totalAmount = Math.round(
        items.reduce((sum, item) => sum + item.amount, 0) * 100,
      ) / 100;

      return Result.ok({
        query: query.q,
        category: query.category,
        totalMatches: items.length,
        totalAmount,
        items,
      });
    } catch (error: any) {
      this.logger.error(`Error searching expenses: ${error.message}`);
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async getUpcomingInstallments(days = 30): Promise<Result<UpcomingDueDto[]>> {
    try {
      const upcoming = await this.expensesRepo.findUpcomingPendingInstallments(days);
      const items: UpcomingDueDto[] = upcoming.map((inst) => ({
        id: inst.id,
        expenseId: inst.expenseId,
        merchantName: inst.expense?.merchantName || 'Desconocido',
        description: inst.expense?.description || '',
        installmentNumber: inst.installmentNumber,
        totalInstallments: inst.totalInstallments,
        amount: Number(inst.amount),
        dueDate: inst.dueDate,
        bank: inst.expense?.creditCard?.bank || inst.expense?.bankName,
        holderName: inst.expense?.creditCard?.holderName,
      }));
      return Result.ok(items);
    } catch (error: any) {
      this.logger.error(`Error getting upcoming installments: ${error.message}`);
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async updateExpense(id: string, dto: UpdateExpenseDto): Promise<Result<ExpenseEntity>> {
    try {
      const expense = await this.expensesRepo.findExpenseById(id);
      if (!expense) {
        return Result.fail(new NotFound(`Expense with id ${id}`));
      }

      if (dto.description !== undefined) expense.description = dto.description;
      if (dto.merchantName !== undefined) expense.merchantName = dto.merchantName;
      if (dto.category !== undefined) expense.category = dto.category;
      if (dto.paymentMethod !== undefined) expense.paymentMethod = dto.paymentMethod;
      if (dto.bankName !== undefined) expense.bankName = dto.bankName;

      if (dto.totalAmount !== undefined) {
        const newTotal = Math.round(Number(dto.totalAmount) * 100) / 100;
        if (expense.isInstallment && expense.installmentsPlan?.length > 0) {
          const paidSum = expense.installmentsPlan
            .filter((i) => i.status === 'PAID')
            .reduce((sum, i) => sum + Number(i.amount), 0);
          const pending = expense.installmentsPlan
            .filter((i) => i.status === 'PENDING')
            .sort((a, b) => a.installmentNumber - b.installmentNumber);

          if (pending.length > 0) {
            const remaining = Math.round((newTotal - paidSum) * 100) / 100;
            if (remaining <= 0) {
              return Result.fail(
                new InvalidOperation(
                  `El nuevo monto ($${newTotal}) no puede ser menor o igual a lo ya pagado ($${paidSum}).`,
                ),
              );
            }
            const baseAmount = Math.floor((remaining / pending.length) * 100) / 100;
            let assigned = 0;
            for (let idx = 0; idx < pending.length; idx++) {
              const inst = pending[idx];
              const isLast = idx === pending.length - 1;
              inst.amount = isLast
                ? Math.round((remaining - assigned) * 100) / 100
                : baseAmount;
              assigned += inst.amount;
              await this.expensesRepo.saveInstallment(inst);
            }
          }
        }
        expense.totalAmount = newTotal;
      }

      const saved = await this.expensesRepo.saveExpense(expense);
      const refreshed = await this.expensesRepo.findExpenseById(saved.id);
      return Result.ok(refreshed || saved);
    } catch (error: any) {
      this.logger.error(`Error updating expense ${id}: ${error.message}`);
      return Result.fail(new CouldNotSave('Expense', error.message));
    }
  }

  async deleteExpense(id: string): Promise<Result<{ deleted: boolean; id: string }>> {
    try {
      const expense = await this.expensesRepo.findExpenseById(id);
      if (!expense) {
        return Result.fail(new NotFound(`Expense with id ${id}`));
      }
      const deleted = await this.expensesRepo.deleteExpense(id);
      this.logger.log(`Deleted expense ${id} (${expense.merchantName})`);
      return Result.ok({ deleted, id });
    } catch (error: any) {
      this.logger.error(`Error deleting expense ${id}: ${error.message}`);
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async updateInstallment(
    id: string,
    dto: UpdateInstallmentDto,
  ): Promise<Result<ExpenseInstallmentEntity>> {
    try {
      const installment = await this.expensesRepo.findInstallmentById(id);
      if (!installment) {
        return Result.fail(new NotFound(`Installment with id ${id}`));
      }

      if (dto.amount !== undefined) {
        installment.amount = Math.round(Number(dto.amount) * 100) / 100;
      }
      if (dto.dueDate !== undefined) installment.dueDate = dto.dueDate;
      if (dto.notes !== undefined) installment.notes = dto.notes;

      const saved = await this.expensesRepo.saveInstallment(installment);

      if (dto.amount !== undefined) {
        const parent = await this.expensesRepo.findExpenseById(installment.expenseId);
        if (parent && parent.installmentsPlan) {
          const newTotal = Math.round(
            parent.installmentsPlan
              .filter((i) => i.status !== 'CANCELLED')
              .reduce((sum, i) => sum + Number(i.amount), 0) * 100,
          ) / 100;
          parent.totalAmount = newTotal;
          await this.expensesRepo.saveExpense(parent);
        }
      }

      const refreshed = await this.expensesRepo.findInstallmentById(saved.id);
      return Result.ok(refreshed || saved);
    } catch (error: any) {
      this.logger.error(`Error updating installment ${id}: ${error.message}`);
      return Result.fail(new CouldNotSave('ExpenseInstallment', error.message));
    }
  }

  async deleteInstallment(
    id: string,
  ): Promise<Result<{ deleted: boolean; id: string; expenseDeleted?: boolean }>> {
    try {
      const installment = await this.expensesRepo.findInstallmentById(id);
      if (!installment) {
        return Result.fail(new NotFound(`Installment with id ${id}`));
      }
      const expenseId = installment.expenseId;
      const deleted = await this.expensesRepo.deleteInstallment(id);

      const parent = await this.expensesRepo.findExpenseById(expenseId);
      let expenseDeleted = false;
      if (parent) {
        const remaining = (parent.installmentsPlan || []).filter(
          (i) => i.status !== 'CANCELLED',
        );
        if (remaining.length === 0) {
          await this.expensesRepo.deleteExpense(parent.id);
          expenseDeleted = true;
        } else {
          parent.totalAmount = Math.round(
            remaining.reduce((sum, i) => sum + Number(i.amount), 0) * 100,
          ) / 100;
          parent.totalInstallments = remaining.length;
          await this.expensesRepo.saveExpense(parent);
        }
      }

      return Result.ok({ deleted, id, expenseDeleted });
    } catch (error: any) {
      this.logger.error(`Error deleting installment ${id}: ${error.message}`);
      return Result.fail(new InvalidOperation(error.message));
    }
  }
}
