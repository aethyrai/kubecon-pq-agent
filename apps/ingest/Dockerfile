# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/es-client/package.json packages/es-client/
COPY packages/embeddings/package.json packages/embeddings/
COPY apps/ingest/package.json apps/ingest/
RUN npm ci --no-audit --no-fund
COPY packages/es-client packages/es-client
COPY packages/embeddings packages/embeddings
COPY apps/ingest apps/ingest
RUN npm run build -w @kubecon-pq-agent/es-client && npm run build -w @kubecon-pq-agent/embeddings && npm run build -w @kubecon-pq-agent/ingest \
 && MODEL_CACHE_DIR=/app/.model-cache node -e "import('@kubecon-pq-agent/embeddings').then(async (m) => { await new m.LocalEmbedder().embed(['warm']); })" \
 && npm prune --omit=dev && mkdir -p apps/ingest/node_modules

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
USER 10001:10001
COPY --from=build --chown=10001:10001 /app/node_modules node_modules
COPY --from=build --chown=10001:10001 /app/apps/ingest/node_modules apps/ingest/node_modules
COPY --from=build --chown=10001:10001 /app/packages/es-client/package.json packages/es-client/package.json
COPY --from=build --chown=10001:10001 /app/packages/es-client/dist packages/es-client/dist
COPY --from=build --chown=10001:10001 /app/packages/embeddings/package.json packages/embeddings/package.json
COPY --from=build --chown=10001:10001 /app/packages/embeddings/dist packages/embeddings/dist
# Model weights baked in so the Job needs no internet and no key.
COPY --from=build --chown=10001:10001 /app/.model-cache /app/.model-cache
ENV MODEL_CACHE_DIR=/app/.model-cache MODEL_OFFLINE=1
COPY --from=build --chown=10001:10001 /app/apps/ingest/package.json apps/ingest/package.json
COPY --from=build --chown=10001:10001 /app/apps/ingest/dist apps/ingest/dist
COPY --chown=10001:10001 fixtures fixtures
ENTRYPOINT ["node", "apps/ingest/dist/main.js"]
