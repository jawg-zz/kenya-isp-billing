#!/bin/sh
set -e

echo "🔄 Running Prisma migrations..."
npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss

echo "🌱 Seeding database..."
npx tsx src/utils/seed.ts || echo "⚠️ Seed skipped (likely already done)"

echo "🚀 Starting API server..."
exec node dist/server.js
