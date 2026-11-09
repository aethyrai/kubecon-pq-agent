import { readFile } from 'node:fs/promises';

/** The schedule data the Linux Foundation event page embeds (Sessionize export). */
export interface LfSchedData {
  all: {
    sessions: LfSession[];
    speakers: LfSpeaker[];
    rooms: LfRoom[];
    categories: LfCategory[];
    questions: LfQuestion[];
  };
}
export interface LfSession {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  isServiceSession: boolean;
  isPlenumSession: boolean;
  speakers: string[];
  categoryItems: number[];
  questionAnswers: LfAnswer[];
  roomId: number | null;
  liveUrl: string | null;
  recordingUrl: string | null;
  status: string;
}
export interface LfSpeaker {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  bio: string | null;
  tagLine: string | null;
  profilePicture: string | null;
  links: Array<{ title: string; url: string; linkType: string }>;
  sessions: number[];
  categoryItems: number[];
  questionAnswers: LfAnswer[];
}
export interface LfRoom {
  id: number;
  name: string;
  sort: number;
}
export interface LfCategory {
  id: number;
  title: string;
  type: string;
  sort: number;
  items: Array<{ id: number; name: string; sort: number }>;
}
export interface LfQuestion {
  id: number;
  question: string;
  questionType: string;
  sort: number;
}
export interface LfAnswer {
  questionId: number;
  answerValue: string;
}

export const LF_SCHEDULE_URL =
  'https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/program/schedule/';

const SCHED_DATA_RE =
  /<script type="application\/json" class="sched-data">\s*([\s\S]*?)\s*<\/script>/;

function isLfSchedData(value: unknown): value is LfSchedData {
  if (typeof value !== 'object' || value === null) return false;
  const all = (value as { all?: unknown }).all;
  if (typeof all !== 'object' || all === null) return false;
  const a = all as Record<string, unknown>;
  return Array.isArray(a.sessions) && Array.isArray(a.speakers) && Array.isArray(a.rooms);
}

/** Pull the embedded JSON out of the schedule page HTML. */
export function extractSchedData(html: string): LfSchedData {
  const m = SCHED_DATA_RE.exec(html);
  if (!m?.[1]) throw new Error('sched-data script not found in schedule page');
  let raw = m[1].trim();
  if (raw.startsWith("'") && raw.endsWith("'")) raw = raw.slice(1, -1);
  raw = raw.replaceAll('&quot;', '"').replaceAll('&#039;', "'").replaceAll('&amp;', '&');
  const parsed: unknown = JSON.parse(raw);
  if (!isLfSchedData(parsed)) throw new Error('sched-data has an unexpected shape');
  return parsed;
}

/** Fetch the live page. The caller saves the HTML as a fixture on first success. */
export async function fetchSchedulePage(url: string = LF_SCHEDULE_URL): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': 'kubecon-pq-agent-ingest/0.1' } });
  if (!res.ok) throw new Error(`schedule page ${url}: HTTP ${res.status}`);
  return res.text();
}

/** Load a saved JSON fixture (the extracted sched-data). */
export async function loadSchedFixture(path: string): Promise<LfSchedData> {
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (!isLfSchedData(parsed)) throw new Error(`fixture ${path} has an unexpected shape`);
  return parsed;
}
