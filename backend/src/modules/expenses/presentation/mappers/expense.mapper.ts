import { ExpenseEntity } from '../../data/entities/expense.entity';
import { ExpenseResponseDto } from '../dtos/expense-response.dto';
import { CreditCardEntity } from '../../data/entities/credit-card.entity';
import { CreateCreditCardDto } from '../dtos/create-credit-card.dto';

export class ExpenseMapper {
  public static toPresentation(entity: ExpenseEntity): ExpenseResponseDto {
    return {
      id: entity.id,
      description: entity.description,
      merchantName: entity.merchantName,
      totalAmount: Number(entity.totalAmount),
      currency: entity.currency,
      expenseDate: entity.expenseDate,
      paymentMethod: entity.paymentMethod,
      bankName: entity.bankName,
      scope: entity.scope || 'PERSONAL',
      isFixed: Boolean(entity.isFixed),
      recurringExpenseId: entity.recurringExpenseId,
      paidByMember: entity.paidByMember
        ? {
            id: entity.paidByMember.id,
            slug: entity.paidByMember.slug,
            displayName: entity.paidByMember.displayName,
          }
        : undefined,
      allocations: entity.allocations?.length
        ? entity.allocations.map((a) => ({
            memberId: a.memberId,
            memberSlug: a.member?.slug || a.memberId,
            displayName: a.member?.displayName || a.member?.slug || a.memberId,
            percentage: Number(a.percentage),
            amount: Number(a.amount),
          }))
        : undefined,
      isInstallment: entity.isInstallment,
      totalInstallments: entity.totalInstallments,
      intervalMonths: entity.intervalMonths,
      category: entity.category,
      source: entity.source,
      creditCard: entity.creditCard
        ? {
            id: entity.creditCard.id,
            bank: entity.creditCard.bank,
            cardName: entity.creditCard.cardName,
            isExtension: entity.creditCard.isExtension,
            holderName: entity.creditCard.holderName,
          }
        : undefined,
      installments: entity.installmentsPlan
        ? entity.installmentsPlan.map((inst) => ({
            id: inst.id,
            installmentNumber: inst.installmentNumber,
            totalInstallments: inst.totalInstallments,
            amount: Number(inst.amount),
            dueDate: inst.dueDate,
            status: inst.status,
          }))
        : undefined,
      createdAt: entity.createdAt,
    };
  }

  public static toCardEntity(dto: CreateCreditCardDto): Partial<CreditCardEntity> {
    return {
      bank: dto.bank,
      cardName: dto.cardName,
      lastFourDigits: dto.lastFourDigits,
      isExtension: dto.isExtension ?? false,
      holderName: dto.holderName,
      closingDay: dto.closingDay,
      dueDay: dto.dueDay,
      isActive: true,
    };
  }
}
