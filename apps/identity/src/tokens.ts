import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

/** Pseudonymous peer id: hash of the ML-DSA public key. Never the key, never a name. */
export function peerIdFromPublicKey(publicKeyB64: string): string {
  const h = createHash('sha256').update(Buffer.from(publicKeyB64, 'base64')).digest('base64url');
  return `peer-${h
    .slice(0, 32)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, 'x')}`;
}

/** Opaque 256-bit bearer token. Only its hash is stored. */
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface TokenRecord {
  peerId: string;
  issuedAt: string;
  expiresAt: string;
}

export function isExpired(rec: TokenRecord, now: Date = new Date()): boolean {
  return new Date(rec.expiresAt).getTime() <= now.getTime();
}

export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
