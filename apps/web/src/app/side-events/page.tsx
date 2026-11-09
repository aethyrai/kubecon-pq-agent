import { DAYS, sideEvents, timeRange } from '@/lib/api';
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
      <nav aria-label="Days">
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
      {error && <p role="alert">Side events unavailable: {error}</p>}
      <ul className="cards">
        {list.map((e) => (
          <li key={e.id}>
            <h3>
              {e.rsvp_url ? (
                <a href={e.rsvp_url} rel="noopener">
                  {e.name}
                </a>
              ) : (
                e.name
              )}
            </h3>
            <p>
              <time dateTime={e.start}>
                {e.start.slice(0, 10)} {timeRange(e)}
              </time>
              {e.host && <> · hosted by {e.host}</>}
              {e.address && <> · {e.address}</>}
            </p>
            <p>
              {e.badge_required ? 'KubeCon badge required' : 'Separate registration'}
              {e.capacity_note && <> · {e.capacity_note}</>}
            </p>
            {mode !== 'text' && e.description && (
              <p>
                {e.description.slice(0, 240)}
                {e.description.length > 240 ? '…' : ''}
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
