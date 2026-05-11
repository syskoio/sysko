FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/storage/package.json  packages/storage/
COPY packages/transport/package.json packages/transport/
COPY packages/dashboard/package.json packages/dashboard/
COPY packages/collector/package.json packages/collector/

RUN pnpm install --frozen-lockfile

COPY packages/ packages/

RUN pnpm build --filter @sysko/collector...

# ─── runtime ──────────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

RUN corepack enable

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/storage/package.json  packages/storage/
COPY --from=builder /app/packages/transport/package.json packages/transport/
COPY --from=builder /app/packages/dashboard/package.json packages/dashboard/
COPY --from=builder /app/packages/collector/package.json packages/collector/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/storage/dist   packages/storage/dist
COPY --from=builder /app/packages/transport/dist  packages/transport/dist
COPY --from=builder /app/packages/dashboard/dist  packages/dashboard/dist
COPY --from=builder /app/packages/dashboard/dist-client packages/dashboard/dist-client
COPY --from=builder /app/packages/collector/dist  packages/collector/dist

EXPOSE 9999
VOLUME ["/root/.sysko"]

ENV HOST=0.0.0.0
ENV PORT=9999

CMD ["node", "packages/collector/dist/cli.js"]
