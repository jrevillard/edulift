#!/bin/bash

# EduLift Production Deployment Script
set -e

echo "🚀 Deploying EduLift to production..."

# Determine Docker Compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please run setup.sh first."
    exit 1
fi

# Load environment variables
source .env

# Check required environment variables
required_vars=("POSTGRES_PASSWORD" "JWT_SECRET")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Required environment variable $var is not set in .env file"
        exit 1
    fi
done

echo "🛑 Stopping existing containers..."
$DOCKER_COMPOSE down

echo "📦 Building Docker images..."
$DOCKER_COMPOSE build --no-cache

echo "🚀 Starting production deployment..."
$DOCKER_COMPOSE up -d

echo "⏳ Waiting for database to be ready..."
timeout 120s bash -c "until $DOCKER_COMPOSE exec -T postgres pg_isready -U edulift -d edulift; do sleep 5; done"

echo "🔄 Running database migrations..."
$DOCKER_COMPOSE exec -T backend npx prisma migrate deploy

echo "⏳ Waiting for all services to be healthy..."
timeout 180s bash -c "
while true; do
    if $DOCKER_COMPOSE ps | grep -E '(backend|frontend)' | grep -v 'healthy\|Up'; then
        echo 'Waiting for services to be healthy...'
        sleep 10
    else
        echo 'All services are ready!'
        break
    fi
done
"

echo "✅ Deployment completed successfully!"
echo ""
echo "Application is running at:"
echo "- Frontend: http://localhost:${FRONTEND_PORT:-3000}"
echo "- Backend API: http://localhost:${BACKEND_PORT:-3001}"
echo ""
echo "To view logs:"
echo "$DOCKER_COMPOSE logs -f"
echo ""
echo "To stop the application:"
echo "$DOCKER_COMPOSE down"