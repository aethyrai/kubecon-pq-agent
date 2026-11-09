import { type SearchResponse, search } from '@/lib/api';
import { parseMode } from '@/lib/mode';
import { SessionCardView } from './_components/session-card';

export default async function Page({ searchParams }: PageProps<'/'>) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q : '';
  const mode = parseMode(sp.mode);
  let result: SearchResponse | undefined;
  let error = '';
  if (q) {
    try {
      result = await search(q, mode);
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
              <SessionCardView key={h.id} s={h} mode={mode} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
