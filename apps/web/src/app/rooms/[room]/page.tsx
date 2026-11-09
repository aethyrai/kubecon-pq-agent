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
  const facts = byId?.facts ?? [
    `Wheelchair route: ${venue === 'Salt Palace' ? 'all Salt Palace levels are step-free; elevators by the 200 South entrance and the Upper Mezzanine' : 'elevators at the main lobby; ask the hotel desk'}`,
    'Captioning: live captions on the room screen for keynotes and breakouts',
    'Hearing loop: not listed; ask the Info Desk for an assistive listening receiver',
    'Nearest quiet room: Salt Palace Level 2, Upper Mezzanine',
    'Nearest accessible restroom: every restroom block at the Salt Palace has an accessible stall; ask a volunteer for the closest',
  ];
  return (
    <>
      <h1>{byId?.room.name ?? (parts.slice(level ? 2 : 1).join(' | ') || name)}</h1>
      <p>
        {venue}
        {level && <> · {level}</>}
      </p>
      <section aria-labelledby="access">
        <h2 id="access">Accessibility</h2>
        <ul>
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>
      <p>
        <a href={`/schedule/2026-11-10?mode=${mode}`}>Back to the schedule</a>
      </p>
    </>
  );
}
