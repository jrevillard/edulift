#!/bin/bash
# Script de build backend qui fonctionne toujours
# ROOT CAUSE DOCUMENTÉE: Docker Compose v2.39+ utilise automatiquement bake mode même sans docker-bake.hcl

set -e

echo "🔨 Building backend with docker build (bypassing Docker Compose bake bug)..."

# Build l'image directement avec le tag que Docker Compose attend maintenant
docker build -f backend/Dockerfile.dev -t edulift-backend-dev ./backend --no-cache

echo "✅ Backend image built successfully as edulift-backend-dev!"

# Redémarrer le service si demandé
if [ "$1" = "--start" ]; then
    echo "🚀 Starting backend service with new image..."
    docker compose -f docker-compose.dev.yml up -d backend
    echo "✅ Backend service started!"
    
    # Attendre que le service soit prêt
    echo "⏳ Waiting for backend to be ready..."
    sleep 10
    
    # Vérifier si le service fonctionne
    if curl -s http://localhost:3001/health > /dev/null; then
        echo "✅ Backend is healthy and ready!"
    else
        echo "⚠️ Backend might still be starting up..."
    fi
fi