#!/bin/bash

# EduLift Development Debug Script
set -e

echo "🔍 Debugging EduLift development environment..."

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
fi

# Validate Docker Compose file
echo "📋 Validating Docker Compose configuration..."
$DOCKER_COMPOSE -f docker-compose.dev.yml config > /dev/null
echo "✅ Docker Compose configuration is valid"

# Stop existing containers
echo "🛑 Stopping any existing containers..."
$DOCKER_COMPOSE down 2>/dev/null || true
$DOCKER_COMPOSE -f docker-compose.dev.yml down 2>/dev/null || true

# Clean up any dangling containers
echo "🧹 Cleaning up..."
docker system prune -f >/dev/null 2>&1 || true

# Start development environment
echo "🚀 Starting development containers..."
$DOCKER_COMPOSE -f docker-compose.dev.yml up -d

# Show container status immediately
echo ""
echo "📊 Container status after startup:"
$DOCKER_COMPOSE -f docker-compose.dev.yml ps

# Wait and check database readiness step by step
echo ""
echo "🔍 Checking database readiness..."
for i in {1..30}; do
    echo "Attempt $i/30:"
    
    # Check if postgres container is running
    if ! $DOCKER_COMPOSE -f docker-compose.dev.yml ps postgres | grep -q "Up"; then
        echo "  ❌ Postgres container is not running"
        $DOCKER_COMPOSE -f docker-compose.dev.yml logs postgres | tail -10
        sleep 3
        continue
    fi
    
    # Check if we can connect to postgres
    if $DOCKER_COMPOSE -f docker-compose.dev.yml exec -T postgres pg_isready -U edulift -d edulift_dev >/dev/null 2>&1; then
        echo "  ✅ Database is ready!"
        break
    else
        echo "  ⏳ Database not ready yet..."
        if [ $i -eq 30 ]; then
            echo "❌ Database failed to become ready. Showing logs:"
            $DOCKER_COMPOSE -f docker-compose.dev.yml logs postgres
            exit 1
        fi
        sleep 3
    fi
done

# Check backend container
echo ""
echo "🔍 Checking backend readiness..."
for i in {1..20}; do
    echo "Attempt $i/20:"
    
    if $DOCKER_COMPOSE -f docker-compose.dev.yml ps backend | grep -q "Up"; then
        echo "  ✅ Backend container is running!"
        break
    else
        echo "  ⏳ Backend container not ready yet..."
        if [ $i -eq 20 ]; then
            echo "❌ Backend failed to start. Showing logs:"
            $DOCKER_COMPOSE -f docker-compose.dev.yml logs backend
            exit 1
        fi
        sleep 3
    fi
done

echo ""
echo "📊 Final container status:"
$DOCKER_COMPOSE -f docker-compose.dev.yml ps

echo ""
echo "📜 Recent logs from all services:"
echo "--- Postgres logs ---"
$DOCKER_COMPOSE -f docker-compose.dev.yml logs --tail=10 postgres
echo ""
echo "--- Redis logs ---"
$DOCKER_COMPOSE -f docker-compose.dev.yml logs --tail=10 redis
echo ""
echo "--- Backend logs ---"
$DOCKER_COMPOSE -f docker-compose.dev.yml logs --tail=10 backend

echo ""
echo "✅ Debug complete. If containers are running, try running migrations manually:"
echo "$DOCKER_COMPOSE -f docker-compose.dev.yml exec backend npx prisma migrate dev --name init"