FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
ARG DATABASE_URL=postgresql://postgres:postgres@postgres:5432/platform
RUN npm install -f
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/ws ./node_modules/ws
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/jose ./node_modules/jose
COPY --from=builder --chown=nextjs:nodejs /app/scripts/chat-ws-server.mjs ./scripts/chat-ws-server.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/start-production.mjs ./scripts/start-production.mjs

# STORAGE_DRIVER=local пишет в /app/uploads. Каталог создаём заранее и отдаём nextjs:
# том, смонтированный на несуществующий путь, docker создаёт от root, и запись падает с EACCES.
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

USER nextjs
EXPOSE 3000 3001
ENV PORT=3000
ENV CHAT_WS_PORT=3001
CMD ["node", "scripts/start-production.mjs"]
