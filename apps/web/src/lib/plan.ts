import type { Conflict } from './api';

/** ids from ?ids=a,b,c, de-duplicated and trimmed. */
export function parseIds(v: string | string[] | undefined): string[] {
  const s = Array.isArray(v) ? v.join(',') : (v ?? '');
  return [
    ...new Set(
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ];
}

/** Session ids that take part in at least one conflict. */
export function conflictedIds(conflicts: Conflict[]): Set<string> {
  const out = new Set<string>();
  for (const c of conflicts) {
    out.add(c.a);
    out.add(c.b);
  }
  return out;
}

/** Toggle an id in the plan and return the new ?ids value. */
export function toggleId(ids: string[], id: string): string {
  return (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]).join(',');
}

export interface Ranked {
  id: string;
  start: string;
  score?: number;
}

/**
 * The pick to drop for one conflict pair: the lower score, then the later start, then the
 * one added to the plan later. An id the plan does not know is dropped first.
 */
export function dropFor(c: Conflict, sessions: readonly Ranked[], ids: readonly string[]): string {
  const sa = sessions.find((s) => s.id === c.a);
  const sb = sessions.find((s) => s.id === c.b);
  if (!sa) return c.a;
  if (!sb) return c.b;
  if (sa.score !== undefined && sb.score !== undefined && sa.score !== sb.score) {
    return sa.score < sb.score ? c.a : c.b;
  }
  if (sa.start !== sb.start) return sa.start > sb.start ? c.a : c.b;
  const order = (id: string) => {
    const i = ids.indexOf(id);
    return i === -1 ? Number.POSITIVE_INFINITY : i;
  };
  return order(c.a) >= order(c.b) ? c.a : c.b;
}

/**
 * Every pick that some pair would drop, in plan order, each id once. Chains (A-B, B-C) stay
 * as separate pairs, so the suggestions are independent of each other.
 */
export function dropSuggestions(
  conflicts: Conflict[],
  sessions: readonly Ranked[],
  ids: readonly string[],
): Set<string> {
  const order = (id: string) => {
    const i = ids.indexOf(id);
    return i === -1 ? Number.POSITIVE_INFINITY : i;
  };
  const out = new Set(conflicts.map((c) => dropFor(c, sessions, ids)));
  return new Set([...out].sort((x, y) => order(x) - order(y)));
}
