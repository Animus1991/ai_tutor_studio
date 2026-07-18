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

# Production runtime deps only (server bundle keeps packages external).
FROM node:22-alpine AS prod-deps
WORKDIR /app
ENV NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package.json package-lock.json* .npmrc ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
# Production image. Set REQUIRE_API_AUTH=true and APP_CHECK_ENFORCE=true at deploy
# (see docs/APP_CHECK_AND_API_KEYS.md). Server logs a WARN when either is unset in NODE_ENV=production.
ENV NODE_ENV=production \
    AUDIT_STORE_PATH=/app/data/audit-log.jsonl
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
# Keep source modules for tsx fallback / debugging; primary runtime is the bundle.
COPY --from=builder /app/server ./server
COPY --from=builder /app/server.ts /app/yjsServer.ts /app/auditStore.ts /app/firebaseAdmin.ts ./
COPY --from=builder /app/firebase-applet-config.json ./
COPY --from=builder /app/src/lib/piiSanitizer.ts ./src/lib/piiSanitizer.ts
RUN mkdir -p /app/data /app/src/lib
VOLUME ["/app/data"]
EXPOSE 3010
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3010}/api/health" || exit 1
# Prefer the esbuild bundle (includes server/*). Fallback: npx tsx server.ts
CMD ["node", "dist/server.cjs"]
