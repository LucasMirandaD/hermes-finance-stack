import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IExpensesService } from '../../expenses/domain/services/i-expenses.service';
import { parseArgentineAmount } from '../../expenses/domain/utils/amount-parser.util';
import { addMcpTool, errResult, okResult } from '../mcp-tool.helper';

export function registerBudgetTools(
  server: McpServer,
  expensesService: IExpensesService,
): void {
  // 21. set_category_budget
  addMcpTool(
    server,
    'set_category_budget',
    'Crea o actualiza un presupuesto mensual para una categoría con umbral de alerta opcional (default 80%).',
    {
      category: z.string().describe('Categoría normalizada (ej: SUPERMERCADO)'),
      monthlyAmount: z
        .union([z.number(), z.string()])
        .describe('Tope mensual (acepta "250 mil", "1.5m", etc.)'),
      currency: z.string().optional().default('ARS'),
      alertThresholdPct: z.coerce.number().int().min(1).max(100).optional().default(80),
      scope: z.enum(['ALL', 'PERSONAL', 'SHARED']).optional().default('ALL'),
      memberRef: z.string().optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const parsed = parseArgentineAmount(args.monthlyAmount);
      if (parsed <= 0) {
        return errResult('El monto del presupuesto debe ser mayor a 0.');
      }
      const result = await expensesService.setCategoryBudget({
        category: args.category,
        monthlyAmount: parsed,
        currency: args.currency,
        alertThresholdPct: args.alertThresholdPct,
        scope: args.scope,
        memberRef: args.memberRef,
        notes: args.notes,
      });
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 22. list_category_budgets
  addMcpTool(
    server,
    'list_category_budgets',
    'Lista los presupuestos mensuales configurados por categoría.',
    {
      activeOnly: z.boolean().optional().default(true),
    },
    async (args) => {
      const result = await expensesService.listCategoryBudgets(args.activeOnly ?? true);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 23. delete_category_budget
  addMcpTool(
    server,
    'delete_category_budget',
    'Elimina un presupuesto de categoría por su UUID.',
    {
      budgetId: z.string().uuid(),
    },
    async (args) => {
      const result = await expensesService.deleteCategoryBudget(args.budgetId);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 24. get_budget_status
  addMcpTool(
    server,
    'get_budget_status',
    'Consulta el estado de ejecución de presupuestos en el mes: gastado vs presupuestado, % usado, restante y alertas.',
    {
      month: z.string().optional().describe('Mes YYYY-MM (default mes actual)'),
      alertsOnly: z.boolean().optional().default(false),
    },
    async (args) => {
      const result = await expensesService.getBudgetStatus(args.month, args.alertsOnly);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );
}
