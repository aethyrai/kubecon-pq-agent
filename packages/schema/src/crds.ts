import { z } from 'zod';

/** aethyr.io/v1alpha1 specs. One source of truth for the operator and the identity service. */
export const API_GROUP = 'aethyr.io';
export const API_VERSION = 'v1alpha1';

export const Kem = z.enum(['ML-KEM-768', 'ML-KEM-1024']);
export const Signature = z.enum(['ML-DSA-65', 'ML-DSA-87']);
export const Hybrid = z.enum(['X25519', 'none']);
export const Profile = z.enum(['hackathon', 'cnsa2']);

export const CryptoPolicySpec = z
  .object({
    kem: Kem,
    hybrid: Hybrid.default('X25519'),
    signature: Signature,
    rekeyInterval: z
      .string()
      .regex(/^([0-9]+(s|m|h))+$/)
      .default('15m'),
    profile: Profile.default('hackathon'),
  })
  .refine(
    (s) => s.profile !== 'cnsa2' || (s.kem === 'ML-KEM-1024' && s.signature === 'ML-DSA-87'),
    {
      message: 'profile cnsa2 requires ML-KEM-1024 and ML-DSA-87',
    },
  )
  .refine((s) => (s.kem === 'ML-KEM-1024') === (s.signature === 'ML-DSA-87'), {
    message: 'ML-KEM-768 pairs with ML-DSA-65 and ML-KEM-1024 with ML-DSA-87',
  });
export type CryptoPolicySpec = z.infer<typeof CryptoPolicySpec>;

export const Upstream = z.object({
  service: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  localPort: z.number().int().min(1).max(65535).optional(),
});
export const PQTunnelSpec = z.object({
  listener: z.object({
    port: z.number().int().min(1).max(65535).default(7443),
    protocol: z.literal('TCP').default('TCP'),
  }),
  policyRef: z.object({ name: z.string().min(1) }),
  upstreams: z.array(Upstream).min(1),
  nodeSelector: z.record(z.string(), z.string()).optional(),
});
export type PQTunnelSpec = z.infer<typeof PQTunnelSpec>;

export const PQPeerSpec = z.object({
  publicKey: z.string().min(44),
  algorithm: Signature,
  did: z
    .string()
    .regex(/^did:(aethyr|key):/)
    .optional(),
  displayName: z.string().max(80).optional(),
  optIns: z
    .object({ matchmaking: z.boolean().default(false), directory: z.boolean().default(false) })
    .default({
      matchmaking: false,
      directory: false,
    }),
  expiresAt: z.string().datetime().optional(),
});
export type PQPeerSpec = z.infer<typeof PQPeerSpec>;

export const Condition = z.object({
  type: z.string(),
  status: z.enum(['True', 'False', 'Unknown']),
  reason: z.string().optional(),
  message: z.string().optional(),
  lastTransitionTime: z.string().optional(),
});
export type Condition = z.infer<typeof Condition>;

export const ObjectMeta = z.object({
  name: z.string(),
  namespace: z.string().optional(),
  generation: z.number().int().optional(),
  resourceVersion: z.string().optional(),
  uid: z.string().optional(),
});

export const CryptoPolicy = z.object({
  apiVersion: z.literal(`${API_GROUP}/${API_VERSION}`),
  kind: z.literal('CryptoPolicy'),
  metadata: ObjectMeta,
  spec: CryptoPolicySpec,
  status: z.unknown().optional(),
});
export type CryptoPolicy = z.infer<typeof CryptoPolicy>;

export const PQTunnel = z.object({
  apiVersion: z.literal(`${API_GROUP}/${API_VERSION}`),
  kind: z.literal('PQTunnel'),
  metadata: ObjectMeta,
  spec: PQTunnelSpec,
  status: z.unknown().optional(),
});
export type PQTunnel = z.infer<typeof PQTunnel>;

export const PQPeer = z.object({
  apiVersion: z.literal(`${API_GROUP}/${API_VERSION}`),
  kind: z.literal('PQPeer'),
  metadata: ObjectMeta,
  spec: PQPeerSpec,
  status: z
    .object({
      admitted: z.boolean().optional(),
      lastSeen: z.string().optional(),
      tokenIssuedAt: z.string().optional(),
      conditions: z.array(Condition).optional(),
    })
    .optional(),
});
export type PQPeer = z.infer<typeof PQPeer>;
