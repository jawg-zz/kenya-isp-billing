#!/bin/sh

echo "🚀 Starting API server..."

# Run migrations + seed as root (before switching to nextjs user)
echo "🔄 Running Prisma migrations..."
npx prisma migrate deploy 2>&1 || npx prisma db push --accept-data-loss 2>&1

echo "🌱 Seeding database..."
node dist/utils/seed.js 2>&1 || echo "⚠️ Seed skipped (likely already done)"

# Start server as nextjs user
echo "🚀 Starting server..."
exec su -s /bin/sh -c "node dist/server.js" nextjs
