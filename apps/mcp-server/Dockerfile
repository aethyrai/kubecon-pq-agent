# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/otel/package.json packages/otel/
COPY apps/mcp-server/package.json apps/mcp-server/
RUN npm ci --no-audit --no-fund --workspace @kubecon-pq-agent/mcp-server --include-workspace-root
COPY packages/otel packages/otel
COPY apps/mcp-server apps/mcp-server
RUN npm run build -w @kubecon-pq-agent/otel && npm run build -w @kubecon-pq-agent/mcp-server && npm prune --omit=dev && mkdir -p apps/mcp-server/node_modules packages/otel/node_modules

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8081
USER 10001:10001
COPY --from=build --chown=10001:10001 /app/node_modules node_modules
COPY --from=build --chown=10001:10001 /app/packages/otel/package.json packages/otel/package.json
COPY --from=build --chown=10001:10001 /app/packages/otel/dist packages/otel/dist
COPY --from=build --chown=10001:10001 /app/packages/otel/node_modules packages/otel/node_modules
COPY --from=build --chown=10001:10001 /app/apps/mcp-server/node_modules apps/mcp-server/node_modules
COPY --from=build --chown=10001:10001 /app/apps/mcp-server/package.json apps/mcp-server/package.json
COPY --from=build --chown=10001:10001 /app/apps/mcp-server/dist apps/mcp-server/dist
EXPOSE 8081
WORKDIR /app/apps/mcp-server
CMD ["node", "--import", "@kubecon-pq-agent/otel/register", "dist/server.js"]
