#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute como root: sudo bash deploy/bare-metal/deploy-linux.sh" >&2
  exit 1
fi

APP_USER="${APP_USER:-provasdcer}"
APP_BASE="${APP_BASE:-/opt/provas-dcer}"
APP_DIR="${APP_DIR:-$APP_BASE/current}"
SERVICE_NAME="${SERVICE_NAME:-provas-dcer}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ ! -f "$APP_DIR/.env" ]; then
  echo "Arquivo $APP_DIR/.env nao encontrado. Rode install-linux.sh primeiro." >&2
  exit 1
fi

echo "[1/6] Copiando codigo para $APP_DIR"
rsync -a --delete \
  --exclude='.git' \
  --exclude='.next' \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='tmp' \
  "$SOURCE_DIR/" "$APP_DIR/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod 600 "$APP_DIR/.env"

echo "[2/6] Instalando dependencias"
runuser -u "$APP_USER" -- bash -lc "cd '$APP_DIR' && pnpm install --frozen-lockfile"

echo "[3/6] Aplicando Prisma"
runuser -u "$APP_USER" -- bash -lc "cd '$APP_DIR' && pnpm prisma:generate && pnpm db:push"

echo "[4/6] Gerando build"
runuser -u "$APP_USER" -- bash -lc "cd '$APP_DIR' && pnpm build"

echo "[5/6] Reiniciando servico"
systemctl daemon-reload
systemctl restart "$SERVICE_NAME"

echo "[6/6] Validando HTTP local"
PORT="$(grep '^PORT=' "$APP_DIR/.env" | sed 's/^PORT=//' | tr -d '\"' || true)"
PORT="${PORT:-3001}"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/admin/login" >/dev/null; then
    systemctl --no-pager --full status "$SERVICE_NAME" | sed -n '1,12p'
    echo "Deploy concluido em http://127.0.0.1:$PORT"
    exit 0
  fi
  sleep 2
done

echo "Aplicacao nao respondeu em http://127.0.0.1:$PORT/admin/login" >&2
journalctl -u "$SERVICE_NAME" -n 120 --no-pager >&2 || true
exit 1
