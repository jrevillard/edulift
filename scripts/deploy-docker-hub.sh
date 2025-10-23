#!/bin/bash

# Deployment script using Docker Hub images
# Usage: ./scripts/deploy-docker-hub.sh [staging|production]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
ENVIRONMENT=${1:-staging}
DOCKER_USERNAME="jrevillard"
COMPOSE_PROJECT_NAME="edulift-${ENVIRONMENT}"

echo -e "${BLUE}🚀 EduLift Deployment - Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}============================================${NC}"

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo -e "${RED}Docker is not installed. Aborting.${NC}" >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo -e "${RED}Docker Compose is not installed. Aborting.${NC}" >&2; exit 1; }

# Determine which docker-compose file to use
if [ "$ENVIRONMENT" = "production" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
    echo -e "${YELLOW}⚠️  WARNING: PRODUCTION DEPLOYMENT${NC}"
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Deployment cancelled.${NC}"
        exit 1
    fi
else
    COMPOSE_FILE="docker-compose.dev.yml"
fi

# Check if docker-compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}Error: File $COMPOSE_FILE does not exist.${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}No .env file detected. You can copy .env.docker-hub.example to .env${NC}"
    if [ -f ".env.docker-hub.example" ]; then
        read -p "Do you want to copy .env.docker-hub.example to .env? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cp .env.docker-hub.example .env
            echo -e "${GREEN}.env file created. Please edit it before continuing.${NC}"
            exit 0
        fi
    fi
fi

echo -e "${BLUE}📦 Pulling latest Docker Hub images...${NC}"

# Pull latest images
docker pull ${DOCKER_USERNAME}/edulift-backend:latest
docker pull ${DOCKER_USERNAME}/edulift-frontend:latest

echo -e "${BLUE}🔄 Restarting services...${NC}"

# Export environment variables for docker-compose
export COMPOSE_PROJECT_NAME

# Stop existing services
docker-compose -f "$COMPOSE_FILE" down --remove-orphans

# Start services with new images
docker-compose -f "$COMPOSE_FILE" up -d

echo -e "${BLUE}⏳ Waiting for services to start...${NC}"
sleep 30

# Check service health
echo -e "${BLUE}🏥 Checking service health...${NC}"

# Function to check service health
check_health() {
    local service=$1
    local url=$2
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✓ $service is operational${NC}"
            return 0
        fi
        echo -e "${YELLOW}Attempt $attempt/$max_attempts: $service is not ready yet...${NC}"
        sleep 10
        ((attempt++))
    done
    
    echo -e "${RED}✗ $service is not operational after $max_attempts attempts${NC}"
    return 1
}

# Check services
HEALTH_OK=true

if ! check_health "Backend" "http://localhost:3001/health"; then
    HEALTH_OK=false
fi

if ! check_health "Frontend" "http://localhost:3000"; then
    HEALTH_OK=false
fi

# Show final status
echo -e "${BLUE}📄 Container status:${NC}"
docker-compose -f "$COMPOSE_FILE" ps

if [ "$HEALTH_OK" = true ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo -e "${BLUE}Frontend accessible at: http://localhost:3000${NC}"
    echo -e "${BLUE}Backend API accessible at: http://localhost:3001${NC}"
else
    echo -e "${RED}❌ Issues detected during deployment${NC}"
    echo -e "${YELLOW}Check logs with: docker-compose -f $COMPOSE_FILE logs${NC}"
    exit 1
fi

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Deployment completed successfully!${NC}"
