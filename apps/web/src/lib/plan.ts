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
 * For each conflict pair, the pick to drop: the lower score, then the later start, then the
 * one added to the plan later. Chains (A-B, B-C) stay as separate pairs, so each suggestion
 * is independent. Returned in plan order, each id once.
 */
export function dropSuggestions(
  conflicts: Conflict[],
  sessions: readonly Ranked[],
  ids: readonly string[],
): Set<string> {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const order = (id: string) => {
    const i = ids.indexOf(id);
    return i === -1 ? Number.POSITIVE_INFINITY : i;
  };
  const loser = (a: string, b: string): string => {
    const sa = byId.get(a);
    const sb = byId.get(b);
    if (!sa) return a;
    if (!sb) return b;
    if (sa.score !== undefined && sb.score !== undefined && sa.score !== sb.score) {
      return sa.score < sb.score ? a : b;
    }
    if (sa.start !== sb.start) return sa.start > sb.start ? a : b;
    return order(a) >= order(b) ? a : b;
  };
  const out = new Set<string>();
  for (const c of conflicts) out.add(loser(c.a, c.b));
  return new Set([...out].sort((x, y) => order(x) - order(y)));
}
