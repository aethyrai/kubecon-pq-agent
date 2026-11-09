import type { LogisticsDoc, RoomDoc, SessionDoc, SpeakerDoc } from './documents.js';
import type { LfSchedData, LfSession } from './sources/lf-sched.js';

const CATEGORY_TRACK = 'All Sessions';
const CATEGORY_LEVEL = 'Audience Level';
const CATEGORY_SUBTOPIC = 'SubTopic';
const CATEGORY_PROJECTS = 'CNCF Projects';
const QUESTION_COMPANY = 'Company';
const QUESTION_COMPANY_OVERRIDE = 'Company Override';
const MAIN_TRACKS = new Set([
  'AI Inference + Agentic',
  'Application Development + Delivery',
  'Cloud Native Experience',
  'Cloud Native Novice',
  'Connectivity',
  'Data Processing + Storage',
  'Emerging + Advanced',
  'Observability',
  'Operations + Performance',
  'Platform Engineering',
  'Security',
]);
const SESSION_URL =
  'https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/program/schedule/?id=';

/** Strip HTML tags and collapse whitespace. */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&#8211;', '-')
    .replaceAll('&#8217;', "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** "Salt Palace | Level 1 | Grand Ballroom BDF" -> venue, level, name. */
export function parseRoomName(full: string): { venue: string; level: string; name: string } {
  const parts = full
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);
  const venue = parts[0] ?? full.trim();
  const levelPart = parts.find((p) => /^level\s+\d/i.test(p));
  const level = levelPart ?? '';
  const rest = parts.slice(1).filter((p) => p !== levelPart);
  const name = rest.length > 0 ? rest.join(' | ') : venue;
  return { venue, level, name };
}

interface Lookup {
  itemName: Map<number, string>;
  itemCategory: Map<number, string>;
  roomName: Map<number, string>;
  speakerName: Map<string, string>;
  questionId: Map<string, number>;
}

function buildLookup(data: LfSchedData): Lookup {
  const itemName = new Map<number, string>();
  const itemCategory = new Map<number, string>();
  for (const c of data.all.categories) {
    for (const it of c.items) {
      itemName.set(it.id, it.name);
      itemCategory.set(it.id, c.title);
    }
  }
  return {
    itemName,
    itemCategory,
    roomName: new Map(data.all.rooms.map((r) => [r.id, r.name])),
    speakerName: new Map(data.all.speakers.map((s) => [s.id, s.fullName])),
    questionId: new Map(data.all.questions.map((q) => [q.question, q.id])),
  };
}

function itemsOf(session: LfSession, lk: Lookup, category: string): string[] {
  return session.categoryItems
    .filter((id) => lk.itemCategory.get(id) === category)
    .map((id) => lk.itemName.get(id))
    .filter((n): n is string => typeof n === 'string');
}

const SERVICE_TITLE =
  /\b(registration|badge pick-up|coffee break|lunch|break|doors open|solutions showcase (?:open|hours)|shuttle|quiet room|wellness)\b/i;

/** A real talk: has a title, is not a service session, and is not a logistics entry such as registration. */
export function isTalk(session: LfSession): boolean {
  if (session.isServiceSession || session.title.trim().length === 0) return false;
  if (session.speakers.length > 0) return true;
  return !SERVICE_TITLE.test(session.title);
}

function logisticsKind(title: string): LogisticsDoc['kind'] | undefined {
  if (/^registration \+ badge/i.test(title)) return 'registration';
  if (/^coffee break/i.test(title)) return 'coffee';
  if (/^lunch\b/i.test(title)) return 'lunch';
  return undefined;
}

/** The registration, coffee, and lunch rows that normalizeSessions leaves out. */
export function normalizeLogistics(data: LfSchedData): LogisticsDoc[] {
  const lk = buildLookup(data);
  return data.all.sessions.flatMap((s) => {
    const title = s.title.replace(/^[^\p{L}\p{N}]+/u, '').trim();
    const kind = logisticsKind(title);
    if (!kind || isTalk(s)) return [];
    const room = s.roomId === null ? '' : (lk.roomName.get(s.roomId) ?? '');
    return [
      {
        id: s.id,
        kind,
        title,
        day: s.startsAt.slice(0, 10),
        start: s.startsAt,
        end: s.endsAt,
        room,
        venue: room ? parseRoomName(room).venue : '',
      },
    ];
  });
}

