import { API_GROUP, API_VERSION, CryptoPolicy, PQPeer, PQTunnel } from '@kubecon-pq-agent/schema';
import * as k8s from '@kubernetes/client-node';
import pino from 'pino';
import { condition, connect, patchStatus, rollGateway, upsertConfigMap } from './kube.js';
import { renderGatewayConfig } from './render.js';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info', base: { service: 'aethyr-operator' } });
const kube = connect();
const base = `/apis/${API_GROUP}/${API_VERSION}`;

const policies = new Map<string, CryptoPolicy>();
const tunnels = new Map<string, PQTunnel>();
const peers = new Map<string, PQPeer>();
let lastHash = '';
let timer: NodeJS.Timeout | undefined;

function key(meta: { name: string; namespace?: string | undefined }): string {
  return `${meta.namespace ?? ''}/${meta.name}`;
}

function schedule(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void reconcile(), 300);
}

async function reconcile(): Promise<void> {
  const ps = [...policies.values()];
  const ts = [...tunnels.values()];
  const pe = [...peers.values()];
  const cfg = renderGatewayConfig(ts, ps, pe);
  if (cfg.hash !== lastHash) {
    await upsertConfigMap(kube, cfg.data, cfg.hash);
    const rolled = await rollGateway(kube, cfg.hash);
    log.info(
      { hash: cfg.hash, tunnels: ts.length, peers: pe.length, rolled },
      'gateway config rendered',
    );
    lastHash = cfg.hash;
  }
  for (const t of ts) {
    const ok = ps.some((p) => p.metadata.name === t.spec.policyRef.name);
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
    await patchStatus(kube, 'cryptopolicies', p.metadata.name, undefined, {
      appliedGeneration: p.metadata.generation ?? 0,
      conditions: [condition('Ready', true, 'Applied')],
    }).catch((err) => log.warn({ err, policy: p.metadata.name }, 'status patch failed'));
  }
  for (const peer of pe) {
    if (peer.status?.admitted === true) continue;
    // Admission policy for the hackathon: every well-formed peer is admitted. Production gates this on an approver.
    await patchStatus(kube, 'pqpeers', peer.metadata.name, peer.metadata.namespace, {
      admitted: true,
      conditions: [condition('Ready', true, 'Admitted')],
    }).catch((err) => log.warn({ err, peer: peer.metadata.name }, 'admission patch failed'));
  }
}

function isListObject(v: unknown): v is k8s.KubernetesListObject<k8s.KubernetesObject> {
  return typeof v === 'object' && v !== null && Array.isArray((v as { items?: unknown }).items);
}

function watch<T>(
  plural: string,
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
  store: Map<string, T>,
): void {
  const informer = k8s.makeInformer(kube.kc, `${base}/${plural}`, async () => {
    const r: unknown = await kube.custom.listClusterCustomObject({
      group: API_GROUP,
      version: API_VERSION,
      plural,
    });
    if (!isListObject(r)) throw new Error(`list ${plural}: unexpected response shape`);
    return r;
  });
  const upsert = (obj: k8s.KubernetesObject): void => {
    const parsed = schema.safeParse(obj);
    if (!parsed.success || !parsed.data) {
      log.warn({ plural, name: obj.metadata?.name }, 'object failed schema; ignored');
      return;
    }
    store.set(
      key({ name: obj.metadata?.name ?? '', namespace: obj.metadata?.namespace }),
      parsed.data,
    );
    schedule();
  };
  informer.on('add', upsert);
  informer.on('update', upsert);
  informer.on('delete', (obj) => {
    store.delete(key({ name: obj.metadata?.name ?? '', namespace: obj.metadata?.namespace }));
    schedule();
  });
  informer.on('error', (err) => {
    log.error({ err, plural }, 'informer error; restarting in 5s');
    setTimeout(() => void informer.start(), 5000);
  });
  void informer.start();
}

watch('cryptopolicies', CryptoPolicy, policies);
watch('pqtunnels', PQTunnel, tunnels);
watch('pqpeers', PQPeer, peers);
log.info('aethyr-operator started');
