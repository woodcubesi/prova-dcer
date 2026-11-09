# Instalacao com Docker

Use Docker Engine e o plugin Docker Compose no Linux. A aplicacao e o PostgreSQL rodam em containers, com volumes persistentes. A imagem e construida do codigo deste repositorio.

## Primeira instalacao em servidor

```bash
git clone https://github.com/woodcubesi/prova-dcer.git
cd prova-dcer/provas-dcer
cp deploy/docker/production.env.example .env.production
chmod 600 .env.production
```

Edite `.env.production`: preencha `POSTGRES_PASSWORD`, `ADMIN_SESSION_SECRET` e `ADMIN_MFA_ENCRYPTION_KEY` com valores diferentes gerados por `openssl rand -hex 32`. Defina `APP_URL` com o dominio HTTPS. Use senha hexadecimal no banco para compor a URL sem caracteres reservados.

Defina um atalho de shell para os comandos abaixo:

```bash
dc() { docker compose --env-file .env.production -f docker-compose.production.yml "$@"; }
dc up -d db
dc build app
dc run --rm app pnpm db:push
```

Crie o primeiro administrador (senha inicial padrao: `dcerpaulista`):

```bash
export BOOTSTRAP_ADMIN_NAME="Administrador"
export BOOTSTRAP_ADMIN_EMAIL="admin@seudominio.com.br"
dc run --rm -e BOOTSTRAP_ADMIN_NAME -e BOOTSTRAP_ADMIN_EMAIL app pnpm admin:create
dc up -d app
dc logs --tail 30 app
```

A aplicacao escuta em `127.0.0.1:3001` e o banco fica acessivel apenas na rede interna do Compose. Configure seu proxy HTTPS para essa porta e acesse `https://seu-dominio/admin/login`. Entre com e-mail/senha e configure o autenticador MFA.

Os volumes pertencem ao projeto `provas-dcer-production`. Essa configuracao e para instalacoes novas; uma instalacao existente com rede e volumes proprios deve preservar os seus nomes e parametros.

## Atualizacoes e backup

Antes de atualizar, faca o backup completo na aba Seguranca e guarde a imagem anterior para rollback.

```bash
git pull --ff-only
dc build app
dc run --rm app pnpm db:push
dc up -d app
dc logs --tail 30 app
```

Preserve `.env.production` e os volumes `postgres_data` e `system_backups`. Nao use `down -v` para atualizar. Nao altere as chaves MFA/sessao nem recrie a senha do banco em uma atualizacao comum.

Para e-mail, configure o relay SMTP em `.env.production`. Um relay no host pode ser acessado por `host.docker.internal`.

## Desenvolvimento local

O arquivo `docker-compose.yml` e separado da configuracao de servidor:

```bash
docker compose up -d --build
docker compose run --rm app pnpm db:push
```

Aplicacao em `http://127.0.0.1:3002`; PostgreSQL em `127.0.0.1:5434`.
