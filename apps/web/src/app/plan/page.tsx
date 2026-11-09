import { planConflicts, timeRange } from '@/lib/api';
import { parseMode } from '@/lib/mode';
import { conflictedIds, parseIds } from '@/lib/plan';
import { SessionCardView } from '../_components/session-card';

export default async function Page({ searchParams }: PageProps<'/plan'>) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const ids = parseIds(sp.ids);
  if (ids.length === 0) {
    return (
      <>
        <h1>My plan</h1>
        <p>
          Nothing picked yet. Open a <a href={`/schedule/2026-11-10?mode=${mode}`}>day</a> and add
          talks.
        </p>
      </>
    );
  }
  let r: Awaited<ReturnType<typeof planConflicts>>;
  try {
    r = await planConflicts(ids.length > 1 ? ids : [...ids, ids[0] ?? '']);
  } catch (e) {
    return (
      <>
        <h1>My plan</h1>
        <p role="alert">Plan unavailable: {e instanceof Error ? e.message : 'api error'}</p>
      </>
    );
  }
  const bad = conflictedIds(r.conflicts);
  const byId = new Map(r.sessions.map((s) => [s.id, s]));
  return (
    <>
      <h1>My plan</h1>
      <output className="block">
        {r.sessions.length} talk{r.sessions.length === 1 ? '' : 's'}, {r.conflicts.length} conflict
        {r.conflicts.length === 1 ? '' : 's'}.
      </output>
      {r.conflicts.length > 0 && (
        <section aria-labelledby="conflicts">
          <h2 id="conflicts">Conflicts</h2>
          <ul>
            {r.conflicts.map((c) => (
              <li key={`${c.a}-${c.b}`}>
                “{byId.get(c.a)?.title}” and “{byId.get(c.b)?.title}” overlap by {c.overlapMinutes}{' '}
                minutes (
                {byId.get(c.a) ? timeRange(byId.get(c.a) as { start: string; end: string }) : ''}).
              </li>
            ))}
          </ul>
        </section>
      )}
      <h2>In time order</h2>
      <ul className="cards">
        {[...r.sessions]
          .sort((a, b) => a.start.localeCompare(b.start))
          .map((s) => (
            <SessionCardView
              key={s.id}
              s={s}
              mode={mode}
              conflicted={bad.has(s.id)}
              planHref={`/plan?mode=${mode}&ids=${ids.filter((x) => x !== s.id).join(',')}`}
              inPlan
            />
          ))}
      </ul>
    </>
  );
}
