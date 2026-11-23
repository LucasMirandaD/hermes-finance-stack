import { All, Controller, Logger, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { IExpensesService } from '../expenses/domain/services/i-expenses.service';
import { PaperlessService } from '../expenses/infrastructure/paperless.service';
import { IOutingsService } from '../outings/domain/services/i-outings.service';
import { registerCoreExpenseTools } from './registrars/core-expenses.tools';
import { registerInstallmentsAndCardsTools } from './registrars/installments-cards.tools';
import { registerMemberTools } from './registrars/members.tools';
import { registerBudgetTools } from './registrars/budgets.tools';
import { registerRecurringTools } from './registrars/recurring.tools';
import { registerAnalyticsTools } from './registrars/analytics.tools';
import { registerOutingsTools } from './registrars/outings.tools';

@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly expensesService: IExpensesService,
    private readonly outingsService: IOutingsService,
    private readonly paperlessService: PaperlessService,
  ) {}

  private createMcpServer(): McpServer {
    const server = new McpServer({
      name: 'nest-expenses-mcp',
      version: '2.1.0',
    });

    registerCoreExpenseTools(server, this.expensesService, this.paperlessService);
    registerInstallmentsAndCardsTools(server, this.expensesService);
    registerMemberTools(server, this.expensesService);
    registerBudgetTools(server, this.expensesService);
    registerRecurringTools(server, this.expensesService);
    registerAnalyticsTools(server, this.expensesService);
    registerOutingsTools(server, this.outingsService);

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
