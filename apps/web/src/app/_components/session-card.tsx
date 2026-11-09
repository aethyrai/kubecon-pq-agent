import type { SessionCard as Card } from '@/lib/api';
import { roomSlug, timeRange } from '@/lib/api';
import type { Mode } from '@/lib/mode';

export function SessionCardView({
  s,
  mode,
  planHref,
  inPlan,
  conflicted,
}: {
  s: Card;
  mode: Mode;
  planHref?: string;
  inPlan?: boolean;
  conflicted?: boolean;
}) {
  const semanticOnly = s.legs?.length === 1 && s.legs[0] === 'knn';
  return (
    <li
      className={conflicted ? 'conflict' : undefined}
      aria-label={`${s.title}, ${timeRange(s)}, ${s.room}`}
    >
      <h3>
        <a href={s.url} rel="noopener">
          {s.title}
        </a>
      </h3>
      <p>
        <time dateTime={s.start}>{timeRange(s)}</time> ·{' '}
        <a href={`/rooms/${roomSlug(s.room)}?mode=${mode}`}>{s.room}</a>
      </p>
      {mode !== 'text' && (
        <p>
          {s.speakers.length > 0 && <span>{s.speakers.join(', ')}</span>}
          {s.captioned && <span className="badge">Captioned</span>}
          {s.track && <span className="badge">{s.track}</span>}
          {s.colocated_event && <span className="badge">{s.colocated_event}</span>}
          {semanticOnly && <span className="badge">Semantic match</span>}
          {conflicted && <output className="badge warn">Conflicts with another pick</output>}
        </p>
      )}
      {mode === 'text' && conflicted && (
        <output className="block">Conflicts with another pick.</output>
      )}
      {planHref && (
        <p>
          <a
            href={planHref}
            aria-label={`${inPlan ? 'Remove' : 'Add'} ${s.title} ${inPlan ? 'from' : 'to'} my plan`}
          >
            {inPlan ? 'Remove from plan' : 'Add to plan'}
          </a>
        </p>
      )}
    </li>
  );
}
