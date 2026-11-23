import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IOutingsService } from '../../outings/domain/services/i-outings.service';
import { parseArgentineAmount } from '../../expenses/domain/utils/amount-parser.util';
import { addMcpTool, errResult, okResult } from '../mcp-tool.helper';

export function registerOutingsTools(
  server: McpServer,
  outingsService: IOutingsService,
): void {
  // 36. create_outing
  addMcpTool(
    server,
    'create_outing',
    'Crea una salida o evento grupal (ej: "Asado sábado", "Viaje Bariloche") para dividir gastos entre participantes. Funciona tanto si cargan varios usuarios como si un solo usuario anota lo que gastó cada persona.',
    {
      name: z.string().describe('Nombre de la salida o evento (ej: "Asado sábado")'),
      slug: z.string().optional(),
      description: z.string().optional(),
      eventDate: z.string().optional().describe('Fecha YYYY-MM-DD (default hoy)'),
      currency: z.string().optional().default('ARS'),
      participants: z
        .array(z.string())
        .optional()
        .describe('Lista inicial de nombres o slugs (ej: ["Ana", "Juan", "Sofía"])'),
      createdBy: z.string().optional().describe('Miembro que crea la salida'),
    },
    async (args) => {
      const result = await outingsService.createOuting(args);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 37. list_outings
  addMcpTool(
    server,
    'list_outings',
    'Lista salidas o eventos compartidos con cantidad de participantes, gastos cargados y total acumulado.',
    {
      status: z.enum(['OPEN', 'SETTLED', 'ARCHIVED']).optional(),
    },
    async (args) => {
      const result = await outingsService.listOutings(args.status);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 38. add_outing_participant
  addMcpTool(
    server,
    'add_outing_participant',
    'Agrega un participante a una salida existente (se vincula automáticamente si coincide con un miembro del hogar).',
    {
      outingRef: z.string().describe('UUID, slug o nombre de la salida'),
      name: z.string().describe('Nombre del participante'),
      aliases: z.array(z.string()).optional(),
    },
    async (args) => {
      const result = await outingsService.addParticipant(args.outingRef, {
        name: args.name,
        aliases: args.aliases,
      });
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 39. add_outing_expense
  addMcpTool(
    server,
    'add_outing_expense',
    'Carga un gasto dentro de una salida indicando quién pagó (paidBy), cuánto (acepta "45k", "80 mil"), y cómo dividirlo: entre todos (default), un subconjunto (splitBetween) o reparto personalizado (customShares en monto o %).',
    {
      outingRef: z.string().describe('UUID, slug o nombre de la salida'),
      paidBy: z.string().describe('Quién pagó este gasto (nombre, slug o alias)'),
      description: z.string().describe('Qué se pagó (ej: "Carne", "Bebidas", "Cabaña")'),
      amount: z.union([z.number(), z.string()]).describe('Monto pagado (ej: 45000 o "45k")'),
      merchantName: z.string().optional(),
      expenseDate: z.string().optional().describe('Fecha YYYY-MM-DD'),
      splitBetween: z
        .array(z.string())
        .optional()
        .describe('Lista de participantes entre quienes dividir este gasto en partes iguales (si se omite, se divide entre todos los participantes de la salida)'),
      customShares: z
        .array(
          z.object({
            participant: z.string(),
            amount: z.union([z.number(), z.string()]).optional(),
            percentage: z.coerce.number().optional(),
          }),
        )
        .optional()
        .describe('Reparto personalizado por participante (en montos exactos o porcentajes que sumen 100)'),
      notes: z.string().optional(),
      autoAddParticipants: z.boolean().optional().default(true),
    },
    async (args) => {
      const parsedAmt = parseArgentineAmount(args.amount);
      if (parsedAmt <= 0) {
        return errResult('El monto del gasto debe ser mayor a 0.');
      }

      const customShares = args.customShares?.map((s) => ({
        participant: s.participant,
        amount: s.amount !== undefined ? parseArgentineAmount(s.amount) : undefined,
        percentage: s.percentage,
      }));

      const result = await outingsService.addExpense(args.outingRef, {
        paidBy: args.paidBy,
        description: args.description,
        amount: parsedAmt,
        merchantName: args.merchantName,
        expenseDate: args.expenseDate,
        splitBetween: args.splitBetween,
        customShares,
        notes: args.notes,
        autoAddParticipants: args.autoAddParticipants,
      });
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 40. delete_outing_expense
  addMcpTool(
    server,
    'delete_outing_expense',
    'Elimina un gasto puntual de una salida por su UUID.',
    {
      expenseId: z.string().uuid(),
    },
    async (args) => {
      const result = await outingsService.deleteExpense(args.expenseId);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 41. get_outing_balance
  addMcpTool(
    server,
    'get_outing_balance',
    'Calcula la división de gastos de una salida: total gastado, promedio por persona, cuánto pagó y cuánto le corresponde a cada participante, y las transferencias mínimas exactas ("quién le transfiere cuánto a quién").',
    {
      outingRef: z.string().describe('UUID, slug o nombre de la salida'),
    },
    async (args) => {
      const result = await outingsService.getOutingBalance(args.outingRef);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 42. settle_outing
  addMcpTool(
    server,
    'settle_outing',
    'Cierra y marca una salida como SETTLED devolviendo el balance final. Opcionalmente registra la parte correspondiente a un participante (recordPersonalExpenseFor) como gasto personal en expenses.',
    {
      outingRef: z.string().describe('UUID, slug o nombre de la salida'),
      recordPersonalExpenseFor: z
        .string()
        .optional()
        .describe('Nombre o slug del participante cuya parte se desea registrar en gastos personales'),
      paymentMethod: z
        .enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'MERCADO_PAGO'])
        .optional(),
      bankName: z.string().optional(),
      category: z.string().optional().default('COMIDA_Y_SALIDAS'),
    },
    async (args) => {
      const result = await outingsService.settleOuting(args.outingRef, {
        recordPersonalExpenseFor: args.recordPersonalExpenseFor,
        paymentMethod: args.paymentMethod,
        bankName: args.bankName,
        category: args.category,
      });
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );

  // 43. delete_outing
  addMcpTool(
    server,
    'delete_outing',
    'Elimina una salida completa junto con sus participantes y gastos asociados.',
    {
      outingRef: z.string().describe('UUID, slug o nombre de la salida'),
    },
    async (args) => {
      const result = await outingsService.deleteOuting(args.outingRef);
      if (result.isFailure) return errResult(result.getError().message);
      return okResult(result.getValue());
    },
  );
}
