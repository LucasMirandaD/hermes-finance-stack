import { All, Controller, Logger, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { IExpensesService } from '../../domain/services/i-expenses.service';
import { PaperlessService } from '../../infrastructure/paperless.service';
import { parseArgentineAmount } from '../../domain/utils/amount-parser.util';
import { ExpenseMapper } from '../mappers/expense.mapper';

function okResult(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

function errResult(message: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
  };
}

const allocationItemSchema = z.object({
  member: z.string().describe('Slug, nombre o @usuario del miembro (ej: "alice", "pareja")'),
  percentage: z.coerce.number().min(0.01).max(100),
});

@Controller('mcp')
export class ExpensesMcpController {
  private readonly logger = new Logger(ExpensesMcpController.name);

  constructor(
    private readonly expensesService: IExpensesService,
    private readonly paperlessService: PaperlessService,
  ) {}

  private addTool<T extends Record<string, z.ZodTypeAny>>(
    server: McpServer,
    name: string,
    description: string,
    shape: T,
    handler: (args: { [K in keyof T]: z.infer<T[K]> }) => Promise<ReturnType<typeof okResult>>,
  ): void {
    (server.registerTool as (...a: unknown[]) => unknown)(
      name,
      { description, inputSchema: shape },
      handler,
    );
  }

  private createMcpServer(): McpServer {
    const server = new McpServer({
      name: 'nest-expenses-mcp',
      version: '2.0.0',
    });

    // 1. health_check
    this.addTool(
      server,
      'health_check',
      'Verifica conectividad con PostgreSQL, estadísticas de tablas y estado de Paperless-ngx.',
      {},
      async () => {
        const result = await this.expensesService.healthCheck();
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 2. register_expense
    this.addTool(
      server,
      'register_expense',
      'Registra un nuevo gasto, compra, transferencia enviada o boleta en cuotas. Soporta montos argentinos ("889 mil", "1.5m", "45k"), multi-usuario (paidBy, scope PERSONAL/SHARED, allocations %), gastos fijos (isFixed) y archivado asíncrono en Paperless-ngx (filePath).',
      {
        merchantName: z
          .string()
          .describe('Comercio, entidad o destinatario (ej: "BBVA", "Coto", "Aysam")'),
        description: z.string().describe('Concepto o detalle del gasto'),
        totalAmount: z
          .union([z.number(), z.string()])
          .describe('Monto total (ej: 889000, "889 mil", "1.5m")'),
        expenseDate: z.string().describe('Fecha YYYY-MM-DD (por defecto hoy)'),
        currency: z.string().optional().default('ARS'),
        paymentMethod: z
          .enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'MERCADO_PAGO'])
          .optional()
          .default('CREDIT_CARD'),
        bankName: z
          .string()
          .optional()
          .describe('Banco ORIGEN de la transferencia o débito (ej: "Galicia"). Nunca el destinatario.'),
        cardBank: z.string().optional().describe('Banco emisor de la tarjeta (ej: "Galicia", "BBVA")'),
        cardName: z.string().optional().describe('Red de tarjeta (ej: "Visa", "Mastercard")'),
        cardHolder: z.string().optional().describe('Titular o extensión de tarjeta'),
        scope: z
          .enum(['PERSONAL', 'SHARED'])
          .optional()
          .default('PERSONAL')
          .describe('PERSONAL (individual) o SHARED (gasto compartido del hogar)'),
        isFixed: z
          .boolean()
          .optional()
          .default(false)
          .describe('Marcar true si es un gasto fijo mensual/recurrente (ej: alquiler, expensas, internet)'),
        paidBy: z
          .string()
          .optional()
          .describe('Slug, nombre, @telegram o ID del miembro que realizó el pago'),
        allocations: z
          .array(allocationItemSchema)
          .optional()
          .describe('Reparto porcentual entre miembros (debe sumar 100%). Si scope=SHARED y se omite, reparte en partes iguales.'),
        isInstallment: z.boolean().optional().default(false),
        totalInstallments: z.coerce.number().int().min(1).optional().default(1),
        intervalMonths: z.coerce.number().int().min(1).optional().default(1),
        firstDueDate: z
          .string()
          .optional()
          .describe('Fecha del primer vencimiento YYYY-MM-DD cuando hay cuotas'),
        category: z.string().optional().default('OTROS'),
        source: z
          .enum(['PAPERLESS_OCR', 'CHAT_MESSAGE', 'SMS_NOTIFICATION', 'MANUAL'])
          .optional()
          .default('CHAT_MESSAGE'),
        rawSourceText: z.string().optional(),
        filePath: z
          .string()
          .optional()
          .describe('Ruta local de la imagen o PDF recibido por Telegram para archivar en Paperless en segundo plano'),
      },
      async (args) => {
        const parsedAmount = parseArgentineAmount(args.totalAmount);
        if (parsedAmount <= 0) {
          return errResult('El monto debe ser mayor a 0.');
        }

        const totalInstallments = Math.max(1, args.totalInstallments ?? 1);
        const intervalMonths = Math.max(1, args.intervalMonths ?? 1);
        const isInstallment = Boolean(args.isInstallment) || totalInstallments > 1;

        const result = await this.expensesService.registerExpense({
          merchantName: args.merchantName,
          description: args.description,
          totalAmount: parsedAmount,
          expenseDate: args.expenseDate,
          currency: args.currency || 'ARS',
          paymentMethod: args.paymentMethod || 'CREDIT_CARD',
          bankName: args.bankName,
          cardBank: args.cardBank,
          cardName: args.cardName,
          cardHolder: args.cardHolder,
          scope: args.scope,
          isFixed: args.isFixed,
          paidBy: args.paidBy,
          allocations: args.allocations,
          isInstallment,
          totalInstallments,
          intervalMonths,
          firstDueDate: isInstallment ? args.firstDueDate || args.expenseDate : undefined,
          category: args.category || 'OTROS',
          source: args.filePath ? 'PAPERLESS_OCR' : args.source || 'CHAT_MESSAGE',
          rawSourceText: args.rawSourceText,
        });

        if (result.isFailure) {
          return errResult(result.getError().message);
        }

        const saved = result.getValue();
        if (args.filePath) {
          this.paperlessService.archiveExpenseDocumentAsync(
            saved.id,
            args.filePath,
            `${saved.merchantName} - ${saved.description}`,
          );
        }

        return okResult({
          registered: ExpenseMapper.toPresentation(saved),
          paperlessStatus: args.filePath ? 'ARCHIVING_IN_BACKGROUND' : 'NONE',
        });
      },
    );

    // 3. get_financial_summary
    this.addTool(
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
        const result = await this.expensesService.getFinancialSummary(args);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 4. search_expenses
    this.addTool(
      server,
      'search_expenses',
      'Busca gastos y cuotas por comercio, descripción, categoría o rango de fechas. Resuelve alias automáticamente (ej: "aysam" -> "agua").',
      {
        query: z.string().optional().describe('Palabra clave o comercio'),
        category: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      },
      async (args) => {
        const result = await this.expensesService.searchExpenses({
          q: args.query,
          category: args.category,
          startDate: args.startDate,
          endDate: args.endDate,
        });
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 5. list_recent_expenses
    this.addTool(
      server,
      'list_recent_expenses',
      'Lista los últimos gastos registrados ordenados del más reciente al más antiguo.',
      {
        limit: z.coerce.number().int().min(1).max(30).optional().default(10),
      },
      async (args) => {
        const result = await this.expensesService.listExpenses(args.limit ?? 10, 0);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue().map((e) => ExpenseMapper.toPresentation(e)));
      },
    );

    // 6. get_upcoming_installments
    this.addTool(
      server,
      'get_upcoming_installments',
      'Lista las cuotas pendientes que vencen dentro de los próximos N días (incluyendo vencidas impagas).',
      {
        days: z.coerce.number().int().min(1).max(365).optional().default(30),
      },
      async (args) => {
        const result = await this.expensesService.getUpcomingInstallments(args.days ?? 30);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 7. get_monthly_installments_summary
    this.addTool(
      server,
      'get_monthly_installments_summary',
      'Lista todas las cuotas de un mes YYYY-MM agrupadas por titular (byHolder), ordenadas por monto descendente y marcando isLastInstallment para formato móvil.',
      {
        month: z.string().describe('Mes YYYY-MM (ej: "2026-11")'),
      },
      async (args) => {
        const result = await this.expensesService.getMonthlyInstallmentsSummary(args.month);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 8. search_pending_installments
    this.addTool(
      server,
      'search_pending_installments',
      'Busca cuotas pendientes por comercio/servicio y/o fecha de vencimiento exacta (YYYY-MM-DD).',
      {
        search: z.string().optional(),
        dueDate: z.string().optional(),
      },
      async (args) => {
        const result = await this.expensesService.searchPendingInstallments(
          args.search,
          args.dueDate,
        );
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(
          result.getValue().map((inst) => ({
            id: inst.id,
            expenseId: inst.expenseId,
            merchantName: inst.expense?.merchantName,
            description: inst.expense?.description,
            installmentNumber: inst.installmentNumber,
            totalInstallments: inst.totalInstallments,
            amount: Number(inst.amount),
            dueDate: inst.dueDate,
            status: inst.status,
            notes: inst.notes,
          })),
        );
      },
    );

    // 9. pay_installment
    this.addTool(
      server,
      'pay_installment',
      'Marca una cuota pendiente existente como PAGADA (status=PAID) indicando medio de pago y banco origen.',
      {
        installmentId: z.string().uuid(),
        paymentMethod: z
          .enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'MERCADO_PAGO'])
          .optional()
          .default('BANK_TRANSFER'),
        bankName: z.string().optional(),
        notes: z.string().optional(),
      },
      async (args) => {
        const result = await this.expensesService.payInstallment(
          args.installmentId,
          args.paymentMethod,
          args.bankName,
          args.notes,
        );
        if (result.isFailure) return errResult(result.getError().message);
        const inst = result.getValue();
        return okResult({
          id: inst.id,
          expenseId: inst.expenseId,
          merchantName: inst.expense?.merchantName,
          installmentNumber: inst.installmentNumber,
          totalInstallments: inst.totalInstallments,
          amount: Number(inst.amount),
          dueDate: inst.dueDate,
          status: inst.status,
          notes: inst.notes,
          paidAt: inst.paidAt,
        });
      },
    );

    // 10. update_expense
    this.addTool(
      server,
      'update_expense',
      'Actualiza monto total, banco origen, categoría, descripción, alcance (PERSONAL/SHARED), flag fijo (isFixed), pagador o reparto de un gasto existente.',
      {
        expenseId: z.string().uuid(),
        totalAmount: z.union([z.number(), z.string()]).optional(),
        bankName: z.string().optional(),
        category: z.string().optional(),
        description: z.string().optional(),
        merchantName: z.string().optional(),
        scope: z.enum(['PERSONAL', 'SHARED']).optional(),
        isFixed: z.boolean().optional(),
        paidBy: z.string().optional(),
        allocations: z.array(allocationItemSchema).optional(),
      },
      async (args) => {
        const parsedAmt =
          args.totalAmount !== undefined ? parseArgentineAmount(args.totalAmount) : undefined;
        if (parsedAmt !== undefined && parsedAmt <= 0) {
          return errResult('El nuevo monto debe ser mayor a 0.');
        }

        const result = await this.expensesService.updateExpense(args.expenseId, {
          totalAmount: parsedAmt,
          bankName: args.bankName,
          category: args.category,
          description: args.description,
          merchantName: args.merchantName,
          scope: args.scope,
          isFixed: args.isFixed,
          paidBy: args.paidBy,
          allocations: args.allocations,
        });
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(ExpenseMapper.toPresentation(result.getValue()));
      },
    );

    // 11. update_installment
    this.addTool(
      server,
      'update_installment',
      'Actualiza el monto o vencimiento de una cuota específica y recalcula automáticamente el monto total de la deuda padre.',
      {
        installmentId: z.string().uuid(),
        amount: z.union([z.number(), z.string()]).optional(),
        dueDate: z.string().optional().describe('Nueva fecha YYYY-MM-DD'),
        notes: z.string().optional(),
      },
      async (args) => {
        const parsedAmt = args.amount !== undefined ? parseArgentineAmount(args.amount) : undefined;
        if (parsedAmt !== undefined && parsedAmt <= 0) {
          return errResult('El nuevo monto de la cuota debe ser mayor a 0.');
        }

        const result = await this.expensesService.updateInstallment(args.installmentId, {
          amount: parsedAmt,
          dueDate: args.dueDate,
          notes: args.notes,
        });
        if (result.isFailure) return errResult(result.getError().message);
        const inst = result.getValue();
        return okResult({
          id: inst.id,
          expenseId: inst.expenseId,
          merchantName: inst.expense?.merchantName,
          installmentNumber: inst.installmentNumber,
          totalInstallments: inst.totalInstallments,
          amount: Number(inst.amount),
          dueDate: inst.dueDate,
          status: inst.status,
        });
      },
    );

    // 12. delete_expense
    this.addTool(
      server,
      'delete_expense',
      'Elimina permanentemente un gasto o deuda completa (y sus cuotas en cascada). Pedir confirmación si no fue explícita.',
      {
        expenseId: z.string().uuid(),
      },
      async (args) => {
        const result = await this.expensesService.deleteExpense(args.expenseId);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 13. delete_installment
    this.addTool(
      server,
      'delete_installment',
      'Elimina una cuota específica y recalcula la deuda padre (o la elimina si era la única cuota).',
      {
        installmentId: z.string().uuid(),
      },
      async (args) => {
        const result = await this.expensesService.deleteInstallment(args.installmentId);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 14. list_credit_cards
    this.addTool(
      server,
      'list_credit_cards',
      'Lista todas las tarjetas de crédito y extensiones familiares registradas con sus días de cierre y vencimiento.',
      {},
      async () => {
        const result = await this.expensesService.listCreditCards();
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 15. register_credit_card
    this.addTool(
      server,
      'register_credit_card',
      'Registra una nueva tarjeta de crédito titular o extensión familiar con banco, red, últimos 4 dígitos y días de cierre/vencimiento.',
      {
        bank: z.string().describe('Banco emisor (ej: "Galicia", "BBVA")'),
        cardName: z.string().describe('Nombre/red de la tarjeta (ej: "Visa", "Mastercard Black")'),
        holderName: z.string().describe('Nombre del titular o extensión'),
        lastFourDigits: z.string().length(4).optional(),
        isExtension: z.boolean().optional().default(false),
        closingDay: z.coerce.number().int().min(1).max(31).optional(),
        dueDay: z.coerce.number().int().min(1).max(31).optional(),
      },
      async (args) => {
        const result = await this.expensesService.registerCreditCard(args);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 16. extract_scanned_pdf_ocr
    this.addTool(
      server,
      'extract_scanned_pdf_ocr',
      'Solo usar cuando read_file sobre un PDF devolvió texto vacío o ilegible (<50 caracteres). Sube el PDF a Paperless-ngx, espera OCR y devuelve el texto + documentId.',
      {
        filePath: z.string().describe('Ruta local del archivo PDF en /opt/data/...'),
        title: z.string().optional(),
      },
      async (args) => {
        try {
          const ocrResult = await this.paperlessService.extractScannedPdfOcr(
            args.filePath,
            args.title,
          );
          return okResult(ocrResult);
        } catch (err: any) {
          return errResult(err?.message || 'Error ejecutando OCR en Paperless');
        }
      },
    );

    // 17. create_member
    this.addTool(
      server,
      'create_member',
      'Registra un miembro del hogar (para multi-usuario en un solo Hermes, gastos compartidos y balances).',
      {
        displayName: z.string().describe('Nombre visible (ej: "Alice", "Sofía")'),
        slug: z.string().optional().describe('Identificador corto sin espacios (ej: "alice")'),
        telegramUsername: z.string().optional().describe('Username de Telegram sin o con @'),
        telegramId: z.string().optional().describe('ID numérico de Telegram si se conoce'),
        aliases: z.array(z.string()).optional().describe('Apodos para reconocer quién habla o paga'),
      },
      async (args) => {
        const result = await this.expensesService.createMember(args);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 18. update_member
    this.addTool(
      server,
      'update_member',
      'Actualiza nombre, @usuario de Telegram, telegramId, aliases o estado activo de un miembro existente.',
      {
        memberRef: z.string().describe('UUID, slug, nombre o @telegram del miembro'),
        displayName: z.string().optional(),
        telegramUsername: z.string().optional(),
        telegramId: z.string().optional(),
        aliases: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
      },
      async (args) => {
        const result = await this.expensesService.updateMember(args.memberRef, {
          displayName: args.displayName,
          telegramUsername: args.telegramUsername,
          telegramId: args.telegramId,
          aliases: args.aliases,
          isActive: args.isActive,
        });
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 19. list_members
    this.addTool(
      server,
      'list_members',
      'Lista los miembros registrados del hogar con sus slugs, aliases y datos de Telegram.',
      {
        activeOnly: z.boolean().optional().default(true),
      },
      async (args) => {
        const result = await this.expensesService.listMembers(args.activeOnly ?? true);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 20. delete_member
    this.addTool(
      server,
      'delete_member',
      'Elimina un miembro del hogar (solo si no tiene gastos ni repartos asociados).',
      {
        memberRef: z.string().describe('UUID, slug o nombre del miembro'),
      },
      async (args) => {
        const result = await this.expensesService.deleteMember(args.memberRef);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 21. get_shared_balance
    this.addTool(
      server,
      'get_shared_balance',
      'Calcula el balance de gastos compartidos (scope=SHARED): cuánto pagó cada miembro, cuánto le correspondía según allocations, saldo neto y transferencias mínimas sugeridas ("quién le debe a quién").',
      {
        month: z.string().optional().describe('Mes YYYY-MM (opcional; sin filtro toma histórico)'),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      },
      async (args) => {
        const result = await this.expensesService.getSharedBalance(args);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 22. set_category_budget
    this.addTool(
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
        const result = await this.expensesService.setCategoryBudget({
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

    // 23. list_category_budgets
    this.addTool(
      server,
      'list_category_budgets',
      'Lista los presupuestos mensuales configurados por categoría.',
      {
        activeOnly: z.boolean().optional().default(true),
      },
      async (args) => {
        const result = await this.expensesService.listCategoryBudgets(args.activeOnly ?? true);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 24. delete_category_budget
    this.addTool(
      server,
      'delete_category_budget',
      'Elimina un presupuesto de categoría por su UUID.',
      {
        budgetId: z.string().uuid(),
      },
      async (args) => {
        const result = await this.expensesService.deleteCategoryBudget(args.budgetId);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 25. get_budget_status
    this.addTool(
      server,
      'get_budget_status',
      'Consulta el estado de ejecución de presupuestos en el mes: gastado vs presupuestado, % usado, restante y alertas.',
      {
        month: z.string().optional().describe('Mes YYYY-MM (default mes actual)'),
        alertsOnly: z.boolean().optional().default(false),
      },
      async (args) => {
        const result = await this.expensesService.getBudgetStatus(args.month, args.alertsOnly);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 26. create_recurring_expense
    this.addTool(
      server,
      'create_recurring_expense',
      'Define una plantilla de gasto fijo / recurrente (ej: Alquiler, Internet, Expensas, Luz, Seguro) con día estimado de vencimiento, monto estimado, alcance PERSONAL/SHARED y allocations por defecto.',
      {
        merchantName: z.string().describe('Nombre del servicio o destinatario (ej: "Internet Fibra", "Alquiler")'),
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
        const result = await this.expensesService.createRecurringExpense({
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

    // 27. list_recurring_expenses
    this.addTool(
      server,
      'list_recurring_expenses',
      'Lista las plantillas de gastos fijos / recurrentes configuradas.',
      {
        activeOnly: z.boolean().optional().default(true),
      },
      async (args) => {
        const result = await this.expensesService.listRecurringExpenses(args.activeOnly ?? true);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 28. update_recurring_expense
    this.addTool(
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
        const result = await this.expensesService.updateRecurringExpense(args.recurringId, {
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

    // 29. delete_recurring_expense
    this.addTool(
      server,
      'delete_recurring_expense',
      'Elimina una plantilla de gasto fijo por su UUID.',
      {
        recurringId: z.string().uuid(),
      },
      async (args) => {
        const result = await this.expensesService.deleteRecurringExpense(args.recurringId);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 30. get_fixed_expenses_status
    this.addTool(
      server,
      'get_fixed_expenses_status',
      'Muestra qué gastos fijos ya se pagaron en el mes y cuáles siguen pendientes o vencidos (ideal para "¿qué fijos faltan pagar este mes?").',
      {
        month: z.string().optional().describe('Mes YYYY-MM (default mes actual)'),
      },
      async (args) => {
        const result = await this.expensesService.getFixedExpensesStatus(args.month);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 31. pay_recurring_expense
    this.addTool(
      server,
      'pay_recurring_expense',
      'Registra el pago del mes de un gasto fijo definido (buscando por nombre o UUID). Permite sobreescribir el monto real si cambió respecto al estimado.',
      {
        recurringRef: z.string().describe('Nombre/comercio del gasto fijo (ej: "Alquiler", "Internet") o su UUID'),
        amount: z.union([z.number(), z.string()]).optional().describe('Monto real pagado si difiere del estimado'),
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
        const result = await this.expensesService.payRecurringExpense(args.recurringRef, {
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

    // 32. compare_months
    this.addTool(
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
        const result = await this.expensesService.compareMonths(
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
    this.addTool(
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
        const result = await this.expensesService.getTopExpenses(args);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 34. export_expenses
    this.addTool(
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
        const result = await this.expensesService.exportExpenses(args);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    // 35. render_chart
    this.addTool(
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
        const result = await this.expensesService.renderChart(args);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    return server;
  }

  @All()
  async handleMcp(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (req.method !== 'POST') {
      res.status(405).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed on stateless MCP endpoint. Use POST.' },
        id: null,
      });
      return;
    }

    const server = this.createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error: any) {
      this.logger.error(`MCP request failed: ${error?.message || error}`, error?.stack);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal MCP server error' },
          id: null,
        });
      }
    }
  }
}
