#!/bin/sh
# =============================================================================
# entrypoint.app.sh — run DB migrations then start the API server
# =============================================================================
set -e

echo "[nEIP:app] Running database migrations..."
cd /app/packages/db
pnpm db:migrate

echo "[nEIP:app] Migrations complete. Starting API server..."
cd /app
exec node apps/api/dist/index.js
