#!/bin/sh

echo "🔄 Running Prisma migrations..."
npx prisma migrate deploy 2>&1 || npx prisma db push --accept-data-loss 2>&1

echo "🌱 Seeding database..."
node dist/utils/seed.js 2>&1 || echo "⚠️ Seed skipped"

echo "🚀 Starting server..."
exec node dist/server.js
