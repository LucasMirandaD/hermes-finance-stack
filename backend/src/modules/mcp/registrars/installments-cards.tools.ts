import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IExpensesService } from '../../expenses/domain/services/i-expenses.service';
import { parseArgentineAmount } from '../../expenses/domain/utils/amount-parser.util';
import { addMcpTool, errResult, okResult } from '../mcp-tool.helper';

export function registerInstallmentsAndCardsTools(
  server: McpServer,
  expensesService: IExpensesService,
): void {
  // 8. get_upcoming_installments
  addMcpTool(
    server,
    'get_upcoming_installments',
    'Lista las cuotas pendientes que vencen dentro de los próximos N días (incluyendo vencidas impagas).',
    {
      days: z.coerce.number().int().min(1).max(365).optional().default(30),
    },
    async (args) => {
      const result = await expensesService.getUpcomingInstallments(args.days ?? 30);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 9. get_monthly_installments_summary
  addMcpTool(
    server,
    'get_monthly_installments_summary',
    'Lista todas las cuotas de un mes YYYY-MM agrupadas por titular (byHolder), ordenadas por monto descendente y marcando isLastInstallment para formato móvil.',
    {
      month: z.string().describe('Mes YYYY-MM (ej: "2026-11")'),
    },
    async (args) => {
      const result = await expensesService.getMonthlyInstallmentsSummary(args.month);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 10. search_pending_installments
  addMcpTool(
    server,
    'search_pending_installments',
    'Busca cuotas pendientes por comercio/servicio y/o fecha de vencimiento exacta (YYYY-MM-DD).',
    {
      search: z.string().optional(),
      dueDate: z.string().optional(),
    },
    async (args) => {
      const result = await expensesService.searchPendingInstallments(
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

  // 11. pay_installment
  addMcpTool(
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
      const result = await expensesService.payInstallment(
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

  // 12. update_installment
  addMcpTool(
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

      const result = await expensesService.updateInstallment(args.installmentId, {
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

  // 13. delete_installment
  addMcpTool(
    server,
    'delete_installment',
    'Elimina una cuota específica y recalcula la deuda padre (o la elimina si era la única cuota).',
    {
      installmentId: z.string().uuid(),
    },
    async (args) => {
      const result = await expensesService.deleteInstallment(args.installmentId);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 14. list_credit_cards
  addMcpTool(
    server,
    'list_credit_cards',
    'Lista todas las tarjetas de crédito y extensiones familiares registradas con sus días de cierre y vencimiento.',
    {},
    async () => {
      const result = await expensesService.listCreditCards();
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 15. register_credit_card
  addMcpTool(
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
      const result = await expensesService.registerCreditCard(args);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );
}