export function normalizeSessions(data: LfSchedData): SessionDoc[] {
  const lk = buildLookup(data);
  return data.all.sessions.filter(isTalk).map((s) => {
    const tracks = itemsOf(s, lk, CATEGORY_TRACK);
    const subtopics = itemsOf(s, lk, CATEGORY_SUBTOPIC);
    const projects = itemsOf(s, lk, CATEGORY_PROJECTS);
    const levels = itemsOf(s, lk, CATEGORY_LEVEL);
    const roomFull = s.roomId === null ? '' : (lk.roomName.get(s.roomId) ?? '');
    const room = roomFull ? parseRoomName(roomFull) : { venue: '', level: '', name: '' };
    const colocated = subtopics.find((t) => !MAIN_TRACKS.has(t)) ?? '';
    const tags = Array.from(new Set([...tracks, ...subtopics, ...projects].filter(Boolean)));
    return {
      id: s.id,
      title: s.title.trim(),
      abstract: stripHtml(s.description ?? ''),
      speakers: s.speakers.map((id) => lk.speakerName.get(id)).filter((n): n is string => !!n),
      track: tracks[0] ?? subtopics[0] ?? '',
      level: levels[0] ?? 'Any Level',
      day: s.startsAt.slice(0, 10),
      start: s.startsAt,
      end: s.endsAt,
      room: roomFull,
      venue: room.venue,
      colocated_event: colocated,
      tags,
      // The public schedule does not publish captioning per session; KubeCon keynotes and
      // breakouts are live-captioned by the event. Leave false until the rooms source says so.
      captioned: false,
      recorded: s.recordingUrl !== null,
      url: `${SESSION_URL}${s.id}`,
    };
  });
}

export function normalizeSpeakers(data: LfSchedData): SpeakerDoc[] {
  const lk = buildLookup(data);
  const companyQ = lk.questionId.get(QUESTION_COMPANY);
  const overrideQ = lk.questionId.get(QUESTION_COMPANY_OVERRIDE);
  const sessionById = new Map(data.all.sessions.map((s) => [s.id, s]));
  return data.all.speakers.map((sp) => {
    const answer = (qid: number | undefined): string =>
      qid === undefined
        ? ''
        : (sp.questionAnswers.find((a) => a.questionId === qid)?.answerValue ?? '');
    const org =
      answer(overrideQ) || answer(companyQ) || (sp.tagLine ?? '').split(',')[0]?.trim() || '';
    const sessionIds = sp.sessions.map(String).filter((id) => sessionById.has(id));
    const topics = Array.from(
      new Set(
        sessionIds.flatMap((id) => {
          const s = sessionById.get(id);
          return s ? itemsOf(s, lk, CATEGORY_TRACK) : [];
        }),
      ),
    );
    return {
      id: sp.id,
      name: sp.fullName,
      org,
      bio: stripHtml(sp.bio ?? ''),
      session_ids: sessionIds,
      topics,
    };
  });
}

export function normalizeRooms(data: LfSchedData): RoomDoc[] {
  return data.all.rooms.map((r) => {
    const p = parseRoomName(r.name);
    return {
      id: String(r.id),
      venue: p.venue,
      level: p.level,
      name: p.name,
      // Accessibility facts come from the venue accessibility source; empty until merged.
      wheelchair_route: '',
      captioning: '',
      hearing_loop: false,
      quiet_room_nearby: '',
      nearest_accessible_restroom: '',
    };
  });
}

/** Text that gets embedded for a session: title + abstract + track. */
export function sessionEmbeddingText(s: SessionDoc): string {
  return [s.title, s.abstract, s.track].filter(Boolean).join('\n');
}
export function speakerEmbeddingText(s: SpeakerDoc): string {
  return [s.bio, s.topics.join(', ')].filter(Boolean).join('\n');
}
