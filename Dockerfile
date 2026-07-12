# syntax=docker/dockerfile:1

# Full install once — reused by the build stage (avoids duplicate 10+ min npm ci).
FROM node:22-alpine AS deps
WORKDIR /app
ENV NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package.json package-lock.json* .npmrc ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production runtime deps only (+ tsx to run server.ts).
FROM node:22-alpine AS prod-deps
WORKDIR /app
ENV NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package.json package-lock.json* .npmrc ./
RUN npm ci --omit=dev && npm install tsx --no-save

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    AUDIT_STORE_PATH=/app/data/audit-log.jsonl
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY server.ts yjsServer.ts auditStore.ts firebaseAdmin.ts ./
RUN mkdir -p /app/data
VOLUME ["/app/data"]
EXPOSE 3010
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3010}/api/health" || exit 1
CMD ["npx", "tsx", "server.ts"]
