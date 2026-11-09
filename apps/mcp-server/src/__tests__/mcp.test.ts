import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { ApiClient } from '../api-client.js';
import { httpApiClient } from '../api-client.js';
import { buildMcpServer, SERVER_INFO } from '../mcp.js';

function fakeApi(): ApiClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async get(path, query) {
      const q = Object.entries(query ?? {})
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
      calls.push(`GET ${path}${q ? `?${q}` : ''}`);
      if (path === '/plan/conflicts')
        return { conflicts: [{ a: 's1', b: 's2', overlapMinutes: 15 }], missing: [] };
      return { path, hits: [{ id: 's1', title: 'Agents' }], session_ids: ['s1'] };
    },
    async post(path, body) {
      calls.push(`POST ${path} ${JSON.stringify(body)}`);
      return { session_ids: ['s1', 's2'], sessions: [] };
    },
  };
}

async function connect(api: ApiClient) {
  const server = buildMcpServer(api);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(ct);
  return { client, server };
}
const textOf = (res: unknown): string => {
  const content =
    typeof res === 'object' && res !== null ? (res as { content?: unknown }).content : undefined;
  const c = Array.isArray(content) ? content[0] : undefined;
  return c && typeof c === 'object' && 'text' in c ? String((c as { text: unknown }).text) : '';
};

test('all eight tools, the schedule resource, and the plan prompt are listed', async () => {
  const api = fakeApi();
  const { client, server } = await connect(api);
  const tools = (await client.listTools()).tools.map((t) => t.name).sort();
  assert.deepEqual(tools, [
    'check_conflicts',
    'find_booths',
    'get_schedule',
    'ping',
    'recommend',
    'room_accessibility',
    'search_sessions',
    'side_events',
  ]);
  const templates = await client.listResourceTemplates();
  assert.equal(templates.resourceTemplates[0]?.uriTemplate, 'kubecon://schedule/{day}');
  const prompts = await client.listPrompts();
  assert.equal(prompts.prompts[0]?.name, 'plan-my-day');
  assert.equal(SERVER_INFO.name, 'kubecon-pq-agent');
  await client.close();
  await server.close();
});

test('tools map onto api routes with filters and echo session ids', async () => {
  const api = fakeApi();
  const { client, server } = await connect(api);
  await client.callTool({
    name: 'search_sessions',
    arguments: { query: 'agents that fix clusters', day: '2026-11-10', captioned: true, size: 5 },
  });
  assert.equal(
    api.calls[0],
    'GET /search?q=agents that fix clusters&size=5&day=2026-11-10&captioned=true',
  );
  const rec = await client.callTool({
    name: 'recommend',
    arguments: { interests: 'agent security', day: '2026-11-10' },
  });
  assert.match(textOf(rec), /"session_ids"/);
  assert.match(
    api.calls[1] ?? '',
    /^POST \/recommend \{"interests":"agent security","filters":\{"day":"2026-11-10"\}\}$/,
  );
  const conf = await client.callTool({
    name: 'check_conflicts',
    arguments: { session_ids: ['s1', 's2'] },
  });
  assert.match(textOf(conf), /overlapMinutes/);
  await client.callTool({
    name: 'get_schedule',
    arguments: { day: '2026-11-11', event: 'ArgoCon' },
  });
  assert.equal(api.calls[3], 'GET /schedule/2026-11-11?event=ArgoCon');
  await client.callTool({ name: 'room_accessibility', arguments: { room_id: '82949' } });
  assert.equal(api.calls[4], 'GET /rooms/82949/access');
  const bad = await client.callTool({ name: 'get_schedule', arguments: { day: '2026-12-25' } });
  assert.equal(bad.isError, true);
  await client.close();
  await server.close();
});

test('the schedule resource and the plan prompt render', async () => {
  const api = fakeApi();
  const { client, server } = await connect(api);
  const r = await client.readResource({ uri: 'kubecon://schedule/2026-11-10' });
  assert.equal(r.contents[0]?.mimeType, 'application/json');
  assert.equal(api.calls[0], 'GET /schedule/2026-11-10');
  const p = await client.getPrompt({
    name: 'plan-my-day',
    arguments: { day: '2026-11-10', interests: 'agents' },
  });
  const m = p.messages[0];
  assert.ok(m && m.content.type === 'text' && /check_conflicts/.test(m.content.text));
  await client.close();
  await server.close();
});

test('httpApiClient builds URLs against the base and surfaces HTTP errors', async () => {
  const seen: string[] = [];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    seen.push(`${init?.method ?? 'GET'} ${String(input)}`);
    return new Response(String(input).includes('/boom') ? 'nope' : '{"ok":true}', {
      status: String(input).includes('/boom') ? 500 : 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  const api = httpApiClient('http://api.conf.svc', fetchFn);
  assert.deepEqual(await api.get('/search', { q: 'a b', size: undefined }), { ok: true });
  assert.equal(seen[0], 'GET http://api.conf.svc/search?q=a+b');
  await assert.rejects(() => api.get('/boom'), /HTTP 500/);
});
