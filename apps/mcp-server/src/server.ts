import { serve } from '@hono/node-server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono } from 'hono';
import { log } from './log.js';
import { buildMcpServer } from './mcp.js';

const port = Number(process.env.PORT ?? 8081);

export function buildHttpApp(): Hono {
  const app = new Hono();
  app.get('/healthz', (c) => c.json({ status: 'ok' }));
  app.get('/readyz', (c) => c.json({ status: 'ready' }));

  // Stateless Streamable HTTP: one server + transport per request, so a canary swap loses no session table.
  app.all('/mcp', async (c) => {
    const server = buildMcpServer();
    // JSON responses, not SSE: the whole reply is in the body when handleRequest resolves, and the
    // per-request server and transport are garbage-collected with it.
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  serve({ fetch: buildHttpApp().fetch, port, hostname: '0.0.0.0' }, (info) =>
    log.info({ port: info.port }, 'mcp-server listening'),
  );
}
