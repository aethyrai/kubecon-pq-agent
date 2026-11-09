import { serve } from '@hono/node-server';
import { API_GROUP, API_VERSION, type PQPeerSpec } from '@kubecon-pq-agent/schema';
import * as k8s from '@kubernetes/client-node';
import pino from 'pino';
import { buildApp, type PeerRegistry } from './app.js';
import { isNotFound, SecretTokenStore } from './store.js';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info', base: { service: 'identity' } });
const ns = process.env.PEER_NAMESPACE ?? 'aethyr-system';
const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const core = kc.makeApiClient(k8s.CoreV1Api);
const custom = kc.makeApiClient(k8s.CustomObjectsApi);
const plural = 'pqpeers';

const registry: PeerRegistry = {
  async register(name, spec: PQPeerSpec) {
    const body = {
      apiVersion: `${API_GROUP}/${API_VERSION}`,
      kind: 'PQPeer',
      metadata: { name, namespace: ns },
      spec,
    };
    try {
      await custom.getNamespacedCustomObject({
        group: API_GROUP,
        version: API_VERSION,
        namespace: ns,
        plural,
        name,
      });
      await custom.patchNamespacedCustomObject(
        { group: API_GROUP, version: API_VERSION, namespace: ns, plural, name, body: { spec } },
        k8s.setHeaderOptions('Content-Type', k8s.PatchStrategy.MergePatch),
      );
    } catch (err) {
      if (!isNotFound(err)) throw err;
      await custom.createNamespacedCustomObject({
        group: API_GROUP,
        version: API_VERSION,
        namespace: ns,
        plural,
        body,
      });
    }
    for (let i = 0; i < 20; i++) {
      const obj: unknown = await custom.getNamespacedCustomObject({
        group: API_GROUP,
        version: API_VERSION,
        namespace: ns,
        plural,
        name,
      });
      const admitted = (obj as { status?: { admitted?: boolean } }).status?.admitted === true;
      if (admitted) return { admitted: true };
      await new Promise((r) => setTimeout(r, 500));
    }
    return { admitted: false };
  },
  async tokenIssued(name, at) {
    await custom.patchNamespacedCustomObjectStatus(
      {
        group: API_GROUP,
        version: API_VERSION,
        namespace: ns,
        plural,
        name,
        body: { status: { tokenIssuedAt: at, lastSeen: at } },
      },
      k8s.setHeaderOptions('Content-Type', k8s.PatchStrategy.MergePatch),
    );
  },
};

const app = buildApp(registry, new SecretTokenStore(core, ns));
const port = Number(process.env.PORT ?? 8082);
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) =>
  log.info({ port: info.port }, 'identity listening'),
);
