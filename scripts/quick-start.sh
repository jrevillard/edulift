#!/bin/bash

# EduLift Quick Start Script
set -e

clear
echo "🚀 EduLift Quick Start"
echo "====================="
echo ""

# Determine Docker Compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "❌ Docker Compose not found. Please install Docker and Docker Compose first."
    echo ""
    echo "Installation guides:"
    echo "- Docker: https://docs.docker.com/get-docker/"
    echo "- Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Found Docker Compose: $DOCKER_COMPOSE"

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Setting up development environment configuration..."
    cp .env.dev .env
    echo "✅ Created .env file from development template"
else
    echo "✅ Environment file already exists"
fi

# Clean start
echo "🧹 Cleaning up any existing containers..."
$DOCKER_COMPOSE down 2>/dev/null || true
$DOCKER_COMPOSE -f docker-compose.dev.yml down 2>/dev/null || true

echo "🚀 Starting development environment..."
$DOCKER_COMPOSE -f docker-compose.dev.yml up -d

echo "⏳ Waiting for services to start (this may take a minute)..."
sleep 20

# Simple check
if $DOCKER_COMPOSE -f docker-compose.dev.yml ps | grep -q "Up"; then
    echo "✅ Services are starting up!"
    
    echo ""
    echo "📊 Container Status:"
    $DOCKER_COMPOSE -f docker-compose.dev.yml ps
    
    echo ""
    echo "🎉 EduLift is starting up!"
    echo ""
    echo "📱 Next steps:"
    echo "1. Wait for all containers to be healthy (check with: docker compose -f docker-compose.dev.yml ps)"
    echo "2. Run migrations if needed: docker compose -f docker-compose.dev.yml exec backend npx prisma migrate dev"
    echo "3. Start frontend: cd frontend && npm install && npm run dev"
    echo ""
    echo "🌐 URLs:"
    echo "- Backend: http://localhost:3001"
    echo "- Frontend: http://localhost:3000 (after starting frontend)"
    echo ""
    echo "📜 View logs: $DOCKER_COMPOSE -f docker-compose.dev.yml logs -f"
    echo "🛑 Stop services: $DOCKER_COMPOSE -f docker-compose.dev.yml down"
    
else
    echo "❌ Some services failed to start. Running detailed setup..."
    echo ""
    exec ./scripts/dev.sh
fi