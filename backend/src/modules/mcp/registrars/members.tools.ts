import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IExpensesService } from '../../expenses/domain/services/i-expenses.service';
import { addMcpTool, errResult, okResult } from '../mcp-tool.helper';

export function registerMemberTools(
  server: McpServer,
  expensesService: IExpensesService,
): void {
  // 16. create_member
  addMcpTool(
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
      const result = await expensesService.createMember(args);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 17. update_member
  addMcpTool(
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
      const result = await expensesService.updateMember(args.memberRef, {
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

  // 18. list_members
  addMcpTool(
    server,
    'list_members',
    'Lista los miembros registrados del hogar con sus slugs, aliases y datos de Telegram.',
    {
      activeOnly: z.boolean().optional().default(true),
    },
    async (args) => {
      const result = await expensesService.listMembers(args.activeOnly ?? true);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 19. delete_member
  addMcpTool(
    server,
    'delete_member',
    'Elimina un miembro del hogar (solo si no tiene gastos ni repartos asociados).',
    {
      memberRef: z.string().describe('UUID, slug o nombre del miembro'),
    },
    async (args) => {
      const result = await expensesService.deleteMember(args.memberRef);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 20. get_shared_balance
  addMcpTool(
    server,
    'get_shared_balance',
    'Calcula el balance de gastos compartidos del hogar (scope=SHARED): cuánto pagó cada miembro, cuánto le correspondía según allocations, saldo neto y transferencias mínimas sugeridas ("quién le debe a quién").',
    {
      month: z.string().optional().describe('Mes YYYY-MM (opcional; sin filtro toma histórico)'),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    },
    async (args) => {
      const result = await expensesService.getSharedBalance(args);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );
}
