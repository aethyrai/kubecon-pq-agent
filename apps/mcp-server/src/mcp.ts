import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export const SERVER_INFO = { name: 'kubecon-pq-agent', version: '0.1.0' } as const;

/** One stub tool. The Monday build adds search_sessions, get_schedule, recommend, check_conflicts. */
export function buildMcpServer(): McpServer {
  const server = new McpServer(SERVER_INFO);
  server.registerTool(
    'ping',
    {
      title: 'Ping',
      description:
        'Liveness check for the KubeCon conference agent. Returns pong and the server time.',
      inputSchema: { message: z.string().max(200).optional() },
    },
    async ({ message }) => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ pong: true, echo: message ?? null, at: new Date().toISOString() }),
        },
      ],
    }),
  );
  return server;
}
