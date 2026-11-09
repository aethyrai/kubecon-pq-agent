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
