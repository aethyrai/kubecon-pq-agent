import { DAYS, dayLabel, formatTime, planConflicts, schedule } from '@/lib/api';
import { parseMode } from '@/lib/mode';
import { conflictedIds, parseIds, toggleId } from '@/lib/plan';
import { maxConcurrency } from '@/lib/ruler';
import { Ruler } from '../../_components/ruler';
import { SessionCardView } from '../../_components/session-card';

/** Above this many talks at once in one venue, the ruler shows only your picks. */
const RULER_MAX_CONCURRENT = 4;

export default async function Page({ params, searchParams }: PageProps<'/schedule/[day]'>) {
  const { day } = await params;
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const ids = parseIds(sp.ids);
  const track = typeof sp.track === 'string' ? sp.track : undefined;
  const event = typeof sp.event === 'string' ? sp.event : undefined;
  const captioned = sp.captioned === 'true' ? 'true' : undefined;
  const label = dayLabel(day);
  let sessions: Awaited<ReturnType<typeof schedule>>['sessions'] = [];
  let error = '';
  try {
    sessions = (await schedule(day, { track, event, captioned })).sessions;
  } catch (e) {
    error = e instanceof Error ? e.message : 'schedule unavailable';
  }
  const conflicts =
    ids.length > 1 ? (await planConflicts(ids).catch(() => ({ conflicts: [] }))).conflicts : [];
  const conflicted = conflictedIds(conflicts);
  const picked = new Set(ids);
  const keep = `${track ? `&track=${encodeURIComponent(track)}` : ''}${event ? `&event=${encodeURIComponent(event)}` : ''}${captioned ? '&captioned=true' : ''}`;
  const href = (id: string) => `/schedule/${day}?mode=${mode}&ids=${toggleId(ids, id)}${keep}`;
  const tracks = [...new Set(sessions.map((s) => s.track).filter(Boolean))].sort();
  const events = [...new Set(sessions.map((s) => s.colocated_event).filter(Boolean))].sort();
  const rulerSessions =
    maxConcurrency(sessions) <= RULER_MAX_CONCURRENT
      ? sessions
      : sessions.filter((s) => picked.has(s.id));
  const groups = new Map<string, typeof sessions>();
  for (const s of sessions) groups.set(s.start, [...(groups.get(s.start) ?? []), s]);
  const filtered = Boolean(track || event || captioned);
  return (
    <>
      <h1>{label} schedule</h1>
      <nav className="days" aria-label="Days">
        {DAYS.map((d) => (
          <a
            key={d.day}
            href={`/schedule/${d.day}?mode=${mode}${ids.length ? `&ids=${ids.join(',')}` : ''}`}
            aria-current={d.day === day ? 'page' : undefined}
          >
            {d.label}
          </a>
        ))}
      </nav>
      <div className="page with-rail">
        <aside className="rail" aria-label="Your plan and filters">
          <output className="block">
            {ids.length === 0 ? (
              <span className="muted">Nothing in your plan yet.</span>
            ) : (
              <>
                {ids.length} in your plan
                {conflicts.length > 0 && (
                  <span className="warn-text">
                    , {conflicts.length} conflict{conflicts.length === 1 ? '' : 's'}
                  </span>
                )}
                .<a href={`/plan?mode=${mode}&ids=${ids.join(',')}`}>Review plan</a>
              </>
            )}
          </output>
          <form action={`/schedule/${day}`} method="get" aria-label="Filter the day">
            <input type="hidden" name="mode" value={mode} />
            <input type="hidden" name="ids" value={ids.join(',')} />
            <div className="field">
              <label htmlFor="track">Track</label>
              <select id="track" name="track" defaultValue={track ?? ''}>
                <option value="">All tracks</option>
                {tracks.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            {events.length > 0 && (
              <div className="field">
                <label htmlFor="event">Co-located event</label>
                <select id="event" name="event" defaultValue={event ?? ''}>
                  <option value="">All events</option>
                  {events.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <label className="inline">
              <input
                type="checkbox"
                name="captioned"
                value="true"
                defaultChecked={captioned === 'true'}
              />
              Captioned only
            </label>
            <button type="submit">Apply filters</button>
            {filtered && (
              <p className="meta">
                <a href={`/schedule/${day}?mode=${mode}&ids=${ids.join(',')}`}>Clear filters</a>
              </p>
            )}
          </form>
        </aside>
        <div>
          {error && (
            <>
              <p role="alert">Schedule unavailable: {error}</p>
              <p className="empty">
                The api did not answer. Try again in a moment, or open the official program at
                events.linuxfoundation.org.
              </p>
            </>
          )}
          {!error && sessions.length === 0 && (
            <p className="empty">
              No sessions match these filters on {label}.{' '}
              <a href={`/schedule/${day}?mode=${mode}&ids=${ids.join(',')}`}>Show the whole day</a>.
            </p>
          )}
          {mode === 'full' && rulerSessions.length > 0 && (
            <Ruler
              sessions={rulerSessions}
              label={`${label} at a glance`}
              picked={picked}
              conflicted={conflicted}
            />
          )}
          {mode === 'full' && sessions.length > 0 && rulerSessions.length === 0 && (
            <p className="ruler-hint">
              Add a talk, or pick a track, to lay the day out on the ruler.
            </p>
          )}
          {[...groups.entries()].map(([start, list]) => (
            <section key={start} className="slot" aria-labelledby={`t-${start}`}>
              <h2 id={`t-${start}`} className="slot-time">
                <time dateTime={start}>{formatTime(start)}</time>
              </h2>
              <ul className="cards">
                {list.map((s) => (
                  <SessionCardView
                    key={s.id}
                    s={s}
                    mode={mode}
                    planHref={href(s.id)}
                    inPlan={picked.has(s.id)}
                    conflicted={conflicted.has(s.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
