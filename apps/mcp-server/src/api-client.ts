/** Thin client for the conference api, in-cluster at http://api.conf.svc. */
export interface ApiClient {
  get(path: string, query?: Record<string, string | undefined>): Promise<unknown>;
  post(path: string, body: unknown): Promise<unknown>;
}

export function httpApiClient(
  baseUrl: string = process.env.API_URL ?? 'http://api.conf.svc',
  fetchFn: typeof fetch = fetch,
): ApiClient {
  const url = (path: string, query?: Record<string, string | undefined>): string => {
    // Relative join: a leading '/' would discard any path prefix in API_URL.
    const u = new URL(path.replace(/^\/+/, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
    for (const [k, v] of Object.entries(query ?? {}))
      if (v !== undefined && v !== '') u.searchParams.set(k, v);
    return u.toString();
  };
  const check = async (res: Response): Promise<unknown> => {
    if (!res.ok)
      throw new Error(
        `api ${res.url}: HTTP ${res.status} ${await res.text().catch(() => '')}`.trim(),
      );
    return res.json();
  };
  return {
    async get(path, query) {
      return check(await fetchFn(url(path, query), { headers: { accept: 'application/json' } }));
    },
    async post(path, body) {
      return check(
        await fetchFn(url(path), {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(body),
        }),
      );
    },
  };
}
