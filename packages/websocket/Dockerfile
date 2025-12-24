FROM node:20-alpine AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/websocket/package.json ./packages/websocket/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/websocket/node_modules ./packages/websocket/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN pnpm --filter @chatwidget/shared build
RUN pnpm --filter @chatwidget/websocket build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/packages/websocket/dist ./packages/websocket/dist
COPY --from=builder /app/packages/websocket/package.json ./packages/websocket/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/websocket/node_modules ./packages/websocket/node_modules

WORKDIR /app/packages/websocket
EXPOSE 3001
CMD ["node", "dist/index.js"]

