'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { MODES, type Mode, parseMode } from '@/lib/mode';
import { parseIds } from '@/lib/plan';

const MODE_LABEL: Record<Mode, string> = { full: 'Full', text: 'Text', reader: 'Screen reader' };

/**
 * Primary nav and the view-mode switch. Reads the current URL so every link keeps the
 * mode and the plan picks, and the mode switch keeps the page you are on. Rendered on the
 * server too, so the links work before any script runs.
 */
export function SiteNav() {
  const path = usePathname();
  const sp = useSearchParams();
  const mode = parseMode(sp.get('mode') ?? undefined);
  const ids = parseIds(sp.get('ids') ?? undefined);
  const to = (href: string) => {
    const u = new URLSearchParams({ mode });
    if (ids.length > 0) u.set('ids', ids.join(','));
    return `${href}?${u.toString()}`;
  };
  const modeHref = (m: Mode) => {
    const u = new URLSearchParams(sp.toString());
    u.set('mode', m);
    return `${path}?${u.toString()}`;
  };
  return (
    <>
      <nav aria-label="Primary">
        <a href={to('/now')}>Now</a>
        <a href={to('/')}>Search</a>
        <a href={to('/schedule/2026-11-10')}>Schedule</a>
        <a href={to('/plan')}>
          My plan
          {ids.length > 0 && (
            <span className="count">
              {ids.length}
              <span className="sr-only"> {ids.length === 1 ? 'pick' : 'picks'}</span>
            </span>
          )}
        </a>
        <a className="wide" href={to('/booths')}>
          Booths
        </a>
        <a className="wide" href={to('/side-events')}>
          Side events
        </a>
        <details className="more">
          <summary>More</summary>
          <a href={to('/booths')}>Booths</a>
          <a href={to('/side-events')}>Side events</a>
        </details>
      </nav>
      <nav className="modes" aria-label="View mode">
        {MODES.map((m) => (
          <a key={m} href={modeHref(m)} aria-current={m === mode ? 'page' : undefined}>
            {MODE_LABEL[m]}
          </a>
        ))}
      </nav>
    </>
  );
}
