# Deploy sem Docker (bare-metal)

Este modo instala a aplicacao diretamente no Linux, sem containers.

Ele usa:

- Node.js 24
- pnpm
- PostgreSQL instalado no host
- systemd para manter a aplicacao no ar
- Nginx/Apache opcional como proxy reverso para HTTPS

## Estrutura no servidor

Padrao usado pelos scripts:

```text
/opt/provas-dcer/current       # codigo publicado
/opt/provas-dcer/backups       # backups app + banco
/opt/provas-dcer/db-password   # senha local do PostgreSQL
/etc/systemd/system/provas-dcer.service
```

Usuario do servico:

```text
provasdcer
```

Porta padrao da aplicacao:

```text
127.0.0.1:3001
```

## Primeira instalacao

No servidor Ubuntu/Debian, clone o repositorio e rode:

```bash
git clone https://github.com/woodcubesi/prova-dcer.git
cd prova-dcer/provas-dcer
sudo bash deploy/bare-metal/install-linux.sh
sudo bash deploy/bare-metal/deploy-linux.sh
```

O `install-linux.sh`:

- instala dependencias do sistema;
- instala Node.js e pnpm;
- instala e habilita PostgreSQL;
- cria banco e usuario locais;
- cria `/opt/provas-dcer/current/.env` se ainda nao existir;
- instala o servico systemd.

O `deploy-linux.sh`:

- copia o codigo atual para `/opt/provas-dcer/current`;
- preserva o `.env` real;
- instala dependencias Node;
- aplica Prisma no banco;
- gera o build Next.js;
- reinicia o servico.

## Atualizar uma instalacao

No checkout do Git:

```bash
git pull
sudo bash deploy/bare-metal/deploy-linux.sh
```

## Variaveis importantes

Edite:

```text
/opt/provas-dcer/current/.env
```

Minimo esperado:

```text
DATABASE_URL="postgresql://provas_dcer:SENHA@127.0.0.1:5432/provas_dcer?schema=public"
ADMIN_PASSWORD="troque-esta-senha"
ADMIN_SESSION_SECRET="segredo-grande-aleatorio"
ADMIN_MFA_ENCRYPTION_KEY="outro-segredo-grande-aleatorio"
APP_URL="https://seu-dominio"
PORT="3001"
MAIL_DRIVER="smtp"
MAIL_FROM="Provas DCER Paulista <no-reply@seudominio.com.br>"
SMTP_HOST="127.0.0.1"
SMTP_PORT="25"
SMTP_SECURE="false"
SMTP_REQUIRE_TLS="false"
SMTP_IGNORE_TLS="true"
SYSTEM_BACKUP_DIR="/opt/provas-dcer/backups/system"
SYSTEM_RESTORE_DIR="/opt/provas-dcer/backups/restores"
SYSTEM_APP_ROOT="/opt/provas-dcer/current"
```

## Comandos uteis

```bash
sudo systemctl status provas-dcer
sudo systemctl restart provas-dcer
sudo journalctl -u provas-dcer -f
curl -fsS http://127.0.0.1:3001/admin/login
```

## Backup manual

```bash
sudo bash deploy/bare-metal/backup.sh
```

O backup inclui banco e snapshot da aplicacao, inclusive `.env`. Guarde o arquivo em local seguro.
