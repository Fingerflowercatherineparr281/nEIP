# =============================================================================
# Dockerfile.app — nEIP API server
# Multi-stage build: install → build → run
# =============================================================================

# ---------------- Stage 1: dependency install --------------------------------
FROM node:22-alpine AS deps

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests — leverages layer cache when deps don't change
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json      ./packages/db/
COPY packages/core/package.json    ./packages/core/
COPY apps/api/package.json         ./apps/api/

RUN pnpm install --frozen-lockfile

# ---------------- Stage 2: build --------------------------------------------
FROM deps AS builder

WORKDIR /app

# Copy all source files
COPY tsconfig.base.json tsconfig.json turbo.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Build the API and its dependencies in topological order
RUN pnpm --filter @neip/shared build
RUN pnpm --filter @neip/db    build
RUN pnpm --filter @neip/core  build
RUN pnpm --filter api          build

# ---------------- Stage 3: runtime ------------------------------------------
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

ENV NODE_ENV=production

# Copy only what is needed to run
COPY --from=builder /app/pnpm-workspace.yaml  ./
COPY --from=builder /app/pnpm-lock.yaml       ./
COPY --from=builder /app/package.json         ./

COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist         ./packages/shared/dist/

COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/db/dist         ./packages/db/dist/
COPY --from=builder /app/packages/db/migrations   ./packages/db/migrations/
COPY --from=builder /app/packages/db/drizzle.config.ts ./packages/db/

COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/core/dist         ./packages/core/dist/

COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist         ./apps/api/dist/

RUN pnpm install --frozen-lockfile --prod

COPY docker/entrypoint.app.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 5400

ENTRYPOINT ["/entrypoint.sh"]
