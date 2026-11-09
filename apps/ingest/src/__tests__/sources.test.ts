import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  loadColocFixture,
  sessionsFromCncfHosted,
  sideEventsFromSponsorHosted,
} from '../sources/lf-coloc.js';
import { loadSponsorFixture } from '../sources/lf-sponsors.js';

const LF = new URL('../../../../fixtures/lf/', import.meta.url).pathname;

test('sponsor directory yields exhibitors with name, tier, booth, and categories', async () => {
  const ex = await loadSponsorFixture(`${LF}sponsor-directory-2026-11-09.html`);
  assert.ok(ex.length > 150, `got ${ex.length}`);
  const withBooth = ex.filter((e) => /^\d+[A-Z]?$/.test(e.booth));
  assert.ok(withBooth.length > 100, `only ${withBooth.length} have booth numbers`);
  const tiers = new Set(ex.map((e) => e.tier));
  for (const t of ['Diamond', 'Platinum', 'Gold', 'Silver'])
    assert.ok(tiers.has(t), `missing tier ${t}`);
  const a = ex.find((e) => e.name === 'ActiveState');
  assert.ok(a);
  assert.equal(a.booth, '277');
  assert.equal(a.tier, 'Silver');
  assert.deepEqual(a.categories, ['Security']);
  assert.ok(a.description.startsWith("Who Vets AI's Code?"));
  assert.equal(new Set(ex.map((e) => e.id)).size, ex.length, 'ids are unique');
});

test('sponsor-hosted co-located events become side events with host and registration flags', async () => {
  const data = await loadColocFixture(`${LF}coloc-sponsor-hosted-2026-11-09.html`);
  const ev = sideEventsFromSponsorHosted(data);
  assert.ok(ev.length >= 10, `got ${ev.length}`);
  const vultr = ev.find((e) => /Agent Rush Hackathon/.test(e.name));
  assert.ok(vultr);
  assert.equal(vultr.host, 'Vultr');
  assert.equal(vultr.capacity_note, 'Sold out');
  assert.doesNotMatch(vultr.name, /SOLD OUT/);
  const azure = ev.find((e) => /Azure Day/.test(e.name));
  assert.ok(azure);
  assert.equal(azure.badge_required, false);
  for (const e of ev) assert.match(e.id, /^coloc-\d+$/);
});

test('CNCF-hosted co-located talks become sessions tagged with their event', async () => {
  const data = await loadColocFixture(`${LF}coloc-cncf-hosted-2026-11-09.html`);
  const s = sessionsFromCncfHosted(data);
  assert.ok(s.length > 150, `got ${s.length}`);
  const events = new Set(s.map((x) => x.colocated_event).filter(Boolean));
  assert.ok(events.has('ArgoCon'), [...events].join(','));
  assert.ok(events.has('Observability Day'));
  for (const x of s.slice(0, 30)) {
    assert.match(x.id, /^coloc-\d+$/);
    assert.ok(x.day === '2026-11-08' || x.day === '2026-11-09', `co-located day ${x.day}`);
  }
  assert.equal(
    s.some((x) => /registration \+ badge/i.test(x.title)),
    false,
  );
});
