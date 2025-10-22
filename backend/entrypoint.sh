#!/bin/sh
set -e

echo "Starting backend..."

# Simply run migrate deploy - it handles everything:
# - Empty database: Creates all tables from migrations
# - Existing database: Applies only new migrations
# - Already up-to-date: Does nothing

echo "🔄 Applying database migrations..."
npx prisma migrate deploy

echo "✅ Database ready, starting server..."
exec node dist/server.js