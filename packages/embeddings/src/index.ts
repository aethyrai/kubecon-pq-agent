import { env, type FeatureExtractionPipeline, pipeline } from '@huggingface/transformers';
import { withSpan } from '@kubecon-pq-agent/otel';

// Model files: MODEL_CACHE_DIR (default ./.model-cache). MODEL_OFFLINE=1 forbids downloads (the images bake the model in).
env.cacheDir = process.env.MODEL_CACHE_DIR ?? './.model-cache';
env.allowRemoteModels = process.env.MODEL_OFFLINE !== '1';

/** Narrow the pipeline overloads: the full union is too complex for tsc (TS2590). */
type FeatureExtractionFactory = (
  task: 'feature-extraction',
  model: string,
  options: { dtype: 'q8' | 'fp32' },
) => Promise<FeatureExtractionPipeline>;
// @ts-expect-error TS2590: the pipeline() overload union is too complex for tsc; the narrowed type above is what we use.
const featureExtraction: FeatureExtractionFactory = pipeline;

/** Sentence embeddings that run on the CPU inside the cluster. Nothing leaves the pod. */
export interface Embedder {
  readonly dims: number;
  /** Embed documents for indexing. */
  embed(texts: string[]): Promise<number[][]>;
  /** Embed a search query. bge models want an instruction prefix on the query side only. */
  embedQuery(text: string): Promise<number[]>;
}

export const LOCAL_EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? 'Xenova/bge-small-en-v1.5';
export const LOCAL_EMBEDDING_DIMS = 384;
const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';
const BATCH = 32;

export class LocalEmbedder implements Embedder {
  readonly dims = LOCAL_EMBEDDING_DIMS;
  private extractor: Promise<FeatureExtractionPipeline> | undefined;

  constructor(private readonly model: string = LOCAL_EMBEDDING_MODEL) {}

  private load(): Promise<FeatureExtractionPipeline> {
    this.extractor ??= featureExtraction('feature-extraction', this.model, { dtype: 'q8' });
    return this.extractor;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return withSpan(
      'embeddings',
      'embed.local',
      { 'embed.model': this.model, 'embed.texts': texts.length, 'embed.dims': this.dims },
      () => this.embedInner(texts),
    );
  }

  private async embedInner(texts: string[]): Promise<number[][]> {
    const extractor = await this.load();
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH) {
      const batch = texts
        .slice(i, i + BATCH)
        .map((t) => (t.trim().length > 0 ? t.slice(0, 2000) : ' '));
      const tensor = await extractor(batch, { pooling: 'cls', normalize: true });
      const rows = tensor.tolist();
      for (const row of rows) out.push(Array.from(row, Number));
    }
    return out;
  }

  async embedQuery(text: string): Promise<number[]> {
    const [v] = await this.embed([QUERY_PREFIX + text]);
    if (!v) throw new Error('embedQuery produced no vector');
    return v;
  }
}

/** Zero vectors are never indexed; documents without a vector still match by keyword. */
export class NoopEmbedder implements Embedder {
  readonly dims = LOCAL_EMBEDDING_DIMS;
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => []);
  }
  async embedQuery(): Promise<number[]> {
    return [];
  }
}

/** EMBEDDER=local (default) | none. */
export function embedderFromEnv(env: NodeJS.ProcessEnv = process.env): Embedder {
  const kind = env.EMBEDDER ?? 'local';
  if (kind === 'none') return new NoopEmbedder();
  return new LocalEmbedder();
}
