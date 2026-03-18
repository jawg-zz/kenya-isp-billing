#!/bin/sh

echo "🔄 Running database migrations..."
# Use 'migrate deploy' for production-safe migrations (applies pending migrations only)
# For development use, uncomment: npx prisma db push --accept-data-loss
npx prisma migrate deploy 2>&1

echo "🌱 Seeding database..."
node dist/utils/seed.js 2>&1 || echo "⚠️ Seed skipped"

echo "🚀 Starting server..."
exec node dist/server.js
