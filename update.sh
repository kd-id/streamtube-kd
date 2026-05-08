#!/bin/bash
# ============================================
# StreamTube VPS Update Script
# Usage: bash update.sh [--force]
# ============================================
set -e

APP_DIR="${APP_DIR:-/opt/streamtube}"
BRANCH="${BRANCH:-main}"
FORCE="${1:-}"

echo "=========================================="
echo " StreamTube VPS Update"
echo "=========================================="
echo ""

# 1. Go to app directory
cd "$APP_DIR" || { echo "ERROR: $APP_DIR not found"; exit 1; }

# 2. Check if git repo
if [ ! -d ".git" ]; then
  echo "ERROR: Not a git repository. Run 'git clone' first."
  exit 1
fi

# 3. Fetch latest
echo "[1/5] Fetching latest from origin..."
git fetch origin "$BRANCH"

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ] && [ "$FORCE" != "--force" ]; then
  echo "Already up-to-date ($LOCAL). Use --force to rebuild anyway."
  exit 0
fi

echo "  Current:  $LOCAL"
echo "  Latest:   $REMOTE"
echo ""

# 4. Pull changes
echo "[2/5] Pulling latest code..."
git reset --hard "origin/$BRANCH"
echo ""

# 5. Install dependencies
echo "[3/5] Installing dependencies..."
npm ci --production=false 2>/dev/null || npm install
echo ""

# 6. Build frontend
echo "[4/5] Building frontend..."
npm run build
echo ""

# 7. Restart service
echo "[5/5] Restarting service..."

# Detect how the app is running
if command -v docker &> /dev/null && docker ps --format '{{.Names}}' 2>/dev/null | grep -q "streamtube"; then
  # Docker mode
  echo "  Detected Docker container 'streamtube'"
  docker compose down 2>/dev/null || docker-compose down 2>/dev/null
  docker compose up -d --build 2>/dev/null || docker-compose up -d --build 2>/dev/null
  echo "  Docker container restarted."

elif command -v pm2 &> /dev/null && pm2 list 2>/dev/null | grep -q "streamtube"; then
  # PM2 mode
  echo "  Detected PM2 process 'streamtube'"
  pm2 restart streamtube
  echo "  PM2 process restarted."

elif [ -f "/etc/systemd/system/streamtube.service" ]; then
  # Systemd mode
  echo "  Detected systemd service"
  sudo systemctl restart streamtube
  echo "  Systemd service restarted."

else
  # Manual mode — try to find and restart node process
  echo "  No Docker/PM2/systemd detected."
  echo "  If running manually, restart with:"
  echo "    pm2 start server.js --name streamtube"
  echo "    OR: NODE_ENV=production node server.js"
fi

echo ""
NEW_COMMIT=$(git rev-parse --short HEAD)
echo "=========================================="
echo " Update complete! ($NEW_COMMIT)"
echo "=========================================="
