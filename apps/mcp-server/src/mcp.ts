import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from './api-client.js';

export const SERVER_INFO = { name: 'kubecon-pq-agent', version: '0.2.0' } as const;

const Day = z
  .enum(['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'])
  .describe('Conference day (YYYY-MM-DD). Nov 10-12 are the main KubeCon days.');
const Filters = {
  day: Day.optional(),
  track: z
    .string()
    .max(80)
    .optional()
    .describe('Track name, e.g. "AI Inference + Agentic", "Security", "Observability"'),
  level: z.enum(['Beginner', 'Any Level', 'Advanced']).optional(),
  captioned: z.boolean().optional().describe('Only sessions with live captioning'),
  event: z
    .string()
    .max(80)
    .optional()
    .describe('Co-located event name, e.g. "ArgoCon", "Observability Day"'),
};

const text = (v: unknown) => ({
  content: [
    { type: 'text' as const, text: typeof v === 'string' ? v : JSON.stringify(v, null, 2) },
  ],
});

/** Tools map one-to-one onto api routes and always return session ids so a client can render chips. */
export function buildMcpServer(api: ApiClient): McpServer {
  const server = new McpServer(SERVER_INFO);

  server.registerTool(
    'ping',
    {
      title: 'Ping',
      description: 'Liveness check. Returns pong and the server time.',
      inputSchema: { message: z.string().max(200).optional() },
    },
    async ({ message }) =>
      text({ pong: true, echo: message ?? null, at: new Date().toISOString() }),
  );

  server.registerTool(
    'search_sessions',
    {
      title: 'Search sessions',
      description:
        'Hybrid keyword + semantic search over KubeCon NA 2026 sessions (keynotes, talks, tutorials, co-located events). Returns session ids, titles, times, rooms, tracks, and which retrieval leg found each hit.',
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(300)
          .describe('What the attendee is looking for, in plain words'),
        size: z.number().int().min(1).max(50).optional(),
        ...Filters,
      },
    },
    async ({ query, size, ...f }) =>
      text(
        await api.get('/search', {
          q: query,
          size: size?.toString(),
          day: f.day,
          track: f.track,
          level: f.level,
          captioned: f.captioned === undefined ? undefined : String(f.captioned),
          event: f.event,
        }),
      ),
  );

  server.registerTool(
    'get_schedule',
    {
      title: 'Get schedule',
      description:
        'All sessions on one day in start-time order, optionally filtered by track, level, captioning, or co-located event.',
      inputSchema: {
        day: Day,
        track: Filters.track,
        level: Filters.level,
        captioned: Filters.captioned,
        event: Filters.event,
      },
    },
    async ({ day, ...f }) =>
      text(
        await api.get(`/schedule/${day}`, {
          track: f.track,
          level: f.level,
          captioned: f.captioned === undefined ? undefined : String(f.captioned),
          event: f.event,
        }),
      ),
  );

  server.registerTool(
    'recommend',
    {
      title: 'Recommend sessions',
      description:
        "Top sessions for an attendee's interests, described in free text. Semantic first. Returns session_ids plus the sessions; pass the ids to check_conflicts before building a plan.",
      inputSchema: {
        interests: z
          .string()
          .min(3)
          .max(1000)
          .describe(
            'Interests, role, or goals, e.g. "platform engineer who wants agentic workflows and supply-chain security"',
          ),
        size: z.number().int().min(1).max(20).optional(),
        ...Filters,
      },
    },
    async ({ interests, size, ...f }) =>
      text(
        await api.post(`/recommend${size ? `?size=${size}` : ''}`, {
          interests,
          filters: { ...f, captioned: f.captioned === undefined ? undefined : String(f.captioned) },
        }),
      ),
  );

  server.registerTool(
    'check_conflicts',
    {
      title: 'Check conflicts',
      description:
        'Given session ids, return the pairs that overlap in time, with the overlap in minutes, plus any ids that do not exist.',
      inputSchema: { session_ids: z.array(z.string().min(1)).min(2).max(40) },
    },
    async ({ session_ids }) =>
      text(await api.get('/plan/conflicts', { ids: session_ids.join(',') })),
  );

  server.registerTool(
    'find_booths',
    {
      title: 'Find booths',
      description:
        'Search the Solutions Showcase exhibitors by product area or company. Returns booth numbers and tiers.',
      inputSchema: {
        query: z.string().min(1).max(200),
        size: z.number().int().min(1).max(50).optional(),
      },
    },
    async ({ query, size }) => text(await api.get('/booths', { q: query, size: size?.toString() })),
  );

  server.registerTool(
    'side_events',
    {
      title: 'Side events',
      description:
        'Sponsor-hosted co-located and side events around the conference, with host, times, and registration notes.',
      inputSchema: { day: Day.optional() },
    },
    async ({ day }) => text(await api.get('/side-events', { day })),
  );

  server.registerTool(
    'room_accessibility',
    {
      title: 'Room accessibility',
      description:
        'Accessibility facts for a room: wheelchair route, captioning, hearing loop, nearest quiet room and accessible restroom. Use the room id from a session.',
      inputSchema: { room_id: z.string().min(1).max(40) },
    },
    async ({ room_id }) => text(await api.get(`/rooms/${encodeURIComponent(room_id)}/access`)),
  );

  server.registerResource(
    'schedule',
    new ResourceTemplate('kubecon://schedule/{day}', { list: undefined }),
    {
      title: 'Daily schedule',
      description: 'Sessions for one conference day',
      mimeType: 'application/json',
    },
    async (uri, { day }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(await api.get(`/schedule/${String(day)}`)),
        },
      ],
    }),
  );

  server.registerPrompt(
    'plan-my-day',
    {
      title: 'Plan my day',
      description: 'Build a conflict-free plan for one day from the attendee interests',
      argsSchema: {
        day: z.string().describe('YYYY-MM-DD'),
        interests: z.string().describe('What the attendee cares about'),
      },
    },
    ({ day, interests }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Plan my ${day} at KubeCon NA 2026. My interests: ${interests}. Steps: call recommend with day=${day}; call check_conflicts on the returned session_ids; drop the lower-ranked talk of any conflicting pair; list the plan in time order with room and a one-line reason each; then call room_accessibility for the first room and mention the wheelchair route and captioning.`,
          },
        },
      ],
    }),
  );
  return server;
}
