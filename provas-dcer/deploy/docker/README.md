# Deploy com Docker

O modo Docker usa os arquivos na raiz da aplicacao:

- `Dockerfile`
- `docker-compose.yml`
- `.env` ou variaveis de ambiente do servidor

## Desenvolvimento local

```bash
cd provas-dcer
cp .env.example .env
docker compose up -d --build
docker compose exec app ./node_modules/.bin/prisma db push
```

A aplicacao local do compose atual fica em:

```text
http://127.0.0.1:3002
```

## Homologacao/producao

No servidor, mantenha:

- banco em volume persistente;
- backup antes de cada deploy;
- imagem anterior tagueada para rollback;
- `.env` real fora do Git.

Fluxo recomendado:

```bash
docker build -t provas-dcer-app:release-YYYYMMDDHHMMSS -t provas-dcer-app:production .
docker run --rm --network provas_dcer_net --env-file .env provas-dcer-app:release-YYYYMMDDHHMMSS ./node_modules/.bin/prisma db push
docker rm -f provas_dcer_app
docker run -d --name provas_dcer_app \
  --restart unless-stopped \
  --network provas_dcer_net \
  --env-file .env \
  -p 127.0.0.1:3001:3001 \
  -v provas_dcer_system_backups:/app/system-backups \
  provas-dcer-app:production
```

Quando o build remoto tiver problema de rede, gere a imagem localmente e envie com:

```bash
docker save prova-dcer-local:eventos -o provas-dcer-image.tar
scp provas-dcer-image.tar root@SERVIDOR:/tmp/
ssh root@SERVIDOR 'docker load -i /tmp/provas-dcer-image.tar'
```
