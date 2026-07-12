# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV AUDIT_STORE_PATH=/app/data/audit-log.jsonl
COPY package.json package-lock.json* .npmrc ./
RUN npm ci
COPY --from=builder /app/dist ./dist
COPY server.ts yjsServer.ts auditStore.ts firebaseAdmin.ts ./
RUN mkdir -p /app/data
VOLUME ["/app/data"]
EXPOSE 3010
CMD ["npx", "tsx", "server.ts"]
