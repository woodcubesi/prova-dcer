# Provas DCER Paulista

Aplicacao web para montar, aplicar, corrigir e gerar relatorios de provas do DCER Paulista.

O sistema permite:

- criar provas sempre de multipla escolha;
- definir tempo total da prova;
- definir percentual minimo de aprovacao;
- liberar provas por igreja, categoria e embaixador;
- acesso do embaixador por igreja, categoria, nome e prova disponivel;
- cadastro de administradores e conselheiros;
- restricao de conselheiros por igreja;
- correcao sem exibir nota ao embaixador no final;
- relatorio PDF individual do embaixador;
- relatorio PDF geral da prova.

## Senhas padrao de desenvolvimento

Use estes dados apenas em ambiente local ou de testes.

```text
Acesso administrativo inicial
E-mail: deixe em branco
Senha: admin123
```

```text
Banco PostgreSQL local via Docker
Banco: provas_dcer
Usuario: provas_dcer
Senha: provas_dcer_dev
Host: localhost
Porta: 5433
```

URL padrao do banco:

```text
postgresql://provas_dcer:provas_dcer_dev@localhost:5433/provas_dcer?schema=public
```

Em homologacao ou producao, troque obrigatoriamente `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` e a senha do PostgreSQL.

## Requisitos

Instale antes:

- Git
- Node.js 20 ou superior, recomendado Node.js 22
- pnpm
- Docker
- Docker Compose

No Windows, pode instalar com:

```powershell
winget install Git.Git
winget install OpenJS.NodeJS
winget install Docker.DockerDesktop
corepack enable
corepack prepare pnpm@latest --activate
```

Depois abra o Docker Desktop pelo menos uma vez.

No Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates docker.io docker-compose-plugin
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
corepack enable
corepack prepare pnpm@latest --activate
```

Depois de adicionar o usuario ao grupo `docker`, saia e entre novamente na sessao.

## Ambiente Docker testado

O pacote Docker publicado neste repositorio foi auditado contra o servidor de producao em:

```text
Host: Ubuntu 26.04 LTS
Kernel: Linux 7.0.0 x86_64
Docker: 29.1.3
Aplicacao: node:24-bookworm-slim, Node.js 24.18.0, Debian 12 bookworm
Banco: postgres:16-alpine, PostgreSQL 16.14
Portainer: portainer/portainer-ce:lts
```

Portas usadas no ambiente Docker:

```text
Aplicacao: 127.0.0.1:3001 -> 3001/tcp
PostgreSQL: 127.0.0.1:5433 -> 5432/tcp
Portainer no servidor testado: 0.0.0.0:9000 -> 9000/tcp
```

Para subir somente aplicacao e banco com Docker:

```bash
docker compose up -d --build
docker compose run --rm app pnpm prisma db push
```

Acesse:

```text
Aplicacao: http://localhost:3001
Administracao: http://localhost:3001/admin/login
PostgreSQL: localhost:5433
```

## Instalacao local passo a passo

1. Baixe o projeto:

```bash
git clone https://github.com/woodcubesi/prova-dcer.git
cd prova-dcer/provas-dcer
```

2. Crie o arquivo de ambiente:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Confira o `.env` local:

```text
DATABASE_URL="postgresql://provas_dcer:provas_dcer_dev@localhost:5433/provas_dcer?schema=public"
ADMIN_PASSWORD="admin123"
ADMIN_SESSION_SECRET="troque-este-segredo-no-servidor-linux"
APP_URL="http://localhost:3000"
MAIL_DRIVER="console"
MAIL_FROM="Provas DCER Paulista <no-reply@localhost>"
```

4. Instale as dependencias:

```bash
pnpm install
```

5. Suba o banco, aplique o schema e carregue dados de demonstracao:

```bash
pnpm setup
```

6. Rode o servidor de desenvolvimento:

```bash
pnpm dev
```

7. Acesse no navegador:

```text
Inicio: http://localhost:3000
Embaixador: http://localhost:3000/prova
Administracao: http://localhost:3000/admin/login
```

## Primeiro acesso administrativo

Na tela administrativa:

```text
E-mail: deixe em branco
Senha: admin123
```

Depois de entrar, acesse `Equipe` e cadastre administradores e conselheiros com e-mail e senha proprios.

## Reset de senha por e-mail

O reset de senha administrativa envia um link de uso unico, valido por 30 minutos. A senha nunca e enviada por e-mail.

Em ambiente local, deixe:

```text
MAIL_DRIVER="console"
APP_URL="http://localhost:3000"
```

Assim o link de reset aparece no log do servidor (`pnpm dev` ou `pnpm start`).

Em homologacao/producao com Postfix local encaminhando para o Google Workspace SMTP relay:

```text
APP_URL="https://seu-dominio"
MAIL_DRIVER="smtp"
MAIL_FROM="Provas DCER Paulista <no-reply@seudominio.com.br>"
SMTP_HOST="127.0.0.1"
SMTP_PORT="25"
SMTP_SECURE="false"
SMTP_REQUIRE_TLS="false"
SMTP_IGNORE_TLS="true"
```

Configure o Postfix como relay local, aceitando conexao apenas de `localhost`, e encaminhando para `smtp-relay.gmail.com:587` com TLS.

## Dados de demonstracao

O seed cria igrejas, embaixadores e uma aplicacao demonstrativa.

Exemplo para teste:

```text
Codigo da aplicacao: DEMO2026
Igreja: Igreja Sede Central
Categoria: Junior
Embaixador: Ana Clara Souza
```

## Comandos uteis

```bash
pnpm install          # instala dependencias
pnpm setup            # sobe banco, gera Prisma, aplica schema e roda seed
pnpm dev              # roda em desenvolvimento
pnpm build            # build de producao
pnpm start            # inicia build de producao
pnpm lint             # validacao ESLint
pnpm db:up            # sobe PostgreSQL em Docker
pnpm db:down          # para PostgreSQL
pnpm db:push          # aplica schema Prisma no banco
pnpm db:seed          # recria dados de demonstracao
pnpm db:reset         # limpa e recria o banco pelo schema
pnpm prisma:generate  # gera Prisma Client
```

## Instalacao em Linux para homologacao/producao

1. Clone o projeto:

```bash
git clone https://github.com/woodcubesi/prova-dcer.git
cd prova-dcer/provas-dcer
```

2. Crie o `.env`:

```bash
cp .env.example .env
nano .env
```

3. Troque as senhas antes de publicar:

```text
DATABASE_URL="postgresql://USUARIO:SENHA_FORTE@localhost:5433/provas_dcer?schema=public"
ADMIN_PASSWORD="SENHA_ADMINISTRATIVA_FORTE"
ADMIN_SESSION_SECRET="SEGREDO_GRANDE_ALEATORIO"
APP_URL="https://seu-dominio"
MAIL_DRIVER="smtp"
MAIL_FROM="Provas DCER Paulista <no-reply@seudominio.com.br>"
SMTP_HOST="127.0.0.1"
SMTP_PORT="25"
SMTP_SECURE="false"
SMTP_REQUIRE_TLS="false"
SMTP_IGNORE_TLS="true"
```

4. Instale e prepare:

```bash
pnpm install --frozen-lockfile
pnpm db:up
pnpm prisma:generate
pnpm db:push
pnpm build
```

5. Inicie:

```bash
pnpm start
```

Por padrao, a aplicacao sobe na porta `3000`.

Em servidor real, use Nginx ou Apache como proxy reverso para a porta da aplicacao e configure HTTPS.

## Atualizar uma instalacao existente

```bash
git pull
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm db:push
pnpm build
pnpm start
```

Se a aplicacao estiver rodando como servico `systemd`, reinicie o servico depois do build:

```bash
sudo systemctl restart provas-dcer
```

## Problemas comuns

Se o banco nao conectar, confirme se o Docker esta rodando:

```bash
docker ps
pnpm db:up
```

Se a porta `5433` ja estiver em uso, pare outro PostgreSQL local ou altere a porta no `docker-compose.yml`.

Se a porta `3000` ja estiver em uso, rode em outra porta:

```bash
pnpm dev -- --port 3001
```

Se o login administrativo inicial falhar, confira no `.env` qual valor esta em `ADMIN_PASSWORD`. O campo de e-mail deve ficar em branco para usar a senha administrativa inicial.
