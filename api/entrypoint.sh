#!/bin/sh

echo "🔄 Setting up database schema..."
# Use db push for initial setup (no migration files needed)
# This will create/update schema to match prisma/schema.prisma
npx prisma db push --accept-data-loss --skip-generate 2>&1

if [ $? -ne 0 ]; then
  echo "❌ Database setup failed"
  exit 1
fi

echo "🌱 Seeding database..."
node dist/utils/seed.js 2>&1 || echo "⚠️ Seed skipped (may already be seeded)"

echo "🚀 Starting server..."
exec node dist/server.js
