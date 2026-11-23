import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IExpensesService } from '../../expenses/domain/services/i-expenses.service';
import { parseArgentineAmount } from '../../expenses/domain/utils/amount-parser.util';
import { ExpenseMapper } from '../../expenses/presentation/mappers/expense.mapper';
import {
  addMcpTool,
  allocationItemSchema,
  errResult,
  okResult,
} from '../mcp-tool.helper';

export function registerRecurringTools(
  server: McpServer,
  expensesService: IExpensesService,
): void {
  // 25. create_recurring_expense
  addMcpTool(
    server,
    'create_recurring_expense',
    'Define una plantilla de gasto fijo / recurrente (ej: Alquiler, Internet, Expensas, Luz, Seguro) con día estimado de vencimiento, monto estimado, alcance PERSONAL/SHARED y allocations por defecto.',
    {
      merchantName: z
        .string()
        .describe('Nombre del servicio o destinatario (ej: "Internet Fibra", "Alquiler")'),
      description: z.string().describe('Concepto del gasto fijo'),
      estimatedAmount: z.union([z.number(), z.string()]).describe('Monto estimado actual'),
      category: z.string().optional().default('IMPUESTOS_Y_SERVICIOS'),
      currency: z.string().optional().default('ARS'),
      dayOfMonth: z.coerce.number().int().min(1).max(31).optional().default(10),
      frequency: z.enum(['MONTHLY', 'BIMONTHLY', 'YEARLY']).optional().default('MONTHLY'),
      paymentMethod: z
        .enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'MERCADO_PAGO'])
        .optional()
        .default('BANK_TRANSFER'),
      bankName: z.string().optional(),
      scope: z.enum(['PERSONAL', 'SHARED']).optional().default('PERSONAL'),
      paidBy: z.string().optional(),
      allocations: z.array(allocationItemSchema).optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const parsed = parseArgentineAmount(args.estimatedAmount);
      if (parsed <= 0) {
        return errResult('El monto estimado debe ser mayor a 0.');
      }
      const result = await expensesService.createRecurringExpense({
        merchantName: args.merchantName,
        description: args.description,
        estimatedAmount: parsed,
        category: args.category,
        currency: args.currency,
        dayOfMonth: args.dayOfMonth,
        frequency: args.frequency,
        paymentMethod: args.paymentMethod,
        bankName: args.bankName,
        scope: args.scope,
        paidBy: args.paidBy,
        allocations: args.allocations,
        notes: args.notes,
      });
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 26. list_recurring_expenses
  addMcpTool(
    server,
    'list_recurring_expenses',
    'Lista las plantillas de gastos fijos / recurrentes configuradas.',
    {
      activeOnly: z.boolean().optional().default(true),
    },
    async (args) => {
      const result = await expensesService.listRecurringExpenses(args.activeOnly ?? true);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 27. update_recurring_expense
  addMcpTool(
    server,
    'update_recurring_expense',
    'Actualiza el monto estimado, día de vencimiento, frecuencia, banco o estado activo de una plantilla de gasto fijo.',
    {
      recurringId: z.string().uuid(),
      merchantName: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      estimatedAmount: z.union([z.number(), z.string()]).optional(),
      dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
      frequency: z.enum(['MONTHLY', 'BIMONTHLY', 'YEARLY']).optional(),
      paymentMethod: z
        .enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'MERCADO_PAGO'])
        .optional(),
      bankName: z.string().optional(),
      scope: z.enum(['PERSONAL', 'SHARED']).optional(),
      paidBy: z.string().optional(),
      allocations: z.array(allocationItemSchema).optional(),
      isActive: z.boolean().optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const parsedAmt =
        args.estimatedAmount !== undefined
          ? parseArgentineAmount(args.estimatedAmount)
          : undefined;
      if (parsedAmt !== undefined && parsedAmt <= 0) {
        return errResult('El monto estimado debe ser mayor a 0.');
      }
      const result = await expensesService.updateRecurringExpense(args.recurringId, {
        merchantName: args.merchantName,
        description: args.description,
        category: args.category,
        estimatedAmount: parsedAmt,
        dayOfMonth: args.dayOfMonth,
        frequency: args.frequency,
        paymentMethod: args.paymentMethod,
        bankName: args.bankName,
        scope: args.scope,
        paidBy: args.paidBy,
        allocations: args.allocations,
        isActive: args.isActive,
        notes: args.notes,
      });
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 28. delete_recurring_expense
  addMcpTool(
    server,
    'delete_recurring_expense',
    'Elimina una plantilla de gasto fijo por su UUID.',
    {
      recurringId: z.string().uuid(),
    },
    async (args) => {
      const result = await expensesService.deleteRecurringExpense(args.recurringId);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 29. get_fixed_expenses_status
  addMcpTool(
    server,
    'get_fixed_expenses_status',
    'Muestra qué gastos fijos ya se pagaron en el mes y cuáles siguen pendientes o vencidos (ideal para "¿qué fijos faltan pagar este mes?").',
    {
      month: z.string().optional().describe('Mes YYYY-MM (default mes actual)'),
    },
    async (args) => {
      const result = await expensesService.getFixedExpensesStatus(args.month);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 30. pay_recurring_expense
  addMcpTool(
    server,
    'pay_recurring_expense',
    'Registra el pago del mes de un gasto fijo definido (buscando por nombre o UUID). Permite sobreescribir el monto real si cambió respecto al estimado.',
    {
      recurringRef: z
        .string()
        .describe('Nombre/comercio del gasto fijo (ej: "Alquiler", "Internet") o su UUID'),
      amount: z
        .union([z.number(), z.string()])
        .optional()
        .describe('Monto real pagado si difiere del estimado'),
      expenseDate: z.string().optional().describe('Fecha de pago YYYY-MM-DD (default hoy)'),
      paymentMethod: z
        .enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'MERCADO_PAGO'])
        .optional(),
      bankName: z.string().optional(),
      paidBy: z.string().optional(),
      description: z.string().optional(),
    },
    async (args) => {
      const parsedAmt =
        args.amount !== undefined ? parseArgentineAmount(args.amount) : undefined;
      if (parsedAmt !== undefined && parsedAmt <= 0) {
        return errResult('El monto pagado debe ser mayor a 0.');
      }
      const result = await expensesService.payRecurringExpense(args.recurringRef, {
        amount: parsedAmt,
        expenseDate: args.expenseDate,
        paymentMethod: args.paymentMethod,
        bankName: args.bankName,
        paidBy: args.paidBy,
        description: args.description,
      });
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(ExpenseMapper.toPresentation(result.getValue()));
    },
  );
}
