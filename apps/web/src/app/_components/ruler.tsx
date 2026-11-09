import type { SessionCard } from '@/lib/api';
import { formatTime, timeRange } from '@/lib/api';
import { dayFrame, hourMarks, rowSpan, shortRoom, UNKNOWN_VENUE, venuesOf } from '@/lib/ruler';

/**
 * The day at a glance. Hours run down the left, one column per venue, and each session sits
 * at its true start and length. Two talks that overlap in one venue render side by side, so
 * the layout itself shows the conflict. Each block links to its entry in the list below.
 */
export function Ruler({
  sessions,
  label,
  picked,
  conflicted,
}: {
  sessions: SessionCard[];
  label: string;
  picked: ReadonlySet<string>;
  conflicted: ReadonlySet<string>;
}) {
  const frame = dayFrame(sessions);
  if (!frame) return null;
  const venues = venuesOf(sessions);
  const rows = `repeat(${frame.rows}, var(--slot))`;
  const columns = `3.5rem repeat(${venues.length}, minmax(0, 1fr))`;
  return (
    <section className="ruler" aria-label={label}>
      <div className="ruler-head" style={{ gridTemplateColumns: columns }}>
        <span aria-hidden="true" />
        {venues.map((v) => (
          <span key={v} className="venue">
            {v}
          </span>
        ))}
      </div>
      <div className="ruler-body" style={{ gridTemplateColumns: columns }}>
        <div className="ruler-hours" style={{ gridTemplateRows: rows }} aria-hidden="true">
          {hourMarks(frame).map((m) => (
            <span key={m.row} style={{ gridRow: m.row }}>
              {m.label}
            </span>
          ))}
        </div>
        {venues.map((v) => (
          <div key={v} className="ruler-venue" style={{ gridTemplateRows: rows }}>
            {sessions
              .filter((s) => (s.venue || UNKNOWN_VENUE) === v)
              .map((s) => {
                const span = rowSpan(s, frame);
                const cls = [
                  'talk',
                  span.end - span.start <= 3 ? 'short' : '',
                  picked.has(s.id) ? 'picked' : '',
                  conflicted.has(s.id) ? 'conflict' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <a
                    key={s.id}
                    className={cls}
                    href={`#s-${s.id}`}
                    style={{ gridRow: `${span.start} / ${span.end}` }}
                    aria-label={`${s.title}, ${timeRange(s)}, ${shortRoom(s.room)}${conflicted.has(s.id) ? ', conflicts with another pick' : ''}`}
                  >
                    <span className="t">{formatTime(s.start)}</span>
                    <span className="title">{s.title}</span>
                    <span className="room">{shortRoom(s.room)}</span>
                  </a>
                );
              })}
          </div>
        ))}
      </div>
    </section>
  );
}
