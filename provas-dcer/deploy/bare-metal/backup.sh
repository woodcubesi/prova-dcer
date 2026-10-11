#!/usr/bin/env bash
set -euo pipefail

APP_BASE="${APP_BASE:-/opt/provas-dcer}"
APP_DIR="${APP_DIR:-$APP_BASE/current}"
BACKUP_DIR="${BACKUP_DIR:-$APP_BASE/backups/manual}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Arquivo de ambiente nao encontrado: $ENV_FILE" >&2
  exit 1
fi

DATABASE_URL="$(grep '^DATABASE_URL=' "$ENV_FILE" | sed 's/^DATABASE_URL=//' | sed 's/^"//;s/"$//')"
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL nao encontrada em $ENV_FILE" >&2
  exit 1
fi

timestamp="$(date +%Y%m%d%H%M%S)"
target_dir="$BACKUP_DIR/$timestamp"
mkdir -p "$target_dir"

echo "[1/3] Backup do banco"
pg_dump "$DATABASE_URL" | gzip -9 > "$target_dir/provas_dcer.sql.gz"

echo "[2/3] Snapshot da aplicacao"
tar -czf "$target_dir/app.tar.gz" \
  --exclude='.next/cache' \
  --exclude='node_modules/.cache' \
  -C "$APP_DIR" .

echo "[3/3] Empacotando"
tar -czf "$BACKUP_DIR/provas-dcer-full-$timestamp.tar.gz" -C "$BACKUP_DIR" "$timestamp"
rm -rf "$target_dir"
chmod 600 "$BACKUP_DIR/provas-dcer-full-$timestamp.tar.gz"

echo "$BACKUP_DIR/provas-dcer-full-$timestamp.tar.gz"
