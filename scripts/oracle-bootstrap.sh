#!/usr/bin/env bash
# PRODEMUNDIAL 2026 — bootstrap Oracle Cloud Always Free (Ubuntu 22.04)
# Uso en la VM: curl -fsSL ... | bash   o   bash scripts/oracle-bootstrap.sh
set -euo pipefail

REPO_URL="${PRODE_REPO_URL:-https://github.com/Nicocoder47/Prode-uf.git}"
APP_DIR="${PRODE_APP_DIR:-/home/ubuntu/prode}"
NODE_MAJOR=22

echo "==> PRODEMUNDIAL Oracle bootstrap"
echo "    Repo: $REPO_URL"
echo "    Dir:  $APP_DIR"

sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y git curl build-essential ufw

curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2 tsx

if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"
git pull --ff-only || true
npm ci

if [ ! -f .env ]; then
  echo "⚠ Crear $APP_DIR/.env con SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOOTBALL_DATA_API_KEY, CORS_ORIGIN"
  echo "  Copiar desde .env.cloud.example en tu PC"
  cp -n .env.cloud.example .env 2>/dev/null || true
fi

# Firewall
sudo ufw allow 22/tcp || true
sudo ufw allow 3001/tcp || true
echo "y" | sudo ufw enable || true

pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u "$(whoami)" --hp "$HOME" | tail -1 | sudo bash || true

sleep 3
curl -sf "http://127.0.0.1:3001/api/health" | head -c 200 || echo "API aún no responde — revisar .env y pm2 logs"

echo ""
echo "✅ PM2:"
pm2 status
echo ""
echo "Próximo paso: configurar VITE_API_BASE_URL en Vercel con http://$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):3001"
echo "Monitoreo: docs/uptimerobot.md"
