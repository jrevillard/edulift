#!/bin/bash

# EduLift Setup Script
set -e

echo "🚀 Setting up EduLift application..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Determine Docker Compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

echo "✅ Using Docker Compose command: $DOCKER_COMPOSE"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration before running the application"
else
    echo "✅ .env file already exists"
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p backend/uploads
mkdir -p logs
mkdir -p backups

# Set proper permissions
chmod +x scripts/*.sh

# Stop any existing containers
echo "🛑 Stopping any existing containers..."
$DOCKER_COMPOSE down 2>/dev/null || true
$DOCKER_COMPOSE -f docker-compose.dev.yml down 2>/dev/null || true

echo "✅ Setup completed!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Run './scripts/deploy.sh' for production deployment"
echo "3. Or run './scripts/dev.sh' for development environment"
echo ""
echo "Access your application at:"
echo "- Frontend: http://localhost:3000"
echo "- Backend API: http://localhost:3001"