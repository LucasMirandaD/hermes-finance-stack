import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IExpensesService } from '../../expenses/domain/services/i-expenses.service';
import { addMcpTool, errResult, okResult } from '../mcp-tool.helper';

export function registerAnalyticsTools(
  server: McpServer,
  expensesService: IExpensesService,
): void {
  // 31. get_financial_summary
  addMcpTool(
    server,
    'get_financial_summary',
    'Resumen financiero del período: cashflow pagado, cuotas pendientes, desglose por categoría, banco y titular (byHolder), fijos vs variables, top 5 gastos, alertas de presupuesto y comparativa contra período anterior.',
    {
      month: z.string().optional().describe('Mes YYYY-MM (ej: "2026-11")'),
      startDate: z.string().optional().describe('Fecha inicio YYYY-MM-DD'),
      endDate: z.string().optional().describe('Fecha fin YYYY-MM-DD'),
      scope: z.enum(['ALL', 'PERSONAL', 'SHARED']).optional().describe('Filtrar por alcance'),
      memberRef: z.string().optional().describe('Filtrar por miembro (slug, nombre o @usuario)'),
      isFixed: z.boolean().optional().describe('Filtrar solo fijos (true) o variables (false)'),
    },
    async (args) => {
      const result = await expensesService.getFinancialSummary(args);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 32. compare_months
  addMcpTool(
    server,
    'compare_months',
    'Compara el gasto pagado entre dos meses YYYY-MM (monthA vs monthB), devolviendo variación total y por categoría.',
    {
      monthA: z.string().describe('Mes base YYYY-MM'),
      monthB: z.string().describe('Mes comparado YYYY-MM'),
      scope: z.enum(['ALL', 'PERSONAL', 'SHARED']).optional(),
      memberRef: z.string().optional(),
    },
    async (args) => {
      const result = await expensesService.compareMonths(
        args.monthA,
        args.monthB,
        args.scope,
        args.memberRef,
      );
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 33. top_expenses
  addMcpTool(
    server,
    'top_expenses',
    'Devuelve el ranking de los mayores gastos del período ordenados de mayor a menor.',
    {
      month: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      category: z.string().optional(),
      scope: z.enum(['ALL', 'PERSONAL', 'SHARED']).optional(),
      memberRef: z.string().optional(),
      isFixed: z.boolean().optional(),
      limit: z.coerce.number().int().min(1).max(50).optional().default(10),
    },
    async (args) => {
      const result = await expensesService.getTopExpenses(args);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 34. export_expenses
  addMcpTool(
    server,
    'export_expenses',
    'Exporta gastos y cuotas de un período a CSV (UTF-8 con BOM para Excel) o JSON en /opt/data/exports/ y devuelve filePath + mediaTag (incluir MEDIA:<ruta> en la respuesta final para enviarlo por Telegram).',
    {
      format: z.enum(['csv', 'json']).optional().default('csv'),
      month: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      category: z.string().optional(),
      scope: z.enum(['ALL', 'PERSONAL', 'SHARED']).optional(),
      memberRef: z.string().optional(),
      isFixed: z.boolean().optional(),
    },
    async (args) => {
      const result = await expensesService.exportExpenses(args);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 35. render_chart
  addMcpTool(
    server,
    'render_chart',
    'Genera un gráfico PNG listo para Telegram en /opt/data/charts/ (by_category, monthly_trend, top_expenses, fixed_vs_variable, by_holder) y devuelve filePath + mediaTag. Incluí la línea exacta MEDIA:<filePath> en tu respuesta para enviar la imagen.',
    {
      chartType: z.enum([
        'by_category',
        'monthly_trend',
        'top_expenses',
        'fixed_vs_variable',
        'by_holder',
      ]),
      month: z.string().optional().describe('Mes YYYY-MM (default mes actual)'),
      year: z.coerce.number().int().min(2000).max(2100).optional(),
      scope: z.enum(['ALL', 'PERSONAL', 'SHARED']).optional(),
      memberRef: z.string().optional(),
      limit: z.coerce.number().int().min(3).max(15).optional().default(8),
    },
    async (args) => {
      const result = await expensesService.renderChart(args);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );
}
