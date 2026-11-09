import { DAYS, planConflicts, schedule } from '@/lib/api';
import { parseMode } from '@/lib/mode';
import { conflictedIds, parseIds, toggleId } from '@/lib/plan';
import { SessionCardView } from '../../_components/session-card';

export default async function Page({ params, searchParams }: PageProps<'/schedule/[day]'>) {
  const { day } = await params;
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const ids = parseIds(sp.ids);
  const track = typeof sp.track === 'string' ? sp.track : undefined;
  const event = typeof sp.event === 'string' ? sp.event : undefined;
  const captioned = sp.captioned === 'true' ? 'true' : undefined;
  const label = DAYS.find((d) => d.day === day)?.label ?? day;
  let sessions: Awaited<ReturnType<typeof schedule>>['sessions'] = [];
  let error = '';
  try {
    sessions = (await schedule(day, { track, event, captioned })).sessions;
  } catch (e) {
    error = e instanceof Error ? e.message : 'schedule unavailable';
  }
  const conflicted =
    ids.length > 1
      ? conflictedIds((await planConflicts(ids).catch(() => ({ conflicts: [] }))).conflicts)
      : new Set<string>();
  const href = (id: string) =>
    `/schedule/${day}?mode=${mode}&ids=${toggleId(ids, id)}${track ? `&track=${encodeURIComponent(track)}` : ''}${event ? `&event=${encodeURIComponent(event)}` : ''}${captioned ? '&captioned=true' : ''}`;
  const tracks = [...new Set(sessions.map((s) => s.track).filter(Boolean))].sort();
  return (
    <>
      <h1>
        {label} schedule <span className="muted">({day})</span>
      </h1>
      <nav aria-label="Days">
        {DAYS.map((d) => (
          <a
            key={d.day}
            href={`/schedule/${d.day}?mode=${mode}`}
            aria-current={d.day === day ? 'page' : undefined}
          >
            {d.label}
          </a>
        ))}
      </nav>
      <form action={`/schedule/${day}`} method="get" aria-label="Filter the day">
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="ids" value={ids.join(',')} />
        {event && <input type="hidden" name="event" value={event} />}
        <label htmlFor="track">Track</label>
        <select id="track" name="track" defaultValue={track ?? ''}>
          <option value="">All tracks</option>
          {tracks.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            name="captioned"
            value="true"
            defaultChecked={captioned === 'true'}
          />{' '}
          Captioned only
        </label>
        <button type="submit">Filter</button>
      </form>
      {ids.length > 0 && (
        <output className="block">
          {ids.length} in your plan{conflicted.size > 0 ? `, ${conflicted.size} conflict` : ''}.{' '}
          <a href={`/plan?mode=${mode}&ids=${ids.join(',')}`}>Review plan</a>
        </output>
      )}
      {error && <p role="alert">Schedule unavailable: {error}</p>}
      <ul className="cards">
        {sessions.map((s) => (
          <SessionCardView
            key={s.id}
            s={s}
            mode={mode}
            planHref={href(s.id)}
            inPlan={ids.includes(s.id)}
            conflicted={conflicted.has(s.id)}
          />
        ))}
      </ul>
    </>
  );
}
