import { type SearchResponse, search } from '@/lib/api';
import { parseMode } from '@/lib/mode';
import { parseIds, toggleId } from '@/lib/plan';
import { SessionCardView } from './_components/session-card';

const SUGGESTED = [
  'agents that fix clusters',
  'supply chain security',
  'platform engineering for AI',
  'observability for LLMs',
];

export default async function Page({ searchParams }: PageProps<'/'>) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q : '';
  const mode = parseMode(sp.mode);
  const ids = parseIds(sp.ids);
  let result: SearchResponse | undefined;
  let error = '';
  if (q) {
    try {
      result = await search(q, mode);
    } catch (e) {
      error = e instanceof Error ? e.message : 'search failed';
    }
  }
  const suggestions = (
    <ul className="chips">
      {SUGGESTED.map((t) => (
        <li key={t}>
          <a href={`/?mode=${mode}&q=${encodeURIComponent(t)}`}>{t}</a>
        </li>
      ))}
    </ul>
  );
  const firstSemantic = result?.hits.find((h) => h.legs?.length === 1 && h.legs[0] === 'knn')?.id;
  return (
    <>
      <h1>Find a talk</h1>
      <div className="hero">
        <p className="lede">
          Four days, three venues, more than three hundred sessions. Say what you want in plain
          words.
        </p>
        <search>
          <form action="/" method="get">
            <label htmlFor="q">What are you looking for?</label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="agents that fix clusters"
            />
            <input type="hidden" name="mode" value={mode} />
            {ids.length > 0 && <input type="hidden" name="ids" value={ids.join(',')} />}
            <button type="submit">Search</button>
          </form>
        </search>
        {!result && !error && (
          <>
            <p className="meta">Try one of these:</p>
            {suggestions}
          </>
        )}
      </div>
      {error && (
        <>
          <p role="alert">Search is unavailable: {error}</p>
          <p className="empty">
            The search api did not answer. The{' '}
            <a href={`/schedule/2026-11-10?mode=${mode}`}>day schedule</a> still works when the
            index is up, and the official program is at{' '}
            <a href="https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/program/schedule/">
              events.linuxfoundation.org
            </a>
            .
          </p>
        </>
      )}
      {result && result.total === 0 && (
        <section aria-labelledby="results">
          <h2 id="results">No talks match “{result.query}”</h2>
          <p className="empty">Try fewer words, or one of these:</p>
          {suggestions}
        </section>
      )}
      {result && result.total > 0 && (
        <section aria-labelledby="results">
          <h2 id="results">
            {result.total} result{result.total === 1 ? '' : 's'} for “{result.query}”
          </h2>
          <ul className="cards">
            {result.hits.map((h) => (
              <SessionCardView
                key={h.id}
                s={h}
                mode={mode}
                showDay
                explainSemantic={h.id === firstSemantic}
                planHref={`/?mode=${mode}&q=${encodeURIComponent(q)}&ids=${toggleId(ids, h.id)}`}
                inPlan={ids.includes(h.id)}
              />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
