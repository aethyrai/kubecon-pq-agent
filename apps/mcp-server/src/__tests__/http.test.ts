import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
const { buildHttpApp } = await import('../server.js');
const app = buildHttpApp();

test('health endpoints answer', async () => {
  assert.equal((await app.request('/healthz')).status, 200);
  assert.equal((await app.request('/readyz')).status, 200);
});

test('POST /mcp initialize over Streamable HTTP returns server info', async () => {
  const res = await app.request('/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 't', version: '0' },
      },
    }),
  });
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /kubecon-pq-agent/);
});
