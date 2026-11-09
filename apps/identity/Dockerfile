# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/otel/package.json packages/otel/
COPY packages/schema/package.json packages/schema/
COPY apps/identity/package.json apps/identity/
RUN npm ci --no-audit --no-fund --workspace @kubecon-pq-agent/identity --include-workspace-root
COPY packages/otel packages/otel
COPY packages/schema packages/schema
COPY apps/identity apps/identity
RUN npm run build -w @kubecon-pq-agent/otel && npm run build -w @kubecon-pq-agent/schema && npm run build -w @kubecon-pq-agent/identity && npm prune --omit=dev && mkdir -p apps/identity/node_modules

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8082
USER 10001:10001
COPY --from=build --chown=10001:10001 /app/node_modules node_modules
COPY --from=build --chown=10001:10001 /app/packages/otel/package.json packages/otel/package.json
COPY --from=build --chown=10001:10001 /app/packages/otel/dist packages/otel/dist
COPY --from=build --chown=10001:10001 /app/apps/identity/node_modules apps/identity/node_modules
COPY --from=build --chown=10001:10001 /app/packages/schema/package.json packages/schema/package.json
COPY --from=build --chown=10001:10001 /app/packages/schema/dist packages/schema/dist
COPY --from=build --chown=10001:10001 /app/apps/identity/package.json apps/identity/package.json
COPY --from=build --chown=10001:10001 /app/apps/identity/dist apps/identity/dist
EXPOSE 8082
WORKDIR /app/apps/identity
CMD ["node", "--import", "@kubecon-pq-agent/otel/register", "dist/server.js"]
