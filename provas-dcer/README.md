# Provas DCER Paulista

Aplicacao web para montar, aplicar e conferir provas. A primeira versao usa:

- Next.js + TypeScript
- PostgreSQL em Docker
- Prisma ORM
- Entrada do aluno por prova, igreja, categoria e nome
- Tempo total da prova
- Painel administrativo para cadastros, montagem e correcao
- Resultado oculto para o aluno ao final

## Rodar nesta maquina

```powershell
cd "C:\Users\JOSUE\Documents\Provas Dcer Paulista\provas-dcer"
pnpm setup
pnpm dev
```

Acesse:

- Aluno: http://localhost:3000/prova
- Administracao: http://localhost:3000/admin

Senha administrativa local:

```text
admin123
```

## Dados de demonstracao

O seed cria uma aplicacao ativa:

- Codigo: `DEMO2026`
- Igreja: `Igreja Sede Central`
- Categoria: `Junior`
- Aluno: `Ana Clara Souza`

Tambem existem outros alunos nas igrejas `Igreja Jardim Paulista` e `Igreja Vila Esperanca`.

## Comandos uteis

```powershell
pnpm db:up       # sobe PostgreSQL
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
