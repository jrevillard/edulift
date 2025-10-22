#!/bin/bash

# EduLift Local Development Script (without Docker)
set -e

echo "🛠️  Starting EduLift local development environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your local database configuration"
    echo "⚠️  Make sure PostgreSQL and Redis are running locally"
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "🔄 Running database migrations..."
npx prisma migrate dev --name init

echo "🚀 Starting backend in development mode..."
npm run dev &
BACKEND_PID=$!

# Go back to root directory
cd ..

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install

echo "🚀 Starting frontend in development mode..."
npm run dev &
FRONTEND_PID=$!

# Go back to root directory
cd ..

echo "✅ Local development environment is ready!"
echo ""
echo "Services running:"
echo "- Backend: http://localhost:3001"
echo "- Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup processes
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup INT TERM

# Wait for processes
wait