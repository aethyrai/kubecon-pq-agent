import { formatTime, type SearchResponse, search } from '@/lib/api';
import { parseMode } from '@/lib/mode';

export default async function Page({ searchParams }: PageProps<'/'>) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q : '';
  const mode = parseMode(sp.mode);
  let result: SearchResponse | undefined;
  let error = '';
  if (q) {
    try {
      result = await search(q);
    } catch (e) {
      error = e instanceof Error ? e.message : 'search failed';
    }
  }
  return (
    <>
      <h1>Find a talk</h1>
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
          <button type="submit">Search</button>
        </form>
      </search>
      {error && <p role="alert">Search is unavailable: {error}</p>}
      {result && (
        <section aria-labelledby="results">
          <h2 id="results">
            {result.total} result{result.total === 1 ? '' : 's'} for “{result.query}”
          </h2>
          <ul className="cards">
            {result.hits.map((h) => (
              <li key={h.id}>
                <h3>{h.title}</h3>
                <p>
                  {h.day} {formatTime(h.start)}–{formatTime(h.end)} · {h.room}
                  {h.captioned && <span className="badge">Captioned</span>}
                  {mode !== 'text' && <span className="badge">{h.track}</span>}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
