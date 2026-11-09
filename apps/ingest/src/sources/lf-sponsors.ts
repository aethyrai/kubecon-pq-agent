import { readFile } from 'node:fs/promises';
import type { ExhibitorDoc } from '../documents.js';
import { stripHtml } from '../normalize.js';

export const LF_SPONSOR_DIRECTORY_URL =
  'https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/sponsor/sponsor-directory/';

const CARD_RE = /<article class="sponsor-directory__card"([^>]*)>([\s\S]*?)<\/article>/g;

function attr(attrs: string, name: string): string {
  const m = new RegExp(`\\sdata-${name}="([^"]*)"`).exec(attrs);
  return m?.[1] ? decode(m[1]) : '';
}
function decode(s: string): string {
  return s
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&#8217;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&nbsp;', ' ');
}
function detail(body: string, label: string): string {
  const m = new RegExp(`<strong>${label}:</strong>\\s*([^<]+)`).exec(body);
  return m?.[1] ? decode(m[1]).trim() : '';
}
/** "4 Silver" -> "Silver" */
function tierOf(level: string): string {
  return level.replace(/^\d+\s*/, '').trim();
}
function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
/** Booth numbers at the Salt Palace: 1xx-4xx Hall 1, 5xx+ Hall 5 is not published; keep the number only. */
export function parseSponsorDirectory(html: string): ExhibitorDoc[] {
  const out: ExhibitorDoc[] = [];
  for (const m of html.matchAll(CARD_RE)) {
    const attrs = m[1] ?? '';
    const body = m[2] ?? '';
    const name = attr(attrs, 'name');
    if (!name) continue;
    let categories: string[] = [];
    try {
      const parsed: unknown = JSON.parse(attr(attrs, 'categories') || '[]');
      if (Array.isArray(parsed))
        categories = parsed.filter((c): c is string => typeof c === 'string');
    } catch {
      categories = [];
    }
    const desc =
      /<div class="sponsor-directory-modal__description">([\s\S]*?)<\/div>/.exec(body)?.[1] ?? '';
    const site =
      /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>[^<]*(?:Website|Visit)[^<]*<\/a>/i.exec(body)?.[1] ??
      '';
    out.push({
      id: slug(name),
      name,
      booth: detail(body, 'Booth'),
      tier: tierOf(attr(attrs, 'level')) || detail(body, 'Level'),
      description: stripHtml(desc),
      categories,
      hall: '',
      url: site,
    });
  }
  return out;
}

export async function fetchSponsorDirectory(
  url: string = LF_SPONSOR_DIRECTORY_URL,
): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': 'kubecon-pq-agent-ingest/0.1' } });
  if (!res.ok) throw new Error(`sponsor directory ${url}: HTTP ${res.status}`);
  return res.text();
}
export async function loadSponsorFixture(path: string): Promise<ExhibitorDoc[]> {
  return parseSponsorDirectory(await readFile(path, 'utf8'));
}
