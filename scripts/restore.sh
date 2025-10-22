#!/bin/bash

# EduLift Database Restore Script
set -e

# Configuration
BACKUP_DIR="/workspace/eduLift/backups"
CONTAINER_NAME="edulift-postgres-prod"
DB_NAME="${POSTGRES_DB:-edulift}"
DB_USER="${POSTGRES_USER:-edulift}"

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "❌ Please provide backup file name"
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    ls -1 "$BACKUP_DIR"/edulift_backup_*.sql.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$BACKUP_DIR/$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "🔄 Starting database restore from: $BACKUP_FILE"

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "❌ Database container $CONTAINER_NAME is not running"
    exit 1
fi

# Confirm restore
read -p "⚠️  This will overwrite the current database. Are you sure? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Restore cancelled"
    exit 1
fi

# Stop backend to prevent connections
echo "🛑 Stopping backend service..."
docker-compose stop backend

# Drop existing database
echo "🗑️  Dropping existing database..."
docker exec "$CONTAINER_NAME" dropdb -U "$DB_USER" "$DB_NAME" || true

# Create new database
echo "📝 Creating new database..."
docker exec "$CONTAINER_NAME" createdb -U "$DB_USER" "$DB_NAME"

# Restore database
echo "📥 Restoring database..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
    zcat "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" "$DB_NAME"
else
    docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" "$DB_NAME" < "$BACKUP_FILE"
fi

# Restart backend
echo "🚀 Starting backend service..."
docker-compose start backend

# Wait for backend to be healthy
echo "⏳ Waiting for backend to be ready..."
timeout 60s bash -c 'until docker-compose ps | grep backend | grep -q healthy; do sleep 5; done'

echo "✅ Database restore completed successfully!"
echo "🔄 You may want to run migrations to ensure schema is up to date:"
echo "docker-compose exec backend npx prisma migrate deploy"