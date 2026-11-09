# Provas DCER Paulista

Aplicacao Next.js com PostgreSQL para cadastrar ER/MR, organizar eventos, aplicar provas, corrigir respostas e baixar relatorios e rankings.

## Instalacao em servidor

Uma base de codigo, dois modos de instalacao:

- [Docker](deploy/docker/README.md): use `docker-compose.production.yml`.
- [Linux sem Docker](deploy/bare-metal/README.md): use os scripts para Node.js 24, PostgreSQL e systemd.

O primeiro acesso usa e-mail e senha de um administrador criado com `pnpm admin:create`, seguido da configuracao de MFA. Login com e-mail vazio nao e suportado.

## Desenvolvimento local

Requisitos: Node.js 24, pnpm 10, Docker e Compose para o banco local. Docker nao e necessario se voce ja tiver PostgreSQL instalado diretamente.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d db
pnpm prisma:generate
pnpm db:push
```

O banco do Compose local atende em `127.0.0.1:5434`. Se usar PostgreSQL fora do Docker, ajuste `DATABASE_URL` para esse banco.

Crie o primeiro administrador (senha inicial padrao: `dcerpaulista`):

```bash
export BOOTSTRAP_ADMIN_NAME="Administrador"
export BOOTSTRAP_ADMIN_EMAIL="admin@seudominio.com.br"
pnpm admin:create
pnpm dev
```

O servidor de desenvolvimento atende em [localhost:3000](http://localhost:3000). Ajuste `APP_URL` no arquivo de ambiente para esse endereco.

Para executar tambem a aplicacao pelo Docker local:

```bash
docker compose up -d --build
docker compose run --rm app pnpm db:push
```

Nesse modo, a aplicacao atende em [localhost:3002](http://localhost:3002). Esse Compose contem configuracao de desenvolvimento; para servidor, use o [guia Docker](deploy/docker/README.md).

## Comandos

```bash
pnpm lint
pnpm build
pnpm dev
pnpm start
pnpm prisma:generate
pnpm db:push
pnpm admin:create
```

`pnpm db:seed` e `pnpm db:reset` sao comandos para dados de demonstracao. Nao os execute em bancos com dados reais.

## E-mail e backups

Use `MAIL_DRIVER=console` somente em desenvolvimento; os links de recuperacao aparecem nos logs. Em servidor, configure `APP_URL`, `MAIL_DRIVER=smtp` e os dados do relay. Se o SMTP fica no host e a aplicacao em Docker, use `SMTP_HOST=host.docker.internal`; sem Docker, um SMTP no mesmo host pode usar `127.0.0.1`.

Mantenha `ADMIN_SESSION_SECRET` e `ADMIN_MFA_ENCRYPTION_KEY` estaveis entre atualizacoes. Os guias de instalacao explicam os backups e os caminhos persistentes.
