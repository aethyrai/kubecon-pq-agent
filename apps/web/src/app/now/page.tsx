import type { LogisticsItem, NextMoveResponse } from '@/lib/api';
import { dayLabel, formatTime, logistics, planNext, timeRange } from '@/lib/api';
import { parseMode } from '@/lib/mode';
import { headline, validNow } from '@/lib/now';
import { parseIds } from '@/lib/plan';
import { shortRoom } from '@/lib/ruler';
import { SessionCardView } from '../_components/session-card';

function LogisticsList({ items }: { items: LogisticsItem[] }) {
  return (
    <ul className="logistics">
      {items.map((l) => (
        <li key={l.id}>
          <strong>{l.title}</strong>, {timeRange(l)}, {shortRoom(l.room)}
        </li>
      ))}
    </ul>
  );
}

export default async function Page({ searchParams }: PageProps<'/now'>) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const ids = parseIds(sp.ids);
  const nowOverride = validNow(sp.now);
  const href = (path: string, picks: string[] = ids) => {
    const u = new URLSearchParams({ mode });
    if (picks.length > 0) u.set('ids', picks.join(','));
    if (nowOverride) u.set('now', nowOverride);
    return `${path}?${u.toString()}`;
  };

  const feed = await logistics().catch(() => undefined);
  const day = nowOverride?.slice(0, 10) ?? feed?.today;
  const todayItems = feed?.items.filter((l) => l.day === day) ?? [];
  const venueToday = todayItems.length > 0 && (
    <section aria-labelledby="venue-today">
      <h2 id="venue-today">Today at the venue</h2>
      <LogisticsList items={todayItems} />
    </section>
  );

  if (ids.length === 0) {
    return (
      <>
        <h1>Where to be now</h1>
        <p className="empty">
          Nothing picked yet. Open <a href={href('/schedule/2026-11-10')}>Tuesday</a> and add talks,
          or <a href={href('/')}>search for a topic</a>. Then this page tells you where to go next.
        </p>
        {venueToday}
      </>
    );
  }

  let m: NextMoveResponse;
  try {
    m = await planNext(ids, nowOverride);
  } catch (e) {
    return (
      <>
        <h1>Where to be now</h1>
        <p role="alert">Next move unavailable: {e instanceof Error ? e.message : 'api error'}</p>
        <p className="empty">
          Your picks are still in this page address. <a href={href('/now')}>Try again</a>, or open{' '}
          <a href={href('/plan')}>your plan</a>.
        </p>
      </>
    );
  }

  const h = headline(m, { time: formatTime, room: shortRoom, day: dayLabel });
  const remove = (id: string) =>
    href(
      '/now',
      ids.filter((x) => x !== id),
    );
  const nowDay = m.now.slice(0, 10);
  return (
    <>
      <h1>Where to be now</h1>
      <p className="lede">
        As of {formatTime(m.now)}, {dayLabel(nowDay)}. <a href={href('/now')}>Refresh</a>
      </p>
      <section aria-labelledby="move" className="next-move">
        <h2 id="move">{h.title}</h2>
        <p>{h.detail}</p>
      </section>
      {m.missing.length > 0 && (
        <p className="meta">
          {m.missing.length} pick{m.missing.length === 1 ? ' is' : 's are'} no longer in the program
          and {m.missing.length === 1 ? 'was' : 'were'} left out.
        </p>
      )}
      {m.during_gap.length > 0 && (
        <section aria-labelledby="gap-food">
          <h2 id="gap-food">During this time</h2>
          <LogisticsList items={m.during_gap} />
        </section>
      )}
      {m.free_minutes !== null && m.free_minutes > 0 && (
        <p>
          <a href={href(`/schedule/${nowDay}`)}>Find a talk for this time</a>
        </p>
      )}
      {m.current && (
        <section aria-labelledby="in-progress">
          <h2 id="in-progress">In progress</h2>
          <ul className="cards">
            <SessionCardView
              s={m.current.session}
              mode={mode}
              planHref={remove(m.current.session.id)}
              inPlan
            />
          </ul>
        </section>
      )}
      {m.next && (
        <section aria-labelledby="up-next">
          <h2 id="up-next">Up next</h2>
          <ul className="cards">
            <SessionCardView
              s={m.next.session}
              mode={mode}
              showDay={m.next.session.day !== nowDay}
              planHref={remove(m.next.session.id)}
              inPlan
            />
          </ul>
          <p className="meta">If you will miss it, remove it. This page moves to your next pick.</p>
        </section>
      )}
      <p>
        <a href={href('/plan')}>See my whole plan</a>
      </p>
      {venueToday}
    </>
  );
}
