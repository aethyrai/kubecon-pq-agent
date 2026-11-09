import { readFile } from 'node:fs/promises';
import type { SessionDoc, SideEventDoc } from '../documents.js';
import { normalizeSessions, stripHtml } from '../normalize.js';
import { extractSchedData, type LfSchedData } from './lf-sched.js';

const BASE =
  'https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/co-located-events';
export const LF_COLOC_SPONSOR_URL = `${BASE}/sponsor-hosted-co-located-schedule/`;
export const LF_COLOC_CNCF_URL = `${BASE}/cncf-hosted-co-located-schedule/`;

/**
 * Sponsor-hosted co-located events are the conference's own side events: half-day or full-day
 * sessions a sponsor runs on Sunday and Monday, often with separate registration.
 */
export function sideEventsFromSponsorHosted(data: LfSchedData): SideEventDoc[] {
  const rooms = new Map(data.all.rooms.map((r) => [r.id, r.name]));
  const websiteQ = data.all.questions.find((q) => q.question === 'Website')?.id;
  const mapQ = data.all.questions.find((q) => q.question === 'Location Map')?.id;
  return data.all.sessions
    .filter((s) => !s.isServiceSession && s.title.trim().length > 0)
    .map((s) => {
      const title = s.title
        .replace(/\s*\|\s*(SOLD OUT|SEPARATE REGISTRATION REQUIRED)\s*$/i, '')
        .trim();
      const host = /hosted by ([^|]+?)(?:\s*\||$)/i.exec(s.title)?.[1]?.trim() ?? '';
      const answer = (qid: number | undefined): string =>
        qid === undefined
          ? ''
          : (s.questionAnswers.find((a) => a.questionId === qid)?.answerValue ?? '');
      const soldOut = /SOLD OUT/i.test(s.title);
      return {
        id: `coloc-${s.id}`,
        name: title,
        host,
        start: s.startsAt,
        end: s.endsAt,
        address: s.roomId === null ? '' : (rooms.get(s.roomId) ?? ''),
        rsvp_url: answer(websiteQ) || answer(mapQ),
        capacity_note: soldOut
          ? 'Sold out'
          : /SEPARATE REGISTRATION/i.test(s.title)
            ? 'Separate registration required'
            : '',
        description: stripHtml(s.description ?? ''),
        badge_required: !/SEPARATE REGISTRATION/i.test(s.title),
        accessibility_note: '',
      };
    });
}

/**
 * CNCF-hosted co-located talks (ArgoCon, BackstageCon, Observability Day, ...) are sessions: they get
 * the normal session shape with colocated_event set from their category and ids prefixed to avoid
 * clashing with the main schedule's Sessionize ids.
 */
export function sessionsFromCncfHosted(data: LfSchedData): SessionDoc[] {
  const topicCats = new Map<number, string>();
  for (const c of data.all.categories) {
    const title = c.title.trim();
    if (/Topics$|Day$|Agentics Day/i.test(title)) {
      const eventName = title
        .replace(/\s*Topics$/i, '')
        .replace(/:\s*MCP \+ Agents$/i, '')
        .trim();
      for (const it of c.items) topicCats.set(it.id, eventName);
    }
  }
  return normalizeSessions(data).map((doc) => {
    const raw = data.all.sessions.find((s) => s.id === doc.id);
    const event =
      raw?.categoryItems.map((id) => topicCats.get(id)).find((n): n is string => !!n) ?? '';
    return {
      ...doc,
      id: `coloc-${doc.id}`,
      colocated_event: event || doc.colocated_event,
      track: doc.track || event,
      url: `${LF_COLOC_CNCF_URL}?id=${doc.id}`,
    };
  });
}

export async function fetchColoc(url: string): Promise<LfSchedData> {
  const res = await fetch(url, { headers: { 'user-agent': 'kubecon-pq-agent-ingest/0.1' } });
  if (!res.ok) throw new Error(`co-located schedule ${url}: HTTP ${res.status}`);
  return extractSchedData(await res.text());
}
export async function loadColocFixture(path: string): Promise<LfSchedData> {
  return extractSchedData(await readFile(path, 'utf8'));
}
