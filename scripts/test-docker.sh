#!/bin/bash

# EduLift Docker Test Script
set -e

echo "🧪 Testing Docker setup for EduLift..."

# Determine Docker Compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

echo "✅ Using Docker Compose command: $DOCKER_COMPOSE"

# Test Docker Compose file syntax
echo "📋 Validating Docker Compose configuration..."
$DOCKER_COMPOSE config > /dev/null
echo "✅ Docker Compose configuration is valid"

# Test if we can build the images
echo "🔨 Testing Docker image builds..."

# Test backend build
echo "  📦 Testing backend build..."
cd backend
docker build -f Dockerfile . -t edulift-backend-test > /dev/null
echo "  ✅ Backend image builds successfully"

# Test frontend build
echo "  📦 Testing frontend build..."
cd ../frontend
docker build -f Dockerfile . -t edulift-frontend-test > /dev/null
echo "  ✅ Frontend image builds successfully"

cd ..

# Clean up test images
echo "🧹 Cleaning up test images..."
docker rmi edulift-backend-test edulift-frontend-test > /dev/null 2>&1 || true

echo "✅ All Docker tests passed!"
echo ""
echo "You can now run:"
echo "  ./scripts/setup.sh    - Initial setup"
echo "  ./scripts/deploy.sh   - Production deployment"
echo "  ./scripts/dev.sh      - Development environment"