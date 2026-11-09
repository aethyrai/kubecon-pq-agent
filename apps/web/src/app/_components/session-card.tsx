import type { SessionCard as Card } from '@/lib/api';
import { dayLabel, formatTime, roomSlug, timeRange } from '@/lib/api';
import type { Mode } from '@/lib/mode';
import { splitRoom } from '@/lib/ruler';

export function SessionCardView({
  s,
  mode,
  planHref,
  inPlan,
  conflicted,
  showDay,
  explainSemantic,
}: {
  s: Card;
  mode: Mode;
  planHref?: string;
  inPlan?: boolean;
  conflicted?: boolean;
  /** Name the day in the time column. Used when a list spans days. */
  showDay?: boolean;
  /** Add the one-line explanation under the semantic badge. Used for the first hit on a page. */
  explainSemantic?: boolean;
}) {
  const semanticOnly = s.legs?.length === 1 && s.legs[0] === 'knn';
  const room = splitRoom(s.room);
  const where = [room.venue, room.level].filter(Boolean).join(', ');
  const cls = [inPlan ? 'picked' : '', conflicted ? 'conflict' : ''].filter(Boolean).join(' ');
  return (
    <li id={`s-${s.id}`} className={cls || undefined}>
      <div className="lead">
        {showDay && <span>{dayLabel(s.day)}</span>}
        <time dateTime={s.start}>{formatTime(s.start)}</time>
        to {formatTime(s.end)}
      </div>
      <div className="body">
        <h3>
          <a href={s.url} rel="noopener">
            {s.title}
          </a>
          {mode === 'reader' && (
            <span className="muted">
              . {timeRange(s)}, {room.name || s.room}
            </span>
          )}
        </h3>
        <p className="meta">
          <a className="room" href={`/rooms/${roomSlug(s.room)}?mode=${mode}`}>
            <strong>{room.name || s.room}</strong>
            {where && <small>{where}</small>}
          </a>
        </p>
        {mode !== 'text' && (
          <>
            {s.speakers.length > 0 && <p className="meta">{s.speakers.join(', ')}</p>}
            <p className="badges">
              {s.track && <span className="badge">{s.track}</span>}
              {s.colocated_event && <span className="badge">{s.colocated_event}</span>}
              {s.captioned && <span className="badge">Captioned</span>}
              {semanticOnly && <span className="badge semantic">Semantic match</span>}
              {conflicted && <output className="badge warn">Conflicts with another pick</output>}
            </p>
            {semanticOnly && explainSemantic && (
              <p className="meta explain">
                Found by meaning, not by keywords. The vector index runs inside the cluster.
              </p>
            )}
          </>
        )}
        {mode === 'text' && conflicted && (
          <output className="block">Conflicts with another pick.</output>
        )}
        {planHref && (
          <p className="actions">
            <a href={planHref}>
              {inPlan ? 'Remove' : 'Add'} <span className="sr-only">{s.title}</span>{' '}
              {inPlan ? 'from' : 'to'} my plan
            </a>
          </p>
        )}
      </div>
    </li>
  );
}
