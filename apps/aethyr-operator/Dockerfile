# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/schema/package.json packages/schema/
COPY apps/aethyr-operator/package.json apps/aethyr-operator/
RUN npm ci --no-audit --no-fund --workspace @kubecon-pq-agent/aethyr-operator --include-workspace-root
COPY packages/schema packages/schema
COPY apps/aethyr-operator apps/aethyr-operator
RUN npm run build -w @kubecon-pq-agent/schema && npm run build -w @kubecon-pq-agent/aethyr-operator && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
USER 10001:10001
COPY --from=build --chown=10001:10001 /app/node_modules node_modules
COPY --from=build --chown=10001:10001 /app/packages/schema/package.json packages/schema/package.json
COPY --from=build --chown=10001:10001 /app/packages/schema/dist packages/schema/dist
COPY --from=build --chown=10001:10001 /app/apps/aethyr-operator/package.json apps/aethyr-operator/package.json
COPY --from=build --chown=10001:10001 /app/apps/aethyr-operator/dist apps/aethyr-operator/dist
WORKDIR /app/apps/aethyr-operator
CMD ["node", "dist/main.js"]
