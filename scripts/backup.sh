#!/bin/bash

# EduLift Database Backup Script
set -e

# Configuration
BACKUP_DIR="/workspace/eduLift/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="edulift-postgres-prod"
DB_NAME="${POSTGRES_DB:-edulift}"
DB_USER="${POSTGRES_USER:-edulift}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "🗂️  Starting database backup..."

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "❌ Database container $CONTAINER_NAME is not running"
    exit 1
fi

# Create backup
BACKUP_FILE="$BACKUP_DIR/edulift_backup_$TIMESTAMP.sql"

echo "📦 Creating backup: $BACKUP_FILE"
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"

# Compress backup
echo "🗜️  Compressing backup..."
gzip "$BACKUP_FILE"
BACKUP_FILE="$BACKUP_FILE.gz"

# Verify backup
if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup completed successfully: $BACKUP_FILE ($SIZE)"
else
    echo "❌ Backup failed"
    exit 1
fi

# Clean up old backups (keep last 7 days)
echo "🧹 Cleaning up old backups..."
find "$BACKUP_DIR" -name "edulift_backup_*.sql.gz" -mtime +7 -delete

echo "📊 Current backups:"
ls -lah "$BACKUP_DIR"/edulift_backup_*.sql.gz 2>/dev/null || echo "No backups found"

echo "✅ Backup process completed!"