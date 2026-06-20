# Provas DCER Paulista

Aplicacao web para montar, aplicar e conferir provas. A primeira versao usa:

- Next.js + TypeScript
- PostgreSQL em Docker
- Prisma ORM
- Entrada do aluno por prova, igreja, categoria e nome
- Provas sempre de multipla escolha
- Tempo total da prova
- Painel administrativo para cadastros, montagem e correcao
- Cadastro de administradores e professores
- Resultado oculto para o aluno ao final

## Ambientes

- Desenvolvimento: esta maquina local, usada para codar e validar em `localhost`.
- Homologacao: servidor Ubuntu `213.136.66.29`, publicado em `https://prova-dcer.woodcube.com.br`.
- Producao: ainda nao definido.

## Instalacao rapida

### Pre-requisitos

Instale antes de rodar o projeto:

- Git
- Node.js 20 ou superior
- pnpm
- Docker Desktop no Windows ou Docker Engine no Linux
- Docker Compose

No Windows, uma instalacao basica pode ser feita com:

```powershell
winget install Git.Git
winget install OpenJS.NodeJS
winget install Docker.DockerDesktop
corepack enable
corepack prepare pnpm@latest --activate
```

Depois abra o Docker Desktop pelo menos uma vez para iniciar o Docker.

No Ubuntu/Debian, uma base comum e:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
corepack enable
corepack prepare pnpm@latest --activate
```

Depois de adicionar o usuario ao grupo `docker`, saia e entre novamente na sessao Linux.

### Baixar do GitHub

```bash
git clone https://github.com/woodcubesi/prova-dcer.git
cd prova-dcer/provas-dcer
```

### Configurar variaveis de ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Para desenvolvimento local, os valores do `.env.example` ja funcionam com o `docker-compose.yml`.
Em producao, altere principalmente:

```text
ADMIN_PASSWORD="uma-senha-forte"
ADMIN_SESSION_SECRET="um-segredo-grande-e-aleatorio"
```

### Instalar dependencias e preparar banco

```bash
pnpm install
pnpm setup
```

O comando `pnpm setup` sobe o PostgreSQL em Docker, gera o Prisma Client, aplica o schema no banco e cria dados de demonstracao.

### Rodar em desenvolvimento

```bash
pnpm dev
```

Acesse:

- Inicio: http://localhost:3000
- Aluno: http://localhost:3000/prova
- Administracao: http://localhost:3000/admin

Primeiro acesso administrativo local:

```text
E-mail: deixe em branco
Senha: admin123
```

Depois de entrar, acesse o menu `Equipe` para cadastrar administradores e professores. Os proximos acessos podem ser feitos com e-mail e senha cadastrados.

## Rodar nesta maquina

```powershell
cd "C:\Users\JOSUE\Documents\Provas Dcer Paulista\provas-dcer"
pnpm setup
pnpm dev
```

Acesse:

- Aluno: http://localhost:3000/prova
- Administracao: http://localhost:3000/admin

Primeiro acesso administrativo nesta maquina:

```text
E-mail: deixe em branco
Senha: admin123
```

Depois cadastre administradores e professores no menu `Equipe`.

## Dados de demonstracao

O seed cria uma aplicacao ativa:

- Codigo: `DEMO2026`
- Igreja: `Igreja Sede Central`
- Categoria: `Junior`
- Aluno: `Ana Clara Souza`

Tambem existem outros alunos nas igrejas `Igreja Jardim Paulista` e `Igreja Vila Esperanca`.

## Comandos uteis

```powershell
pnpm install     # instala dependencias
pnpm setup       # prepara Docker, Prisma e seed
pnpm db:up       # sobe PostgreSQL
pnpm db:down     # para PostgreSQL
pnpm db:push     # aplica schema Prisma no banco
pnpm db:seed     # recria dados de demonstracao
pnpm db:reset    # limpa e recria o banco pelo schema
pnpm lint        # validacao ESLint
pnpm build       # build de producao
```

## Preparacao para Linux

O projeto ja usa PostgreSQL em container e variaveis no `.env`, entao a migracao para Linux deve manter a mesma base:

1. Instalar Node.js, pnpm, Docker e Docker Compose.
2. Copiar o projeto.
3. Ajustar `.env` com senha administrativa e segredo de sessao fortes.
4. Rodar `pnpm setup`.
5. Rodar `pnpm build` e `pnpm start`.

### Rodar em producao no Linux

Com o `.env` ajustado:

```bash
pnpm install --frozen-lockfile
pnpm db:up
pnpm prisma:generate
pnpm db:push
pnpm build
pnpm start
```

Por padrao, a aplicacao sobe em:

```text
http://0.0.0.0:3000
```

Em servidor real, coloque um proxy reverso, como Nginx ou Apache, apontando para a porta `3000`, e configure HTTPS.

### Atualizar uma instalacao existente

```bash
git pull
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm db:push
pnpm build
pnpm start
```

### Problemas comuns

Se `docker` nao for reconhecido, feche e abra o terminal ou confirme se o Docker esta instalado e rodando.

Se a porta `5432` ja estiver em uso, pare outro PostgreSQL local ou altere a porta no `docker-compose.yml`.

Se a porta `3000` ja estiver em uso, finalize o processo atual ou rode a aplicacao em outra porta:

```bash
pnpm dev -- --port 3001
```
