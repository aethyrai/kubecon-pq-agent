import { annotate, withSpan } from '@kubecon-pq-agent/otel';
import { API_GROUP, API_VERSION, CryptoPolicy, PQPeer, PQTunnel } from '@kubecon-pq-agent/schema';
import pino from 'pino';
import {
  condition,
  connect,
  patchStatus,
  recordEvent,
  rollGateway,
  upsertConfigMap,
} from './kube.js';
import { renderGatewayConfig } from './render.js';

/**
 * Reconcile on a fixed cadence (default 5 s) by listing the three kinds. A long-lived watch can
 * die silently; a poll cannot. Each pass is cheap (three list calls) and idempotent: it renders,
 * compares the config hash, and only then writes the ConfigMap, rolls the gateway, patches
 * status, and records a Kubernetes Event that names the change.
 */
const log = pino({ level: process.env.LOG_LEVEL ?? 'info', base: { service: 'aethyr-operator' } });
const kube = connect();
const INTERVAL_MS = Number(process.env.RECONCILE_INTERVAL_MS ?? 5000);

let lastHash = '';
let lastFingerprint = '';

function isListObject(v: unknown): v is { items: unknown[] } {
  return typeof v === 'object' && v !== null && Array.isArray((v as { items?: unknown }).items);
}

async function list<T>(
  plural: string,
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
): Promise<T[]> {
  const r: unknown = await kube.custom.listClusterCustomObject({
    group: API_GROUP,
    version: API_VERSION,
    plural,
  });
  if (!isListObject(r)) throw new Error(`list ${plural}: unexpected response shape`);
  const out: T[] = [];
  for (const item of r.items) {
    const parsed = schema.safeParse(item);
    if (parsed.success && parsed.data) out.push(parsed.data);
    else
      log.warn(
        { plural, name: (item as { metadata?: { name?: string } }).metadata?.name },
        'object failed schema; ignored',
      );
  }
  return out;
}

/** Everything a render depends on: specs, generations, and admission. Status patches do not change it. */
function fingerprint(ps: CryptoPolicy[], ts: PQTunnel[], pe: PQPeer[]): string {
  const key = (o: {
    metadata: { name: string; namespace?: string | undefined; generation?: number | undefined };
    spec: unknown;
    status?: unknown;
  }) =>
    `${o.metadata.namespace ?? ''}/${o.metadata.name}@${o.metadata.generation ?? 0}:${JSON.stringify(o.spec)}:${(o.status as { admitted?: boolean } | undefined)?.admitted ?? ''}`;
  return [...ps.map(key), ...ts.map(key), ...pe.map(key)].sort().join('|');
}

export async function reconcile(): Promise<void> {
  return withSpan('aethyr-operator', 'operator.reconcile', {}, () => reconcileInner());
}

async function reconcileInner(): Promise<void> {
  const [ps, ts, pe] = await Promise.all([
    list('cryptopolicies', CryptoPolicy),
    list('pqtunnels', PQTunnel),
    list('pqpeers', PQPeer),
  ]);
  const fp = fingerprint(ps, ts, pe);
  if (fp === lastFingerprint) return;
  lastFingerprint = fp;
  log.info({ policies: ps.length, tunnels: ts.length, peers: pe.length }, 'change detected');

  const cfg = renderGatewayConfig(ts, ps, pe);
  annotate({
    'gateway.config_hash': cfg.hash,
    'gateway.changed': cfg.hash !== lastHash,
    'policy.levels': ps.map((p) => `${p.spec.kem}/${p.spec.signature}`).join(','),
  });
  if (cfg.hash !== lastHash) {
    await upsertConfigMap(kube, cfg.data, cfg.hash);
    const rolled = await rollGateway(kube, cfg.hash);
    const levels = ps
      .map((p) => `${p.metadata.name}: ${p.spec.kem}/${p.spec.signature}`)
      .join(', ');
    log.info(
      {
        hash: cfg.hash,
        tunnels: ts.length,
        peers: pe.filter((p) => p.status?.admitted).length,
        rolled,
        levels,
      },
      'gateway config rendered',
    );
    await recordEvent(
      kube,
      'GatewayConfigRendered',
      `config ${cfg.hash}: ${levels}; ${ts.length} tunnel(s), ${pe.filter((p) => p.status?.admitted).length} admitted peer(s); gateway ${rolled ? 'rolled' : 'unchanged'}`,
    ).catch((err) => log.warn({ err }, 'event failed'));
    lastHash = cfg.hash;
  }

  for (const t of ts) {
    const ok = ps.some((p) => p.metadata.name === t.spec.policyRef.name);
    if (readyStatus(t.status) === ok) continue;
    await patchStatus(kube, 'pqtunnels', t.metadata.name, t.metadata.namespace, {
      endpoints: ok ? [`0.0.0.0:${t.spec.listener.port}`] : [],
      conditions: [
        condition(
          'Ready',
          ok,
          ok ? 'Rendered' : 'PolicyNotFound',
          ok ? '' : `CryptoPolicy ${t.spec.policyRef.name} not found`,
        ),
      ],
    }).catch((err) => log.warn({ err, tunnel: t.metadata.name }, 'status patch failed'));
  }
  for (const p of ps) {
    if (appliedGeneration(p.status) === (p.metadata.generation ?? 0)) continue;
    await patchStatus(kube, 'cryptopolicies', p.metadata.name, undefined, {
      appliedGeneration: p.metadata.generation ?? 0,
      conditions: [condition('Ready', true, 'Applied', `${p.spec.kem} / ${p.spec.signature}`)],
    }).catch((err) => log.warn({ err, policy: p.metadata.name }, 'status patch failed'));
    await recordEvent(
      kube,
      'CryptoPolicyApplied',
      `${p.metadata.name} generation ${p.metadata.generation ?? 0}: ${p.spec.kem} / ${p.spec.signature} (${p.spec.profile})`,
    ).catch(() => undefined);
  }
  for (const peer of pe) {
    if (peer.status?.admitted === true) continue;
    // Admission policy for the hackathon: every well-formed peer is admitted. Production gates this on an approver.
    await patchStatus(kube, 'pqpeers', peer.metadata.name, peer.metadata.namespace, {
      admitted: true,
      conditions: [condition('Ready', true, 'Admitted')],
    }).catch((err) => log.warn({ err, peer: peer.metadata.name }, 'admission patch failed'));
    await recordEvent(
      kube,
      'PQPeerAdmitted',
      `${peer.metadata.namespace ?? ''}/${peer.metadata.name} ${peer.spec.algorithm}${peer.spec.did ? ` ${peer.spec.did}` : ''}`,
    ).catch(() => undefined);
  }
}

function readyStatus(status: unknown): boolean | undefined {
  const conds = (status as { conditions?: Array<{ type: string; status: string }> } | undefined)
    ?.conditions;
  const ready = conds?.find((c) => c.type === 'Ready');
  return ready ? ready.status === 'True' : undefined;
}
function appliedGeneration(status: unknown): number | undefined {
  const g = (status as { appliedGeneration?: unknown } | undefined)?.appliedGeneration;
  return typeof g === 'number' ? g : undefined;
}

async function loop(): Promise<void> {
  for (;;) {
    try {
      await reconcile();
    } catch (err) {
      log.error({ err }, 'reconcile failed; retrying next tick');
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

log.info({ intervalMs: INTERVAL_MS }, 'aethyr-operator started (polling reconciler)');
void loop();
