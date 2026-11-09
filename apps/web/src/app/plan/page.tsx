import { dayLabel, formatTime, planConflicts, timeRange } from '@/lib/api';
import { parseMode } from '@/lib/mode';
import { conflictedIds, dropFor, parseIds } from '@/lib/plan';
import { shortRoom } from '@/lib/ruler';
import { Ruler } from '../_components/ruler';
import { SessionCardView } from '../_components/session-card';

export default async function Page({ searchParams }: PageProps<'/plan'>) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const ids = parseIds(sp.ids);
  if (ids.length === 0) {
    return (
      <>
        <h1>My plan</h1>
        <p className="empty">
          Nothing picked yet. Open <a href={`/schedule/2026-11-10?mode=${mode}`}>Tuesday</a> and add
          talks, or <a href={`/?mode=${mode}`}>search for a topic</a>. Your picks travel in the page
          address, so you can bookmark or share the plan.
        </p>
      </>
    );
  }
  let r: Awaited<ReturnType<typeof planConflicts>>;
  try {
    r = await planConflicts(ids);
  } catch (e) {
    return (
      <>
        <h1>My plan</h1>
        <p role="alert">Plan unavailable: {e instanceof Error ? e.message : 'api error'}</p>
        <p className="empty">
          Your picks are still in this page address. Reload in a moment, or go back to the{' '}
          <a href={`/schedule/2026-11-10?mode=${mode}&ids=${ids.join(',')}`}>schedule</a>.
        </p>
      </>
    );
  }
  const bad = conflictedIds(r.conflicts);
  const picked = new Set(ids);
  const byId = new Map(r.sessions.map((s) => [s.id, s]));
  const sorted = [...r.sessions].sort((a, b) => a.start.localeCompare(b.start));
  const days = [...new Set(sorted.map((s) => s.day))].sort();
  const without = (id: string) => `/plan?mode=${mode}&ids=${ids.filter((x) => x !== id).join(',')}`;
  const name = (id: string) => byId.get(id)?.title ?? `session ${id}`;
  const tight = r.tight ?? [];
  const minutes = (n: number) => `${n} minute${n === 1 ? '' : 's'}`;
  return (
    <>
      <h1>My plan</h1>
      <output className="block lede">
        {r.sessions.length} talk{r.sessions.length === 1 ? '' : 's'}
        {days.length > 1 ? ` over ${days.length} days` : ''}, {r.conflicts.length} conflict
        {r.conflicts.length === 1 ? '' : 's'}.
      </output>
      <p>
        <a href={`/now?mode=${mode}&ids=${ids.join(',')}`}>Where to be now</a>
      </p>
      {r.missing.length > 0 && (
        <p className="meta">
          {r.missing.length} pick{r.missing.length === 1 ? ' is' : 's are'} no longer in the program
          and {r.missing.length === 1 ? 'was' : 'were'} left out.
        </p>
      )}
      {r.conflicts.length > 0 && (
        <section aria-labelledby="conflicts" className="conflicts">
          <h2 id="conflicts">Conflicts</h2>
          <ul>
            {r.conflicts.map((c) => {
              const drop = dropFor(c, r.sessions, ids);
              return (
                <li key={`${c.a}-${c.b}`}>
                  “{name(c.a)}” and “{name(c.b)}” overlap by {c.overlapMinutes} minute
                  {c.overlapMinutes === 1 ? '' : 's'}
                  {byId.get(c.a) ? ` (${timeRange(byId.get(c.a) ?? { start: '', end: '' })})` : ''}.{' '}
                  {mode === 'text' ? (
                    <>
                      Drop “{name(drop)}” to resolve it:{' '}
                      <a href={without(drop)}>remove it from the plan</a>.
                    </>
                  ) : (
                    <a className="drop" href={without(drop)}>
                      Drop <span className="sr-only">“{name(drop)}”</span>
                      <span aria-hidden="true">“{name(drop)}”</span>
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {tight.length > 0 && (
        <section aria-labelledby="tight" className="conflicts">
          <h2 id="tight">Tight connections</h2>
          <ul>
            {tight.map((t) => (
              <li key={`${t.from}-${t.to}`}>
                “{name(t.from)}” to “{name(t.to)}” leaves {minutes(t.gapMinutes)}. The walk is about{' '}
                {minutes(t.walkMinutes)} (estimate), so expect to arrive about{' '}
                {minutes(t.shortByMinutes)} late.
              </li>
            ))}
          </ul>
        </section>
      )}
      {mode === 'full' &&
        days.map((d) => (
          <Ruler
            key={d}
            sessions={sorted.filter((s) => s.day === d)}
            label={`${dayLabel(d)} at a glance`}
            picked={picked}
            conflicted={bad}
          />
        ))}
      {mode === 'text' && (
        <section aria-labelledby="as-text">
          <h2 id="as-text">Plan as text</h2>
          <pre className="plan-text">
            {sorted
              .map(
                (s) =>
                  `${dayLabel(s.day).slice(0, 3)} ${formatTime(s.start)} to ${formatTime(s.end)}  ${s.title}  ${shortRoom(s.room)}`,
              )
              .join('\n')}
          </pre>
        </section>
      )}
      <h2>In time order</h2>
      <ul className="cards">
        {sorted.map((s) => (
          <SessionCardView
            key={s.id}
            s={s}
            mode={mode}
            showDay={days.length > 1}
            conflicted={bad.has(s.id)}
            planHref={without(s.id)}
            inPlan
          />
        ))}
      </ul>
    </>
  );
}
