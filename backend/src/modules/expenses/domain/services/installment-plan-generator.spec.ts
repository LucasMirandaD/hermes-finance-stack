import { describe, it, expect } from 'vitest';
import { InstallmentPlanGenerator } from './installment-plan-generator';

describe('InstallmentPlanGenerator', () => {
  it('should return 1 installment for single payment', () => {
    // Arrange
    const totalAmount = 15000;
    const installments = 1;
    const firstDueDate = '2026-11-15';

    // Act
    const plan = InstallmentPlanGenerator.generate(totalAmount, installments, firstDueDate);

    // Assert
    expect(plan).toHaveLength(1);
    expect(plan[0].amount).toBe(15000);
    expect(plan[0].installmentNumber).toBe(1);
    expect(plan[0].dueDate).toBe('2026-11-15');
  });

  it('should divide amount into 3 equal monthly installments without rounding loss', () => {
    // Arrange: 100 / 3 = 33.3333... -> 33.34 + 33.33 + 33.33 = 100.00
    const totalAmount = 100;
    const installments = 3;
    const firstDueDate = '2026-11-10';

    // Act
    const plan = InstallmentPlanGenerator.generate(totalAmount, installments, firstDueDate, 1);

    // Assert
    expect(plan).toHaveLength(3);
    const sum = plan.reduce((acc, curr) => acc + curr.amount, 0);
    expect(Number(sum.toFixed(2))).toBe(100);
    expect(plan[0].amount).toBe(33.34);
    expect(plan[1].amount).toBe(33.33);
    expect(plan[2].amount).toBe(33.33);
    expect(plan[0].dueDate).toBe('2026-11-10');
    expect(plan[1].dueDate).toBe('2026-12-10');
    expect(plan[2].dueDate).toBe('2027-01-10');
  });

  it('should generate bi-monthly installments when intervalMonths is 2', () => {
    // Arrange: $60,000 en 3 cuotas cada 2 meses (Nov 2026 -> Ene 2027 -> Mar 2027)
    const totalAmount = 60000;
    const installments = 3;
    const firstDueDate = '2026-11-20';
    const intervalMonths = 2;

    // Act
    const plan = InstallmentPlanGenerator.generate(
      totalAmount,
      installments,
      firstDueDate,
      intervalMonths,
    );

    // Assert
    expect(plan).toHaveLength(3);
    expect(plan[0].amount).toBe(20000);
    expect(plan[0].dueDate).toBe('2026-11-20');

    expect(plan[1].amount).toBe(20000);
    expect(plan[1].dueDate).toBe('2027-01-20');

    expect(plan[2].amount).toBe(20000);
    expect(plan[2].dueDate).toBe('2027-03-20');
  });

  it('should adjust for months with fewer days like February', () => {
    // Arrange: start on Jan 31, monthly
    const totalAmount = 3000;
    const installments = 3;
    const firstDueDate = '2027-01-31';

    // Act
    const plan = InstallmentPlanGenerator.generate(totalAmount, installments, firstDueDate, 1);

    // Assert
    expect(plan).toHaveLength(3);
    expect(plan[0].dueDate).toBe('2027-01-31');
    expect(plan[1].dueDate).toBe('2027-02-28'); // Non-leap year adjusted
    expect(plan[2].dueDate).toBe('2027-03-31');
  });
});
