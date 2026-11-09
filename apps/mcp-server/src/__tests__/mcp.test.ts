import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildMcpServer, SERVER_INFO } from '../mcp.js';

test('ping tool is listed and answers pong', async () => {
  const server = buildMcpServer();
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await server.connect(serverT);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientT);
  const tools = await client.listTools();
  assert.deepEqual(
    tools.tools.map((t) => t.name),
    ['ping'],
  );
  const res = await client.callTool({ name: 'ping', arguments: { message: 'hi' } });
  const first = Array.isArray(res.content) ? res.content[0] : undefined;
  assert.ok(first && first.type === 'text');
  const body: unknown = JSON.parse(first.text);
  assert.ok(typeof body === 'object' && body !== null && 'pong' in body);
  assert.equal((body as { pong: boolean; echo: string }).echo, 'hi');
  assert.equal(SERVER_INFO.name, 'kubecon-pq-agent');
  await client.close();
  await server.close();
});
