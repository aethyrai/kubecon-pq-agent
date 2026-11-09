import { parseMode } from '@/lib/mode';

/**
 * Provenance for the judges. The statements mirror the README's "What pre-existed" and
 * "What was built on November 9" sections and must stay in step with them.
 */
export default async function Page({ searchParams }: PageProps<'/about'>) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  return (
    <>
      <h1>What was built today</h1>
      <p className="lede">
        A KubeCon NA 2026 conference agent, built for the Cloud Native Hackathon in Salt Lake City
        on November 9, 2026. This page says what existed before the hackathon and what was written
        during it.
      </p>
      <section aria-labelledby="pre">
        <h2 id="pre">What pre-existed</h2>
        <p>
          Aethyr Node, our post-quantum tunnel library, is used here as a container image
          (ghcr.io/aethyrai/aethyr-tunnel) and nothing else. Its source and history are in its own
          repository and were not written during the hackathon window. The tunnel binary speaks mTLS
          1.3 on the outside and an ML-DSA-authenticated, ML-KEM-keyed AWP session on the inside.
        </p>
        <p>Everything else in the repository was written on November 9, 2026.</p>
      </section>
      <section aria-labelledby="built">
        <h2 id="built">What was built on November 9</h2>
        <p>Every change is a pull request in the public repository, reviewed and built by CI.</p>
        <ol className="facts">
          <li>
            Platform under Argo CD: namespaces with Pod Security labels, default-deny network
            policies, a certificate issuer, and an app-of-apps.
          </li>
          <li>
            Elasticsearch with six strict index mappings behind aliases, loaded from the public
            KubeCon schedule, the sponsor directory, and the co-located event pages, with embeddings
            computed on the CPU inside the cluster.
          </li>
          <li>
            Custom resources CryptoPolicy, PQTunnel, and PQPeer, an operator that renders them into
            gateway configuration, and an identity service that admits peers.
          </li>
          <li>
            The api: hybrid search, recommendations, day schedules, conflict checks, booths, side
            events, and room accessibility.
          </li>
          <li>An MCP server that exposes the same as tools, a schedule resource, and a prompt.</li>
          <li>This web client, with full, text, and screen-reader modes.</li>
          <li>
            Telemetry to Dash0, Radar for the cluster, Gitar on every pull request, canary rollouts,
            and chaos scripts used in the demo.
          </li>
        </ol>
      </section>
      <section aria-labelledby="with">
        <h2 id="with">Built with</h2>
        <p>
          Built with{' '}
          <a href="https://gitar.ai" rel="noopener">
            Gitar
          </a>
          ,{' '}
          <a href="https://www.dash0.com" rel="noopener">
            Dash0
          </a>
          ,{' '}
          <a href="https://skyhook.io" rel="noopener">
            Radar
          </a>
          , and{' '}
          <a href="https://www.elastic.co" rel="noopener">
            Elasticsearch
          </a>
          , and{' '}
          <a href="https://opentelemetry.io" rel="noopener">
            OpenTelemetry
          </a>
          , on Kubernetes.
        </p>
      </section>
      <section aria-labelledby="dash0">
        <h2 id="dash0">What you see in Dash0</h2>
        <p>
          Each deploy leaves a mark. Argo CD sync hooks post a dash0.deployment event, so every
          promotion and every failed sync appears on the service charts with its image tag.
        </p>
        <p>
          Every request's log line carries its trace id. Open a search in Dash0 logs and its full
          trace opens with it, from the web client through the api to Elasticsearch.
        </p>
        <p>
          Inside each search trace, the search.leg.bm25 and search.leg.knn spans show which
          retrieval leg found each hit, and search.hybrid records the fused total and how many hits
          only the vector leg found.
        </p>
      </section>
      <section aria-labelledby="where">
        <h2 id="where">Where to look</h2>
        <p>
          The full list of pull requests, the evidence files, and the six-minute run of show are in
          the repository README at{' '}
          <a href="https://github.com/aethyrai/kubecon-pq-agent" rel="noopener">
            github.com/aethyrai/kubecon-pq-agent
          </a>
          .
        </p>
      </section>
      <p className="actions">
        <a href={`/?mode=${mode}`}>Back to search</a>
      </p>
    </>
  );
}
