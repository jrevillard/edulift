#!/bin/bash

# EduLift DevContainer Setup Script
# Installs all E2E testing dependencies with node privileges

set -e

# Switch to node user for remaining operations
echo "👤 Switching to node user for application setup..."

# Navigate to workspace
cd /workspace

# Install root dependencies if package.json exists
if [ -f "package.json" ]; then
    echo "📦 Installing root dependencies..."
    npm install
fi

# Install backend dependencies
if [ -d "backend" ] && [ -f "backend/package.json" ]; then
    echo "🔧 Installing backend dependencies..."
    cd backend
    npm install
    cd ..
fi

# Install frontend dependencies
if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
    echo "🎨 Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
fi

# Install E2E dependencies and browsers
if [ -d "e2e" ] && [ -f "e2e/package.json" ]; then
    echo "🧪 Installing E2E dependencies..."
    cd e2e
    npm install

    echo "🎭 Installing Playwright browsers..."
    # Force installation to /ms-playwright for compatibility
    export PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
    npx --yes playwright install

    cd ..
else
    echo "❌ E2E directory not found."
fi

# Install uvx
curl -LsSf https://astral.sh/uv/install.sh | sh

echo "✅ DevContainer setup completed successfully!"
echo ""
