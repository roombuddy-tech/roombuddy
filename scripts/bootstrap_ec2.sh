#!/usr/bin/env bash
set -euo pipefail

# ── Edit this line ──
GITHUB_REPO="git@github.com:roombuddy-tech/roombuddy.git"

APP_DIR="/home/ubuntu/roombuddy"
ENV_FILE="/etc/roombuddy/env"

log() { echo -e "\n\033[1;36m▶ $*\033[0m"; }

log "Installing system packages"
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y \
    python3-pip \
    nginx postgresql-client redis-tools \
    git build-essential libpq-dev \
    libjpeg-dev zlib1g-dev \
    certbot python3-certbot-nginx \
    htop unzip jq

if [ ! -f /home/ubuntu/.ssh/id_ed25519 ]; then
    log "Generating SSH key for GitHub"
    ssh-keygen -t ed25519 -C "roombuddy-ec2" -f /home/ubuntu/.ssh/id_ed25519 -N ""
fi

ssh-keyscan -t ed25519 github.com >> /home/ubuntu/.ssh/known_hosts 2>/dev/null

echo ""
echo "============================================================"
echo "ADD THIS as a GitHub Deploy Key (Settings → Deploy keys):"
echo "============================================================"
cat /home/ubuntu/.ssh/id_ed25519.pub
echo "============================================================"
read -p "Press ENTER once added to GitHub..."

if [ ! -d "$APP_DIR" ]; then
    log "Cloning repo"
    git clone "$GITHUB_REPO" "$APP_DIR"
fi

log "Setting up Python venv"
cd "$APP_DIR/backend"
PYENV_PYTHON="/home/ubuntu/.pyenv/versions/3.12.7/bin/python3.12"
if [ ! -x "$PYENV_PYTHON" ]; then
    echo "❌ Python 3.12 not found at $PYENV_PYTHON"
    echo "   Install it first: pyenv install 3.12.7"
    exit 1
fi
"$PYENV_PYTHON" -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

log "Creating env file"
sudo mkdir -p /etc/roombuddy
if [ ! -f "$ENV_FILE" ]; then
    sudo cp "$APP_DIR/backend/.env.example" "$ENV_FILE"
    sudo chown ubuntu:ubuntu "$ENV_FILE"
    sudo chmod 600 "$ENV_FILE"
    echo ""
    echo "============================================================"
    echo "EDIT $ENV_FILE NOW with REAL values:"
    echo "  sudo nano $ENV_FILE"
    echo "============================================================"
    read -p "Press ENTER once filled in..."
fi

log "Running migrations"
set -a && source "$ENV_FILE" && set +a
cd "$APP_DIR/backend"
./venv/bin/python manage.py migrate --noinput
./venv/bin/python manage.py collectstatic --noinput

log "Installing systemd service"
sudo mkdir -p /var/log/roombuddy
sudo chown ubuntu:www-data /var/log/roombuddy
sudo chmod 775 /var/log/roombuddy
sudo cp "$APP_DIR/deploy/roombuddy.service" /etc/systemd/system/roombuddy.service
sudo usermod -a -G ubuntu www-data || true
sudo systemctl daemon-reload
sudo systemctl enable roombuddy
sudo systemctl restart roombuddy

log "Installing scheduled-jobs timer (expire + booking lifecycle)"
chmod +x "$APP_DIR/scripts/run_scheduled_jobs.sh"
sudo cp "$APP_DIR/deploy/roombuddy-cron.service" /etc/systemd/system/roombuddy-cron.service
sudo cp "$APP_DIR/deploy/roombuddy-cron.timer" /etc/systemd/system/roombuddy-cron.timer
sudo systemctl daemon-reload
sudo systemctl enable --now roombuddy-cron.timer

log "Installing nginx config"
sudo cp "$APP_DIR/deploy/nginx-roombuddy.conf" /etc/nginx/sites-available/roombuddy
sudo ln -sf /etc/nginx/sites-available/roombuddy /etc/nginx/sites-enabled/roombuddy
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

log "Sanity check"
sleep 2
curl -fsS http://localhost/api/health/ | jq . || (
    echo "❌ Health check failed. Logs:"
    sudo journalctl -u roombuddy -n 50
    exit 1
)

echo ""
echo "✅ Bootstrap complete. Next: DNS + HTTPS (Stage 4)."