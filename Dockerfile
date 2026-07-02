# Stage 1: install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --fetch-timeout=300000 --fetch-retry-mintimeout=20000 --fetch-retries=5

# Stage 2: build
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Inject pre-built Prisma client (avoids downloading from binaries.prisma.sh)
COPY docker-engines/prisma-client/ ./node_modules/.prisma/client/
COPY docker-engines/libquery_engine-linux-musl-openssl-3.0.x.so.node \
     ./node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node
COPY docker-engines/schema-engine-linux-musl-openssl-3.0.x /usr/local/bin/schema-engine
RUN chmod +x /usr/local/bin/schema-engine

# Build — skip prisma generate (client already injected above)
RUN npx next build && \
    mkdir -p .next/standalone/node_modules/.prisma/client && \
    cp -r node_modules/.prisma/client/. .next/standalone/node_modules/.prisma/client/

# Stage 3: production runner
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /usr/local/bin/schema-engine /usr/local/bin/schema-engine

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
