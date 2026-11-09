# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/es-client/package.json packages/es-client/
COPY packages/embeddings/package.json packages/embeddings/
COPY apps/api/package.json apps/api/
RUN npm ci --no-audit --no-fund
COPY packages/es-client packages/es-client
COPY packages/embeddings packages/embeddings
COPY apps/api apps/api
RUN npm run build -w @kubecon-pq-agent/es-client && npm run build -w @kubecon-pq-agent/embeddings && npm run build -w @kubecon-pq-agent/api \
 && MODEL_CACHE_DIR=/app/.model-cache node -e "import('@kubecon-pq-agent/embeddings').then(async (m) => { await new m.LocalEmbedder().embed(['warm']); })" \
 && npm prune --omit=dev && mkdir -p apps/api/node_modules

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 MODEL_CACHE_DIR=/app/.model-cache MODEL_OFFLINE=1
USER 10001:10001
COPY --from=build --chown=10001:10001 /app/node_modules node_modules
COPY --from=build --chown=10001:10001 /app/apps/api/node_modules apps/api/node_modules
COPY --from=build --chown=10001:10001 /app/packages/es-client/package.json packages/es-client/package.json
COPY --from=build --chown=10001:10001 /app/packages/es-client/dist packages/es-client/dist
COPY --from=build --chown=10001:10001 /app/packages/embeddings/package.json packages/embeddings/package.json
COPY --from=build --chown=10001:10001 /app/packages/embeddings/dist packages/embeddings/dist
COPY --from=build --chown=10001:10001 /app/apps/api/package.json apps/api/package.json
COPY --from=build --chown=10001:10001 /app/apps/api/dist apps/api/dist
COPY --from=build --chown=10001:10001 /app/.model-cache /app/.model-cache
EXPOSE 8080
WORKDIR /app/apps/api
CMD ["node", "--import", "./dist/otel.js", "dist/server.js"]
