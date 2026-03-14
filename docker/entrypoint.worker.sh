#!/bin/sh
# =============================================================================
# entrypoint.worker.sh — run DB migrations then start the worker process
# =============================================================================
set -e

echo "[nEIP:worker] Running database migrations..."
cd /app/packages/db
pnpm db:migrate

echo "[nEIP:worker] Migrations complete. Starting worker..."
cd /app
exec node apps/worker/dist/index.js
