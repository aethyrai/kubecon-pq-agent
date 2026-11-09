import { IDENTITY_URL } from '@/lib/api';

/** The trail as the identity service returns it, for download and offline verification. */
export async function GET(): Promise<Response> {
  const res = await fetch(`${IDENTITY_URL}/trail`, { cache: 'no-store' });
  if (!res.ok)
    return new Response(JSON.stringify({ error: `HTTP ${res.status}` }), { status: 502 });
  return new Response(await res.text(), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': 'attachment; filename="pq-trail.json"',
      'cache-control': 'no-store',
    },
  });
}
