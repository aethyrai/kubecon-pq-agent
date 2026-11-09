import { booths } from '@/lib/api';
import { parseMode } from '@/lib/mode';

export default async function Page({ searchParams }: PageProps<'/booths'>) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const q = typeof sp.q === 'string' ? sp.q : '';
  let list: Awaited<ReturnType<typeof booths>>['exhibitors'] = [];
  let error = '';
  try {
    list = (await booths(q)).exhibitors;
  } catch (e) {
    error = e instanceof Error ? e.message : 'unavailable';
  }
  return (
    <>
      <h1>Booths</h1>
      <search>
        <form action="/booths" method="get">
          <label htmlFor="q">Product area or company</label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="observability" />
          <input type="hidden" name="mode" value={mode} />
          <button type="submit">Find booths</button>
        </form>
      </search>
      {error && <p role="alert">Booths unavailable: {error}</p>}
      <ul className="cards">
        {list.map((e) => (
          <li key={e.id} aria-label={`${e.name}, booth ${e.booth || 'unlisted'}`}>
            <h3>
              {e.url ? (
                <a href={e.url} rel="noopener">
                  {e.name}
                </a>
              ) : (
                e.name
              )}
            </h3>
            <p>
              Booth {e.booth || 'not listed'} · {e.tier}
              {mode !== 'text' &&
                e.categories.map((c) => (
                  <span key={c} className="badge">
                    {c}
                  </span>
                ))}
            </p>
            {mode !== 'text' && e.description && (
              <p>
                {e.description.slice(0, 220)}
                {e.description.length > 220 ? '…' : ''}
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
