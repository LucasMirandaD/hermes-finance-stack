import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function okResult(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function errResult(message: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
  };
}

export function addMcpTool<T extends Record<string, z.ZodTypeAny>>(
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

export const allocationItemSchema = z.object({
  member: z.string().describe('Slug, nombre o @usuario del miembro (ej: "alice", "pareja")'),
  percentage: z.coerce.number().min(0.01).max(100),
});
