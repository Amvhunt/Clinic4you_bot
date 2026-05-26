#!/bin/bash
# Start development environment with automatic cloudflared tunnel

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting Clinic Bot development environment..."

# Check if .env file exists
if [ ! -f .env ]; then
  echo "⚠️  .env file not found. Copying from .env.example..."
  cp .env.example .env
  echo "📝 Please update .env with your actual values"
fi

# Check cloudflared availability
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "❌ cloudflared is not installed. Please install it first."
  exit 1
fi

# Create logs directory
mkdir -p logs

# Install dependencies if needed
if [ ! -d "../node_modules" ]; then
  echo "📦 Installing dependencies..."
  cd ..
  npm install
  cd "$SCRIPT_DIR"
fi

# Start database and redis first
echo "🐳 Starting database and redis..."
docker compose -f docker-compose.yml up -d postgres redis

# Wait for PostgreSQL to become available
printf "Waiting for PostgreSQL..."
for i in {1..30}; do
  if docker compose -f docker-compose.yml exec -T postgres pg_isready -U clinic_user >/dev/null 2>&1; then
    echo " ready"
    break
  fi
  printf "."
  sleep 1
done

# Run database migrations
echo "🗄️  Running database migrations..."
cd ..
DATABASE_URL="postgresql://clinic_user:clinic_password@localhost:5432/clinic_bot" npm run db:migrate --workspace=database
cd "$SCRIPT_DIR"

# Start cloudflared tunnel and capture public URL
TUNNEL_LOG="$SCRIPT_DIR/cloudflared.log"
rm -f "$TUNNEL_LOG"
touch "$TUNNEL_LOG"

echo "🌐 Starting cloudflared tunnel..."
nohup cloudflared tunnel --url http://localhost:3000 --no-autoupdate > "$TUNNEL_LOG" 2>&1 &
CLOUDFLARED_PID=$!
echo "$CLOUDFLARED_PID" > "$SCRIPT_DIR/cloudflared.pid"

WEBHOOK_URL=""
for i in {1..30}; do
  if [ -f "$TUNNEL_LOG" ]; then
    WEBHOOK_URL=$(tr -d '\n' < "$TUNNEL_LOG" | grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' | head -n1 || true)
    if [ -n "$WEBHOOK_URL" ]; then
      break
    fi
  fi
  if ! kill -0 "$CLOUDFLARED_PID" >/dev/null 2>&1; then
    echo "❌ cloudflared exited unexpectedly. See $TUNNEL_LOG"
    cat "$TUNNEL_LOG"
    exit 1
  fi
  sleep 1
done

if [ -z "$WEBHOOK_URL" ]; then
  echo "❌ Failed to get tunnel URL from cloudflared logs"
  cat "$TUNNEL_LOG"
  exit 1
fi

echo "✅ Cloudflared tunnel URL: $WEBHOOK_URL"

# Persist webhook URL into docker .env
if grep -q '^TELEGRAM_WEBHOOK_URL=' .env; then
  sed -i "s|^TELEGRAM_WEBHOOK_URL=.*|TELEGRAM_WEBHOOK_URL=$WEBHOOK_URL|" .env
else
  echo "TELEGRAM_WEBHOOK_URL=$WEBHOOK_URL" >> .env
fi

echo "🔧 Updated TELEGRAM_WEBHOOK_URL in .env"

# Start remaining services
echo "🐳 Starting bot and notification worker..."
docker compose -f docker-compose.yml up -d core-bot notification-worker

# Show status
echo ""
echo "✅ Development environment started!"
echo ""
echo "Services:"
echo "  - Bot API:     http://localhost:3000"
echo "  - Tunnel URL:  $WEBHOOK_URL"
echo "  - Database:    postgresql://clinic_user:clinic_password@localhost:5432/clinic_bot"
echo "  - Redis:       redis://localhost:6379"
echo ""
echo "View logs: docker compose -f docker-compose.yml logs -f"
