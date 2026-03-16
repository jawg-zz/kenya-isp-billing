#!/bin/sh

echo "🚀 Starting API server (migrations in background)..."

# Run migrations + seed in background, don't block startup
(
  echo "🔄 Running Prisma migrations..."
  npx prisma migrate deploy 2>&1 || npx prisma db push --accept-data-loss 2>&1
  
  echo "🌱 Seeding database..."
  npx tsx src/utils/seed.ts 2>&1 || echo "⚠️ Seed failed or already done"
) &

# Start server immediately
exec node dist/server.js
