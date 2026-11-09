import { booths } from '@/lib/api';
import { parseMode } from '@/lib/mode';

export default async function Page({ searchParams }: PageProps<'/booths'>) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const q = typeof sp.q === 'string' ? sp.q : '';
  let list: Awaited<ReturnType<typeof booths>>['exhibitors'] = [];
  let error = '';
  if (q) {
    try {
      list = (await booths(q)).exhibitors;
    } catch (e) {
      error = e instanceof Error ? e.message : 'unavailable';
    }
  }
  return (
    <>
      <h1>Booths</h1>
      <div className="hero">
        <p className="lede">
          229 exhibitors in the Solutions Showcase. Search by what they do or who they are.
        </p>
        <search>
          <form action="/booths" method="get">
            <label htmlFor="q">Product area or company</label>
            <input id="q" name="q" type="search" defaultValue={q} placeholder="observability" />
            <input type="hidden" name="mode" value={mode} />
            <button type="submit">Find booths</button>
          </form>
        </search>
      </div>
      {error && (
        <>
          <p role="alert">Booths unavailable: {error}</p>
          <p className="empty">The api did not answer. Try again in a moment.</p>
        </>
      )}
      {q && !error && list.length === 0 && (
        <p className="empty">
          No exhibitor matches “{q}”. Try a product area such as{' '}
          <a href={`/booths?mode=${mode}&q=security`}>security</a> or{' '}
          <a href={`/booths?mode=${mode}&q=observability`}>observability</a>.
        </p>
      )}
      {list.length > 0 && (
        <ul className="cards">
          {list.map((e) => (
            <li key={e.id}>
              <div className="lead">
                <span>Booth</span>
                <strong className="big">{e.booth || '—'}</strong>
              </div>
              <div className="body">
                <h3>
                  {e.url ? (
                    <a href={e.url} rel="noopener">
                      {e.name}
                    </a>
                  ) : (
                    e.name
                  )}
                </h3>
                {!e.booth && <p className="meta">Booth number not listed</p>}
                <p className="badges">
                  <span className="badge">{e.tier}</span>
                  {mode !== 'text' &&
                    e.categories.map((c) => (
                      <span key={c} className="badge">
                        {c}
                      </span>
                    ))}
                </p>
                {mode !== 'text' && e.description && (
                  <p className="meta">
                    {e.description.slice(0, 220)}
                    {e.description.length > 220 ? '…' : ''}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
