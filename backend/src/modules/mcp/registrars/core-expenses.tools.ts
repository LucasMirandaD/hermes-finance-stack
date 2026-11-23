import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IExpensesService } from '../../expenses/domain/services/i-expenses.service';
import { PaperlessService } from '../../expenses/infrastructure/paperless.service';
import { parseArgentineAmount } from '../../expenses/domain/utils/amount-parser.util';
import { ExpenseMapper } from '../../expenses/presentation/mappers/expense.mapper';
import {
  addMcpTool,
  allocationItemSchema,
  errResult,
  okResult,
} from '../mcp-tool.helper';

export function registerCoreExpenseTools(
  server: McpServer,
  expensesService: IExpensesService,
  paperlessService: PaperlessService,
): void {
  // 1. health_check
  addMcpTool(
    server,
    'health_check',
    'Verifica conectividad con PostgreSQL, estadísticas de tablas y estado de servicios opcionales (Paperless-ngx).',
    {},
    async () => {
      const result = await expensesService.healthCheck();
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 2. register_expense
  addMcpTool(
    server,
    'register_expense',
    'Registra un nuevo gasto, compra, transferencia enviada o boleta en cuotas. Soporta montos argentinos ("889 mil", "1.5m", "45k"), multi-usuario (paidBy, scope PERSONAL/SHARED, allocations %), gastos fijos (isFixed) y archivado asíncrono opcional en Paperless-ngx (filePath).',
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
        .describe('Ruta local de la imagen o PDF recibido por Telegram para archivar en Paperless si está habilitado'),
    },
    async (args) => {
      const parsedAmount = parseArgentineAmount(args.totalAmount);
      if (parsedAmount <= 0) {
        return errResult('El monto debe ser mayor a 0.');
      }

      const totalInstallments = Math.max(1, args.totalInstallments ?? 1);
      const intervalMonths = Math.max(1, args.intervalMonths ?? 1);
      const isInstallment = Boolean(args.isInstallment) || totalInstallments > 1;

      const result = await expensesService.registerExpense({
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
      const paperlessEnabled = paperlessService.isEnabled();
      if (args.filePath && paperlessEnabled) {
        paperlessService.archiveExpenseDocumentAsync(
          saved.id,
          args.filePath,
          `${saved.merchantName} - ${saved.description}`,
        );
      }

      return okResult({
        registered: ExpenseMapper.toPresentation(saved),
        paperlessStatus: args.filePath
          ? paperlessEnabled
            ? 'ARCHIVING_IN_BACKGROUND'
            : 'DISABLED'
          : 'NONE',
      });
    },
  );

  // 3. search_expenses
  addMcpTool(
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
      const result = await expensesService.searchExpenses({
        q: args.query,
        category: args.category,
        startDate: args.startDate,
        endDate: args.endDate,
      });
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 4. list_recent_expenses
  addMcpTool(
    server,
    'list_recent_expenses',
    'Lista los últimos gastos registrados ordenados del más reciente al más antiguo.',
    {
      limit: z.coerce.number().int().min(1).max(30).optional().default(10),
    },
    async (args) => {
      const result = await expensesService.listExpenses(args.limit ?? 10, 0);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue().map((e) => ExpenseMapper.toPresentation(e)));
    },
  );

  // 5. update_expense
  addMcpTool(
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

      const result = await expensesService.updateExpense(args.expenseId, {
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

  // 6. delete_expense
  addMcpTool(
    server,
    'delete_expense',
    'Elimina permanentemente un gasto o deuda completa (y sus cuotas en cascada). Pedir confirmación si no fue explícita.',
    {
      expenseId: z.string().uuid(),
    },
    async (args) => {
      const result = await expensesService.deleteExpense(args.expenseId);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 7. extract_scanned_pdf_ocr
  addMcpTool(
    server,
    'extract_scanned_pdf_ocr',
    'Solo usar cuando read_file sobre un PDF devolvió texto vacío o ilegible (<50 caracteres) y Paperless-ngx está habilitado. Sube el PDF a Paperless, espera OCR y devuelve el texto + documentId.',
    {
      filePath: z.string().describe('Ruta local del archivo PDF en /opt/data/...'),
      title: z.string().optional(),
    },
    async (args) => {
      try {
        const ocrResult = await paperlessService.extractScannedPdfOcr(
          args.filePath,
          args.title,
        );
        return okResult(ocrResult);
      } catch (err: any) {
        return errResult(err?.message || 'Error ejecutando OCR en Paperless');
      }
    },
  );
}
