#!/bin/bash

# EduLift Production Deployment Script

set -e

echo "🚀 Starting EduLift Production Deployment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if .env.prod exists
if [ ! -f ".env.prod" ]; then
    echo "❌ .env.prod file not found. Please create it first."
    exit 1
fi

echo "📋 Using production environment file: .env.prod"

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker compose -f docker-compose.prod.yml --env-file .env.prod down

# Remove old images (optional - uncomment if you want to rebuild from scratch)
# echo "🗑️  Removing old images..."
# docker compose -f docker-compose.prod.yml --env-file .env.prod down --rmi all

# Pull latest images and build
echo "🔨 Building and starting services..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service status
echo "🏥 Checking service health..."
docker compose -f docker-compose.prod.yml --env-file .env.prod ps

# Show logs
echo "📋 Service logs (last 20 lines):"
docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail=20

echo ""
echo "✅ Deployment completed!"
echo ""
echo "🌐 Your application should be accessible at:"
echo "   External: http://revillard.freeboxos.fr:49153"
echo "   Local:    http://localhost:6000"
echo ""
echo "🔧 Useful commands:"
echo "   View logs:    docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f [service]"
echo "   Stop all:     docker compose -f docker-compose.prod.yml --env-file .env.prod down"
echo "   Restart:      docker compose -f docker-compose.prod.yml --env-file .env.prod restart [service]"
echo ""
