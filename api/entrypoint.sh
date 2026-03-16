#!/bin/sh

echo "🔄 Syncing database schema..."
npx prisma db push --accept-data-loss 2>&1

echo "🌱 Seeding database..."
node dist/utils/seed.js 2>&1 || echo "⚠️ Seed skipped"

echo "🚀 Starting server..."
exec node dist/server.js
