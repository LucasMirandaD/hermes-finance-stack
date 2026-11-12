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
      version: '1.0.0',
    });

    this.addTool(
      server,
      'register_expense',
      'Registra un nuevo gasto, compra, transferencia enviada o boleta en cuotas. Acepta montos numéricos o abreviaciones argentinas ("889 mil", "1.5m", "45k"). Si se pasa filePath (foto o PDF), lo archiva asíncronamente en Paperless-ngx.',
      {
        merchantName: z.string().describe('Comercio, entidad o destinatario de la transferencia (ej: "BBVA", "Coto", "Santos Luis Ignacio", "Aysam")'),
        description: z.string().describe('Concepto o detalle del gasto'),
        totalAmount: z.union([z.number(), z.string()]).describe('Monto total (ej: 889000 o "889 mil" o "1.5m")'),
        expenseDate: z.string().describe('Fecha YYYY-MM-DD (por defecto hoy)'),
        currency: z.string().optional().default('ARS'),
        paymentMethod: z
          .enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'MERCADO_PAGO'])
          .optional()
          .default('CREDIT_CARD'),
        bankName: z.string().optional().describe('Banco ORIGEN de la transferencia o débito (ej: "Galicia"). Nunca poner aquí al destinatario si no se indicó origen.'),
        cardBank: z.string().optional().describe('Banco emisor de la tarjeta (ej: "Galicia", "BBVA")'),
        cardName: z.string().optional().describe('Red de tarjeta (ej: "Visa", "Mastercard")'),
        cardHolder: z.string().optional().describe('Titular o extensión (ej: "Titular", "Pareja", "Hermano", "Mamá")'),
        isInstallment: z.boolean().optional().default(false),
        totalInstallments: z.coerce.number().int().min(1).optional().default(1),
        intervalMonths: z.coerce.number().int().min(1).optional().default(1),
        firstDueDate: z.string().optional().describe('Fecha del primer vencimiento YYYY-MM-DD cuando hay cuotas'),
        category: z.string().optional().default('OTROS'),
        source: z
          .enum(['PAPERLESS_OCR', 'CHAT_MESSAGE', 'SMS_NOTIFICATION', 'MANUAL'])
          .optional()
          .default('CHAT_MESSAGE'),
        rawSourceText: z.string().optional(),
        filePath: z.string().optional().describe('Ruta local de la imagen o PDF recibido por Telegram para archivarlo en Paperless en segundo plano'),
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
          isInstallment,
          totalInstallments,
          intervalMonths,
          firstDueDate: isInstallment ? (args.firstDueDate || args.expenseDate) : undefined,
          category: args.category || 'OTROS',
          source: args.filePath ? 'PAPERLESS_OCR' : (args.source || 'CHAT_MESSAGE'),
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

    this.addTool(
      server,
      'get_financial_summary',
      'Obtiene el resumen ejecutivo de gastos: total efectivamente pagado (cashflow), cuotas pendientes del período, desglose por categoría, por banco y comparativa contra el período anterior.',
      {
        month: z.string().optional().describe('Mes en formato YYYY-MM (ej: "2026-11")'),
        startDate: z.string().optional().describe('Fecha inicio YYYY-MM-DD (opcional si se pasa month)'),
        endDate: z.string().optional().describe('Fecha fin YYYY-MM-DD (opcional si se pasa month)'),
      },
      async (args) => {
        const result = await this.expensesService.getFinancialSummary(args);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

    this.addTool(
      server,
      'search_expenses',
      'Busca gastos y cuotas por comercio, descripción, categoría o rango de fechas. Resuelve alias automáticamente (ej: "aysam" -> "agua").',
      {
        query: z.string().optional().describe('Palabra clave o comercio (ej: "Aysam", "BBVA", "Cencopay")'),
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

    this.addTool(
      server,
      'search_pending_installments',
      'Busca cuotas pendientes por comercio/servicio y/o fecha de vencimiento exacta (YYYY-MM-DD).',
      {
        search: z.string().optional(),
        dueDate: z.string().optional(),
      },
      async (args) => {
        const result = await this.expensesService.searchPendingInstallments(args.search, args.dueDate);
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

    this.addTool(
      server,
      'update_expense',
      'Actualiza el monto total, banco origen, categoría o descripción de una deuda/gasto existente. Si tiene cuotas pendientes, redistribuye el saldo pendiente automáticamente.',
      {
        expenseId: z.string().uuid(),
        totalAmount: z.union([z.number(), z.string()]).optional(),
        bankName: z.string().optional(),
        category: z.string().optional(),
        description: z.string().optional(),
        merchantName: z.string().optional(),
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
        });
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(ExpenseMapper.toPresentation(result.getValue()));
      },
    );

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

    this.addTool(
      server,
      'delete_expense',
      'Elimina permanentemente un gasto o deuda completa (y todas sus cuotas en cascada). Pedir confirmación al usuario antes si no fue explícita.',
      {
        expenseId: z.string().uuid(),
      },
      async (args) => {
        const result = await this.expensesService.deleteExpense(args.expenseId);
        if (result.isFailure) return errResult(result.getError().message);
        return okResult(result.getValue());
      },
    );

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

    this.addTool(
      server,
      'extract_scanned_pdf_ocr',
      'Solo usar cuando read_file sobre un PDF devolvió texto vacío o ilegible (<50 caracteres, PDF escaneado). Sube el PDF a Paperless-ngx, espera OCR Tesseract y devuelve el texto + documentId.',
      {
        filePath: z.string().describe('Ruta local del archivo PDF en /opt/data/...'),
        title: z.string().optional(),
      },
      async (args) => {
        try {
          const ocrResult = await this.paperlessService.extractScannedPdfOcr(args.filePath, args.title);
          return okResult(ocrResult);
        } catch (err: any) {
          return errResult(err?.message || 'Error ejecutando OCR en Paperless');
        }
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
