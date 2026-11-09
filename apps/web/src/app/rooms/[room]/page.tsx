import { roomAccess } from '@/lib/api';
import { parseMode } from '@/lib/mode';

/**
 * Room accessibility panel. The route takes the room's display name as it appears on sessions;
 * the api resolves it by id when given digits, otherwise we show the venue-level facts.
 */
export default async function Page({ params, searchParams }: PageProps<'/rooms/[room]'>) {
  const { room } = await params;
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const name = decodeURIComponent(room);
  const byId = /^\d+$/.test(name) ? await roomAccess(name).catch(() => undefined) : undefined;
  const parts = name.split('|').map((p) => p.trim());
  const venue = byId?.room.venue ?? parts[0] ?? name;
  const level = byId?.room.level ?? parts.find((p) => /^level/i.test(p)) ?? '';
  // Only facts the api publishes for this room. The venue has not published per-room accessibility
  // data, so an unknown room gets the venue-wide pointers and says so.
  const facts = byId?.facts ?? [
    'Per-room accessibility details are not published for this room yet.',
    'Ask at any Info Desk or a volunteer for the step-free route, the nearest accessible restroom, and the quiet room.',
    'Live captioning is shown on the room screen for keynotes and breakout sessions.',
  ];
  return (
    <>
      <h1>{byId?.room.name ?? (parts.slice(level ? 2 : 1).join(' | ') || name)}</h1>
      <p className="lede">
        {venue}
        {level && <>, {level}</>}
      </p>
      <section aria-labelledby="access">
        <h2 id="access">Accessibility</h2>
        <ul className="facts">
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>
      <p className="actions">
        <a href={`/schedule/2026-11-10?mode=${mode}`}>Back to the schedule</a>
      </p>
    </>
  );
}
