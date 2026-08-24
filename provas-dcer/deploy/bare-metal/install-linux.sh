#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute como root: sudo bash deploy/bare-metal/install-linux.sh" >&2
  exit 1
fi

APP_USER="${APP_USER:-provasdcer}"
APP_BASE="${APP_BASE:-/opt/provas-dcer}"
APP_DIR="${APP_DIR:-$APP_BASE/current}"
SERVICE_NAME="${SERVICE_NAME:-provas-dcer}"
NODE_MAJOR="${NODE_MAJOR:-24}"
APP_PORT="${APP_PORT:-3001}"
DB_NAME="${DB_NAME:-provas_dcer}"
DB_USER="${DB_USER:-provas_dcer}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$DB_NAME:$DB_USER" in
  *[!a-zA-Z0-9_:]*)
    echo "DB_NAME e DB_USER devem conter apenas letras, numeros e underscore." >&2
    exit 1
    ;;
esac

echo "[1/7] Instalando pacotes do sistema"
apt-get update -y
apt-get install -y ca-certificates curl git gnupg openssl postgresql postgresql-client rsync

if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'Number(process.versions.node.split(".")[0])')" -lt "$NODE_MAJOR" ]; then
  echo "[2/7] Instalando Node.js $NODE_MAJOR"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
else
  echo "[2/7] Node.js ja instalado: $(node --version)"
fi

echo "[3/7] Habilitando pnpm"
corepack enable
corepack prepare pnpm@latest --activate

echo "[4/7] Preparando usuario e diretorios"
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "$APP_BASE" --shell /bin/bash "$APP_USER"
fi
mkdir -p "$APP_DIR" "$APP_BASE/backups/system" "$APP_BASE/backups/restores"
chown -R "$APP_USER:$APP_USER" "$APP_BASE"

echo "[5/7] Preparando PostgreSQL"
systemctl enable --now postgresql
DB_PASSWORD_FILE="$APP_BASE/db-password"
if [ ! -s "$DB_PASSWORD_FILE" ]; then
  openssl rand -hex 24 > "$DB_PASSWORD_FILE"
  chmod 600 "$DB_PASSWORD_FILE"
  chown root:root "$DB_PASSWORD_FILE"
fi
DB_PASSWORD="$(cat "$DB_PASSWORD_FILE")"
runuser -u postgres -- psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASSWORD';
  ELSE
    ALTER ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASSWORD';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec
SQL

echo "[6/7] Criando .env se necessario"
if [ ! -f "$APP_DIR/.env" ]; then
  ADMIN_PASSWORD="$(openssl rand -hex 12)"
  ADMIN_SESSION_SECRET="$(openssl rand -hex 32)"
  ADMIN_MFA_ENCRYPTION_KEY="$(openssl rand -hex 32)"
  cat > "$APP_DIR/.env" <<EOF
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@127.0.0.1:5432/$DB_NAME?schema=public"
ADMIN_PASSWORD="$ADMIN_PASSWORD"
ADMIN_SESSION_SECRET="$ADMIN_SESSION_SECRET"
ADMIN_MFA_ENCRYPTION_KEY="$ADMIN_MFA_ENCRYPTION_KEY"
APP_URL="http://127.0.0.1:$APP_PORT"
PORT="$APP_PORT"
MAIL_DRIVER="console"
MAIL_FROM="Provas DCER Paulista <no-reply@localhost>"
SMTP_HOST=""
SMTP_PORT="25"
SMTP_SECURE="false"
SMTP_REQUIRE_TLS="false"
SMTP_IGNORE_TLS="false"
SMTP_USER=""
SMTP_PASSWORD=""
NEXT_TELEMETRY_DISABLED="1"
SYSTEM_BACKUP_DIR="$APP_BASE/backups/system"
SYSTEM_RESTORE_DIR="$APP_BASE/backups/restores"
SYSTEM_APP_ROOT="$APP_DIR"
EOF
  chmod 600 "$APP_DIR/.env"
  chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
  echo "Senha administrativa inicial gerada em $APP_DIR/.env"
fi

echo "[7/7] Instalando servico systemd"
install -m 0644 "$SCRIPT_DIR/provas-dcer.service" "/etc/systemd/system/$SERVICE_NAME.service"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

echo "Instalacao base concluida. Agora execute:"
echo "sudo bash deploy/bare-metal/deploy-linux.sh"
