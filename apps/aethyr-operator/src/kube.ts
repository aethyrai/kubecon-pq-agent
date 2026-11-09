import { API_GROUP, API_VERSION, type Condition } from '@kubecon-pq-agent/schema';
import * as k8s from '@kubernetes/client-node';

export const GATEWAY_NAMESPACE = process.env.AETHYR_SYSTEM_NAMESPACE ?? 'aethyr-system';
export const GATEWAY_CONFIGMAP = 'aethyr-gateway-config';
export const GATEWAY_DAEMONSET = 'aethyr-node';

export interface Kube {
  kc: k8s.KubeConfig;
  core: k8s.CoreV1Api;
  apps: k8s.AppsV1Api;
  custom: k8s.CustomObjectsApi;
}

export function connect(): Kube {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  return {
    kc,
    core: kc.makeApiClient(k8s.CoreV1Api),
    apps: kc.makeApiClient(k8s.AppsV1Api),
    custom: kc.makeApiClient(k8s.CustomObjectsApi),
  };
}

export async function upsertConfigMap(
  kube: Kube,
  data: Record<string, string>,
  hash: string,
): Promise<void> {
  const body: k8s.V1ConfigMap = {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name: GATEWAY_CONFIGMAP,
      namespace: GATEWAY_NAMESPACE,
      annotations: { 'aethyr.io/config-hash': hash },
    },
    data,
  };
  try {
    await kube.core.readNamespacedConfigMap({
      name: GATEWAY_CONFIGMAP,
      namespace: GATEWAY_NAMESPACE,
    });
    await kube.core.replaceNamespacedConfigMap({
      name: GATEWAY_CONFIGMAP,
      namespace: GATEWAY_NAMESPACE,
      body,
    });
  } catch (err) {
    if (isNotFound(err))
      await kube.core.createNamespacedConfigMap({ namespace: GATEWAY_NAMESPACE, body });
    else throw err;
  }
}

/** Hot reload: stamp the pod template with the config hash so the DaemonSet rolls once per change. */
export async function rollGateway(kube: Kube, hash: string): Promise<boolean> {
  try {
    const ds = await kube.apps.readNamespacedDaemonSet({
      name: GATEWAY_DAEMONSET,
      namespace: GATEWAY_NAMESPACE,
    });
    const current = ds.spec?.template.metadata?.annotations?.['aethyr.io/config-hash'];
    if (current === hash) return false;
    await kube.apps.patchNamespacedDaemonSet(
      {
        name: GATEWAY_DAEMONSET,
        namespace: GATEWAY_NAMESPACE,
        body: {
          spec: { template: { metadata: { annotations: { 'aethyr.io/config-hash': hash } } } },
        },
      },
      k8s.setHeaderOptions('Content-Type', k8s.PatchStrategy.StrategicMergePatch),
    );
    return true;
  } catch (err) {
    if (isNotFound(err)) return false; // gateway not deployed yet; the ConfigMap is ready for it
    throw err;
  }
}

export interface StatusPatch {
  conditions?: Condition[];
  [k: string]: unknown;
}

export async function patchStatus(
  kube: Kube,
  plural: string,
  name: string,
  namespace: string | undefined,
  status: StatusPatch,
): Promise<void> {
  const common = { group: API_GROUP, version: API_VERSION, plural, name, body: { status } };
  const opts = k8s.setHeaderOptions('Content-Type', k8s.PatchStrategy.MergePatch);
  if (namespace)
    await kube.custom.patchNamespacedCustomObjectStatus({ ...common, namespace }, opts);
  else await kube.custom.patchClusterCustomObjectStatus(common, opts);
}

/** A Kubernetes Event in aethyr-system naming the change action, so `kubectl get events` tells the story. */
export async function recordEvent(kube: Kube, reason: string, message: string): Promise<void> {
  const now = new Date();
  const body: k8s.CoreV1Event = {
    apiVersion: 'v1',
    kind: 'Event',
    metadata: { generateName: 'aethyr-operator-', namespace: GATEWAY_NAMESPACE },
    involvedObject: { kind: 'ConfigMap', name: GATEWAY_CONFIGMAP, namespace: GATEWAY_NAMESPACE },
    reason,
    message: message.slice(0, 1000),
    type: 'Normal',
    source: { component: 'aethyr-operator' },
    firstTimestamp: now,
    lastTimestamp: now,
    count: 1,
  };
  await kube.core.createNamespacedEvent({ namespace: GATEWAY_NAMESPACE, body });
}

export function condition(type: string, ok: boolean, reason: string, message = ''): Condition {
  return {
    type,
    status: ok ? 'True' : 'False',
    reason,
    message,
    lastTransitionTime: new Date().toISOString(),
  };
}

export function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 404
  );
}
