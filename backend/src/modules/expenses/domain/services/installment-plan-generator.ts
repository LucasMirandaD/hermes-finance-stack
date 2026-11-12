export interface GeneratedInstallment {
  installmentNumber: number;
  totalInstallments: number;
  amount: number;
  dueDate: string; // YYYY-MM-DD
}

export class InstallmentPlanGenerator {
  /**
   * Generates installment dates and amounts with exact penny/rounding compensation.
   * Supports custom interval in months (e.g., intervalMonths = 2 means every 2 months).
   */
  public static generate(
    totalAmount: number,
    installments: number,
    firstDueDate: string,
    intervalMonths = 1,
  ): GeneratedInstallment[] {
    if (installments <= 1) {
      return [
        {
          installmentNumber: 1,
          totalInstallments: 1,
          amount: Number(Number(totalAmount).toFixed(2)),
          dueDate: firstDueDate,
        },
      ];
    }

    const interval = intervalMonths > 0 ? intervalMonths : 1;
    const baseAmount = Math.floor((totalAmount / installments) * 100) / 100;
    const initialSum = Math.round(baseAmount * installments * 100) / 100;
    const remainder = Math.round((totalAmount - initialSum) * 100) / 100;

    const [yearStr, monthStr, dayStr] = firstDueDate.split('-');
    const baseYear = parseInt(yearStr, 10);
    const baseMonth = parseInt(monthStr, 10) - 1; // 0-indexed
    const baseDay = parseInt(dayStr, 10);

    const plan: GeneratedInstallment[] = [];

    for (let i = 1; i <= installments; i++) {
      // Compensate remainder on the first installment
      const amount = i === 1 ? Math.round((baseAmount + remainder) * 100) / 100 : baseAmount;

      const offsetMonths = (i - 1) * interval;
      const targetMonthIndex = baseMonth + offsetMonths;
      const targetYear = baseYear + Math.floor(targetMonthIndex / 12);
      const targetMonth = targetMonthIndex % 12;

      // Handle variable days per month (e.g. Feb 28/29, April 30)
      const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      const actualDay = Math.min(baseDay, daysInTargetMonth);

      const dueDateObj = new Date(Date.UTC(targetYear, targetMonth, actualDay));
      const formattedDate = dueDateObj.toISOString().slice(0, 10);

      plan.push({
        installmentNumber: i,
        totalInstallments: installments,
        amount: Number(amount.toFixed(2)),
        dueDate: formattedDate,
      });
    }

    return plan;
  }
}
