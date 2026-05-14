#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/ubuntu/roombuddy"
BACKEND="$APP_DIR/backend"
VENV="$BACKEND/venv"
ENV_FILE="/etc/roombuddy/env"

log() { echo "[deploy] $*"; }
fail() { echo "[deploy] ❌ $*" >&2; exit 1; }

log "Pulling latest from main"
cd "$APP_DIR"
git fetch origin main
git reset --hard origin/main

DEPLOYED_SHA=$(git rev-parse --short HEAD)
log "Deploying commit: $DEPLOYED_SHA"

cd "$BACKEND"
if git diff HEAD~1 HEAD --name-only 2>/dev/null | grep -q "requirements.txt"; then
    log "requirements.txt changed → reinstalling"
    "$VENV/bin/pip" install -r requirements.txt
fi

log "Running migrations"
set -a && source "$ENV_FILE" && set +a
"$VENV/bin/python" manage.py migrate --noinput

log "Collecting static files"
"$VENV/bin/python" manage.py collectstatic --noinput --clear

log "Reloading Gunicorn"
sudo systemctl reload roombuddy || sudo systemctl restart roombuddy

log "Health check"
for i in {1..15}; do
    if curl -fsS --unix-socket /run/roombuddy/roombuddy.sock -H "X-Forwarded-Proto: https" http://localhost/api/health/ > /dev/null 2>&1; then
        log "✅ Deploy of $DEPLOYED_SHA complete"
        exit 0
    fi
    sleep 2
done

fail "Health check failed. Logs:
$(sudo journalctl -u roombuddy -n 30 --no-pager)"