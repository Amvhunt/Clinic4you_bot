#!/bin/bash
# Start development environment

set -e

echo "🚀 Starting Clinic Bot development environment..."

# Check if .env file exists
if [ ! -f .env ]; then
  echo "⚠️  .env file not found. Copying from .env.example..."
  cp .env.example .env
  echo "📝 Please update .env with your actual values"
fi

# Create logs directory
mkdir -p logs

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Run database migrations
echo "🗄️  Running database migrations..."
npm run db:migrate --workspace=database

# Start Docker containers
echo "🐳 Starting Docker containers..."
docker-compose -f docker/docker-compose.yml up -d

# Show status
echo ""
echo "✅ Development environment started!"
echo ""
echo "Services:"
echo "  - Bot API:     http://localhost:3000"
echo "  - Database:    postgresql://clinic_user:clinic_password@localhost:5432/clinic_bot"
echo "  - Redis:       redis://localhost:6379"
echo ""
echo "View logs: docker-compose -f docker/docker-compose.yml logs -f"
