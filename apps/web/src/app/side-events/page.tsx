import { DAYS, dayLabel, sideEvents, timeRange } from '@/lib/api';
import { parseMode } from '@/lib/mode';

export default async function Page({ searchParams }: PageProps<'/side-events'>) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const day = typeof sp.day === 'string' ? sp.day : undefined;
  let list: Awaited<ReturnType<typeof sideEvents>>['events'] = [];
  let error = '';
  try {
    list = (await sideEvents(day)).events;
  } catch (e) {
    error = e instanceof Error ? e.message : 'unavailable';
  }
  return (
    <>
      <h1>Side events</h1>
      <p className="lede">Sponsor-hosted meetups and parties around the conference.</p>
      <nav className="days" aria-label="Days">
        <a href={`/side-events?mode=${mode}`} aria-current={!day ? 'page' : undefined}>
          All
        </a>
        {[{ day: '2026-11-08', label: 'Sunday' }, ...DAYS].map((d) => (
          <a
            key={d.day}
            href={`/side-events?mode=${mode}&day=${d.day}`}
            aria-current={d.day === day ? 'page' : undefined}
          >
            {d.label}
          </a>
        ))}
      </nav>
      {error && (
        <>
          <p role="alert">Side events unavailable: {error}</p>
          <p className="empty">The api did not answer. Try again in a moment.</p>
        </>
      )}
      {!error && list.length === 0 && (
        <p className="empty">
          No side events listed{day ? ` for ${dayLabel(day)}` : ''}.{' '}
          {day && <a href={`/side-events?mode=${mode}`}>Show every day</a>}
        </p>
      )}
      {list.length > 0 && (
        <ul className="cards">
          {list.map((e) => (
            <li key={e.id}>
              <div className="lead">
                <span>{dayLabel(e.start.slice(0, 10))}</span>
                <time dateTime={e.start}>{timeRange(e)}</time>
              </div>
              <div className="body">
                <h3>
                  {e.rsvp_url ? (
                    <a href={e.rsvp_url} rel="noopener">
                      {e.name}
                    </a>
                  ) : (
                    e.name
                  )}
                </h3>
                {e.host && <p className="meta">Hosted by {e.host}</p>}
                {e.address && <p className="meta">{e.address}</p>}
                <p className="meta">
                  {e.badge_required ? 'KubeCon badge required' : 'Separate registration'}
                  {e.capacity_note && <>. {e.capacity_note}</>}
                </p>
                {mode !== 'text' && e.description && (
                  <p className="meta">
                    {e.description.slice(0, 240)}
                    {e.description.length > 240 ? '…' : ''}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
