#!/bin/bash

# EduLift Development Environment Script
set -e

echo "🛠️  Starting EduLift development environment..."

# Determine Docker Compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

echo "✅ Using Docker Compose command: $DOCKER_COMPOSE"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from development template..."
    cp .env.dev .env
    echo "✅ Created development environment configuration"
fi

# Stop existing containers
echo "🛑 Stopping any existing containers..."
$DOCKER_COMPOSE down 2>/dev/null || true
$DOCKER_COMPOSE -f docker-compose.dev.yml down 2>/dev/null || true

# Start development environment
echo "🚀 Starting development containers..."
$DOCKER_COMPOSE -f docker-compose.dev.yml up --build -d

# Show initial status
echo "📊 Initial container status:"
$DOCKER_COMPOSE -f docker-compose.dev.yml ps

# Wait for database to be ready with detailed feedback
echo "⏳ Waiting for database to be ready..."
database_ready=false
for i in {1..40}; do
    if $DOCKER_COMPOSE -f docker-compose.dev.yml exec -T postgres pg_isready -U edulift -d edulift_dev >/dev/null 2>&1; then
        echo "✅ Database is ready!"
        database_ready=true
        break
    else
        printf "   Attempt $i/40: Database not ready yet...\r"
        sleep 3
    fi
done

if [ "$database_ready" = false ]; then
    echo ""
    echo "❌ Database failed to start within expected time. Checking logs..."
    $DOCKER_COMPOSE -f docker-compose.dev.yml logs postgres | tail -20
    echo ""
    echo "💡 Try running: ./scripts/debug-dev.sh for more detailed debugging"
    exit 1
fi

# Wait for backend container to be ready
echo "⏳ Waiting for backend container to be ready..."
backend_ready=false
for i in {1..30}; do
    if $DOCKER_COMPOSE -f docker-compose.dev.yml ps backend | grep -q "Up"; then
        echo "✅ Backend container is ready!"
        backend_ready=true
        break
    else
        printf "   Attempt $i/30: Backend not ready yet...\r"
        sleep 1
    fi
done

if [ "$backend_ready" = false ]; then
    echo ""
    echo "❌ Backend failed to start within expected time. Checking logs..."
    $DOCKER_COMPOSE -f docker-compose.dev.yml logs backend | tail -20
    echo ""
    echo "💡 Try running: ./scripts/debug-dev.sh for more detailed debugging"
    exit 1
fi

# Give backend a moment to fully initialize
echo "⏳ Giving backend time to initialize..."
sleep 10

# Try to run migrations with better error handling
echo "🔄 Running database migrations..."
migration_success=false

# First, try the normal migration
if $DOCKER_COMPOSE -f docker-compose.dev.yml exec -T backend npx prisma migrate dev --name init >/dev/null 2>&1; then
    echo "✅ Database migrations completed successfully!"
    migration_success=true
else
    echo "⚠️  Initial migration failed. Checking migration status..."
    
    # Check if it's just because migrations already exist
    if $DOCKER_COMPOSE -f docker-compose.dev.yml exec -T backend npx prisma migrate status >/dev/null 2>&1; then
        echo "✅ Database migrations are already up to date!"
        migration_success=true
    else
        echo "⚠️  Migration issues detected. Database may need to be reset."
        echo "🔄 Attempting to generate Prisma client..."
        if $DOCKER_COMPOSE -f docker-compose.dev.yml exec -T backend npx prisma generate >/dev/null 2>&1; then
            echo "✅ Prisma client generated successfully!"
            migration_success=true
        fi
    fi
fi

echo ""
echo "✅ Development environment is ready!"
echo ""
echo "📊 Final container status:"
$DOCKER_COMPOSE -f docker-compose.dev.yml ps

echo ""
echo "🌐 Services running:"
echo "   - Backend: http://localhost:3001 (with hot reload)"
echo "   - Database: localhost:5432"
echo "   - Redis: localhost:6379"

if [ "$migration_success" = false ]; then
    echo ""
    echo "⚠️  Note: Migrations had issues. You may need to run manually:"
    echo "   $DOCKER_COMPOSE -f docker-compose.dev.yml exec backend npx prisma migrate dev --name init"
    echo "   or reset the database:"
    echo "   $DOCKER_COMPOSE -f docker-compose.dev.yml exec backend npx prisma migrate reset --force"
fi

echo ""
echo "📱 For frontend development, run in a separate terminal:"
echo "   cd frontend && npm install && npm run dev"

echo ""
echo "🔧 Useful commands:"
echo "   - View all logs: $DOCKER_COMPOSE -f docker-compose.dev.yml logs -f"
echo "   - View backend logs: $DOCKER_COMPOSE -f docker-compose.dev.yml logs -f backend"
echo "   - Restart backend: $DOCKER_COMPOSE -f docker-compose.dev.yml restart backend"
echo "   - Stop environment: $DOCKER_COMPOSE -f docker-compose.dev.yml down"
echo "   - Debug issues: ./scripts/debug-dev.sh"

echo ""
echo "🎉 Happy coding!"