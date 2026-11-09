/** Server-side calls to the conference api. In-cluster: http://api.conf.svc; through the tunnel: 127.0.0.1:8080. */
export const API_URL = process.env.API_URL ?? 'http://127.0.0.1:8080';

export interface SessionHit {
  id: string;
  title: string;
  track: string;
  day: string;
  start: string;
  end: string;
  room: string;
  captioned: boolean;
}
export interface SearchResponse {
  query: string;
  hits: SessionHit[];
  total: number;
  stub?: boolean;
}

function isSearchResponse(v: unknown): v is SearchResponse {
  return typeof v === 'object' && v !== null && Array.isArray((v as SearchResponse).hits);
}

export async function search(q: string): Promise<SearchResponse> {
  const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`api /search: HTTP ${res.status}`);
  const body: unknown = await res.json();
  if (!isSearchResponse(body)) throw new Error('api /search: unexpected shape');
  return body;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Denver',
  });
}
