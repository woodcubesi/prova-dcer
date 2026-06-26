# Provas DCER Paulista

Aplicacao web para montar, aplicar, corrigir e gerar relatorios de provas do DCER Paulista.

O codigo da aplicacao fica em:

```text
provas-dcer/
```

## Instalacao rapida com Docker

Este projeto foi empacotado para rodar com dois containers:

- `provas_dcer_app`: aplicacao Next.js
- `provas_dcer_postgres`: banco PostgreSQL

A imagem pronta da aplicacao e:

```text
ghcr.io/woodcubesi/prova-dcer:latest
```

Antes de divulgar para terceiros, confirme no GitHub que o pacote esta publico:

```text
https://github.com/users/woodcubesi/packages/container/package/prova-dcer
```

Em `Package settings`, altere a visibilidade para `Public`. Depois qualquer pessoa podera baixar com:

```bash
docker pull ghcr.io/woodcubesi/prova-dcer:latest
```

## Passo a passo

1. Baixe o projeto:

```bash
git clone https://github.com/woodcubesi/prova-dcer.git
cd prova-dcer/provas-dcer
```

2. Suba os containers:

```bash
docker compose up -d
```

3. Crie a estrutura do banco:

```bash
docker compose run --rm app pnpm prisma db push
```

4. Acesse:

```text
Aplicacao: http://localhost:3001
Administracao: http://localhost:3001/admin/login
PostgreSQL: localhost:5433
```

5. Primeiro acesso administrativo:

```text
E-mail: deixe em branco
Senha: admin123
```

Depois de entrar, acesse `Equipe` e cadastre administradores e conselheiros com e-mail e senha proprios.

## Ambiente testado

O empacotamento Docker publicado foi auditado contra o servidor de producao:

```text
Host: Ubuntu 26.04 LTS
Kernel: Linux 7.0.0 x86_64
Docker: 29.1.3
Aplicacao: node:24-bookworm-slim, Node.js 24.18.0, Debian 12 bookworm
Banco: postgres:16-alpine, PostgreSQL 16.14
Portainer: portainer/portainer-ce:lts
```

Portas usadas:

```text
Aplicacao: 127.0.0.1:3001 -> 3001/tcp
PostgreSQL: 127.0.0.1:5433 -> 5432/tcp
```

## E-mail em producao

No servidor testado, o Postfix fica no host e a aplicacao roda em Docker. Nesse caso, use `host.docker.internal` para a aplicacao acessar o Postfix do host:

```text
MAIL_DRIVER="smtp"
SMTP_HOST="host.docker.internal"
SMTP_PORT="25"
SMTP_SECURE="false"
SMTP_REQUIRE_TLS="false"
SMTP_IGNORE_TLS="true"
```

No host Linux, permita somente a rede Docker interna usada pela aplicacao:

```bash
docker network inspect provas_dcer_net --format '{{(index .IPAM.Config 0).Gateway}} {{(index .IPAM.Config 0).Subnet}}'
sudo postconf -e "inet_interfaces = 127.0.0.1, 172.18.0.1"
sudo postconf -e "mynetworks = 127.0.0.0/8 172.18.0.0/16"
sudo postfix check
sudo systemctl restart postfix
```

Assim o SMTP nao fica publico: ele escuta em `127.0.0.1:25` e no gateway Docker interno.

## Comandos uteis

```bash
docker compose ps                  # mostra containers
docker compose logs -f app          # logs da aplicacao
docker compose logs -f db           # logs do banco
docker compose restart app          # reinicia a aplicacao
docker compose down                 # para os containers
docker compose up -d                # sobe novamente
docker compose pull                 # baixa imagem atualizada
```

## Desenvolvimento

Para detalhes de desenvolvimento, instalacao com Node/pnpm, seed de demonstracao e comandos internos, veja:

```text
provas-dcer/README.md
```
