import { type TrailRecord, trail } from '@/lib/api';
import { parseMode } from '@/lib/mode';

const KIND: Record<string, string> = {
  'peer.registered': 'Peer registered',
  'token.issued': 'Token issued',
  'token.verified': 'Token verified',
  'policy.observed': 'Crypto policy observed',
  'policy.rotated': 'Crypto policy rotated',
};

function describe(r: TrailRecord): string {
  const d = r.data;
  switch (r.kind) {
    case 'peer.registered':
      return `${d.peer} with ${d.algorithm}`;
    case 'token.issued':
      return `for ${d.peer}, expires ${d.expiresAt}`;
    case 'token.verified':
      return `for ${d.peer}`;
    case 'policy.observed':
      return `${d.policy}: ${d.kem} key exchange, ${d.signature} signatures`;
    case 'policy.rotated':
      return `${d.policy}: ${d.fromKem} to ${d.toKem}, ${d.fromSignature} to ${d.toSignature}`;
    default:
      return Object.entries(d)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ');
  }
}

export default async function Page({ searchParams }: PageProps<'/trail'>) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  let t: Awaited<ReturnType<typeof trail>> | undefined;
  let error = '';
  try {
    t = await trail();
  } catch (e) {
    error = e instanceof Error ? e.message : 'unavailable';
  }
  return (
    <>
      <h1>Post-quantum trail</h1>
      <p className="lede">
        Every event the trust plane saw, in order, hash-chained, and signed with ML-DSA-65 by the
        identity service. These are our own signatures over our own records: they prove the
        integrity and order of what the service recorded, not third-party attestation.
      </p>
      {error && (
        <>
          <p role="alert">Trail unavailable: {error}</p>
          <p className="empty">
            The identity service did not answer. It sits behind the post-quantum gateway and may be
            re-keying. Try again in a moment.
          </p>
        </>
      )}
      {t && (
        <>
          <output className="block verdict">
            {t.verification.ok
              ? `Chain intact: ${t.verification.count} record${t.verification.count === 1 ? '' : 's'}, every signature verified.`
              : `Chain broken at record ${t.verification.brokenAt}: ${t.verification.reason}.`}
          </output>
          <p className="meta">
            Signing key {t.algorithm}, public key starts {t.publicKey.slice(0, 16)}. Head hash{' '}
            {t.head.slice(0, 16)}.
            {t.total !== undefined && t.total > t.records.length
              ? ` Showing the last ${t.records.length} of ${t.total} records.`
              : ''}{' '}
            <a href="/trail/raw">Download the trail as JSON</a> and verify it yourself with{' '}
            <a href="https://github.com/aethyrai/kubecon-pq-agent/blob/main/demo/verify-trail.mjs">
              demo/verify-trail.mjs
            </a>
            .
          </p>
          {t.records.length === 0 && (
            <p className="empty">
              No records yet. The first peer to register writes the first one.
            </p>
          )}
          {t.records.length > 0 && (
            <ol className="trail" reversed>
              {[...t.records].reverse().map((r) => {
                const ok = t.verification.ok || (t.verification.brokenAt ?? 0) > r.seq;
                return (
                  <li
                    key={r.seq}
                    value={r.seq}
                    className={r.kind === 'policy.rotated' ? 'rotated' : undefined}
                  >
                    <div className="lead">
                      <time dateTime={r.at}>{r.at.slice(11, 19)} UTC</time>
                      {r.at.slice(0, 10)}
                    </div>
                    <div className="body">
                      <h3>{KIND[r.kind] ?? r.kind}</h3>
                      <p className="meta">{describe(r)}</p>
                      {mode !== 'text' && (
                        <p className="badges">
                          <span className={ok ? 'badge semantic' : 'badge warn'}>
                            {ok ? 'Signature verified' : 'Not verified'}
                          </span>
                          <span className="badge">{r.alg}</span>
                          <span className="badge num">hash {r.hash.slice(0, 12)}</span>
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </>
  );
}
