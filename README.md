# Provas DCER Paulista

Sistema de cadastro de ER/MR, provas, eventos, correcao, rankings, relatorios e administracao com MFA.

A mesma aplicacao pode ser instalada **com Docker** ou **diretamente no Linux**, no mesmo repositorio. Nao existem duas versoes do codigo.

## Escolha a instalacao

| Modo | Guia | Componentes |
| --- | --- | --- |
| Docker em servidor | [Instalar com Docker](provas-dcer/deploy/docker/README.md) | Aplicacao e PostgreSQL em containers |
| Linux sem Docker | [Instalar direto no Linux](provas-dcer/deploy/bare-metal/README.md) | Node.js 24, pnpm, PostgreSQL e systemd |
| Desenvolvimento | [Guia de desenvolvimento](provas-dcer/README.md) | Codigo em `provas-dcer/` |

## 1. Instalacao com Docker

Requisitos: servidor Linux com Git, OpenSSL, Docker Engine e Docker Compose
instalados. O usuario precisa ter permissao para executar Docker.

### Baixar o projeto e preparar o ambiente

```bash
docker --version
docker compose version
git clone https://github.com/woodcubesi/prova-dcer.git
cd prova-dcer/provas-dcer
cp deploy/docker/production.env.example .env.production
chmod 600 .env.production
```

Edite `.env.production` e preencha:

- `APP_URL`: endereco publico, por exemplo `https://provas.seudominio.com.br`.
- `POSTGRES_PASSWORD`: senha do banco, gerada com `openssl rand -hex 32`.
- `ADMIN_SESSION_SECRET`: outro valor gerado com `openssl rand -hex 32`.
- `ADMIN_MFA_ENCRYPTION_KEY`: um terceiro valor gerado com `openssl rand -hex 32`.

Use um segredo diferente para cada campo. As demais variaveis podem manter os
valores do modelo na primeira instalacao. Para recuperacao de senha e MFA por
e-mail, configure tambem o relay SMTP.

### Criar o banco e construir a aplicacao

Na mesma sessao de terminal, defina a funcao `dc` e execute:

```bash
dc() { docker compose --env-file .env.production -f docker-compose.production.yml "$@"; }
dc up -d db
dc build app
dc run --rm app pnpm db:push
```

O build usa o codigo deste repositorio; nao depende de uma imagem publica pronta.

### Criar o primeiro administrador e iniciar

Substitua o nome e o e-mail pelos dados do responsavel:

```bash
export BOOTSTRAP_ADMIN_NAME="Administrador"
export BOOTSTRAP_ADMIN_EMAIL="admin@seudominio.com.br"
dc run --rm -e BOOTSTRAP_ADMIN_NAME -e BOOTSTRAP_ADMIN_EMAIL app pnpm admin:create
dc up -d app
dc ps
dc logs --tail 30 app
curl -fsS http://127.0.0.1:3001/admin/login >/dev/null
```

Senha inicial: **`dcerpaulista`**. O e-mail e o informado no comando acima.

A aplicacao atende em `127.0.0.1:3001`. O PostgreSQL fica somente na rede interna
dos containers. Os dados ficam nos volumes `postgres_data` e `system_backups`,
do projeto Compose `provas-dcer-production`.

Configure o acesso HTTPS conforme a secao de primeiro acesso abaixo.

## 2. Instalacao direta no Linux, sem Docker

Requisitos: Ubuntu/Debian com systemd, acesso `sudo` e conexao com a internet.
O instalador prepara Node.js 24, pnpm, PostgreSQL e o servico da aplicacao.
Docker nao e necessario nesse modo.

### Baixar o projeto e instalar as dependencias

```bash
sudo apt-get update
sudo apt-get install -y git ca-certificates
git clone https://github.com/woodcubesi/prova-dcer.git
cd prova-dcer/provas-dcer
sudo bash deploy/bare-metal/install-linux.sh
```

O instalador cria o usuario `provasdcer`, o banco e as configuracoes em
`/opt/provas-dcer/current/.env`. Mantenha o checkout do Git fora desse diretorio.

### Configurar e publicar a aplicacao

Edite `/opt/provas-dcer/current/.env` e ajuste `APP_URL` para o dominio HTTPS.
Configure o SMTP para os e-mails de recuperacao. Preserve a senha do banco e as
chaves geradas automaticamente pelo instalador.

```bash
sudo nano /opt/provas-dcer/current/.env
sudo bash deploy/bare-metal/deploy-linux.sh
```

O deploy copia o codigo, instala as dependencias, prepara o banco, gera o build
e inicia o servico systemd.

### Criar o primeiro administrador e verificar

```bash
sudo -u provasdcer env \
  BOOTSTRAP_ADMIN_NAME="Administrador" \
  BOOTSTRAP_ADMIN_EMAIL="admin@seudominio.com.br" \
  pnpm --dir /opt/provas-dcer/current admin:create

sudo systemctl status provas-dcer --no-pager
curl -fsS http://127.0.0.1:3001/admin/login >/dev/null
```

Senha inicial: **`dcerpaulista`**. O e-mail e o informado no comando acima.

Neste modo, a aplicacao atende em `127.0.0.1:3001`, o PostgreSQL local usa a
porta `5432`, e o servico reinicia automaticamente quando necessario.

## Primeiro acesso e HTTPS

Nos dois modos, configure um proxy reverso HTTPS (Nginx/Apache) ou um tunel
Cloudflare para encaminhar o dominio definido em `APP_URL` para
`http://127.0.0.1:3001`. O proxy/tunel precisa estar no mesmo host para usar
esse endereco; se estiver em outro container, configure a rede entre eles.

Acesse `https://seu-dominio/admin/login`, informe o e-mail cadastrado e a senha
inicial `dcerpaulista`, e configure o autenticador MFA. O HTTP local dos comandos
acima serve para verificar se a aplicacao respondeu; o acesso administrativo
publico deve usar HTTPS.

O comando `admin:create` serve apenas para uma instalacao nova. Ele recusa
substituir administradores existentes. Outras contas sao cadastradas em Equipe.

## Atualizacoes e backups

Antes de atualizar, faca um backup completo na aba Seguranca. Mantenha os arquivos
de ambiente, as chaves MFA/sessao e os dados do PostgreSQL.

Com Docker, dentro de `prova-dcer/provas-dcer`, defina novamente `dc` caso esteja
em outro terminal:

```bash
dc() { docker compose --env-file .env.production -f docker-compose.production.yml "$@"; }
git pull --ff-only
dc build app
dc run --rm app pnpm db:push
dc up -d app
dc ps
```

Sem Docker, no checkout do Git:

```bash
sudo bash deploy/bare-metal/backup.sh
git pull --ff-only
sudo bash deploy/bare-metal/deploy-linux.sh
sudo systemctl status provas-dcer --no-pager
```

Os guias detalhados explicam os arquivos persistentes e as variaveis de cada
instalacao. Uma instalacao existente no Contabo deve preservar seus parametros
de rede, volumes e caminhos; nao a recrie como uma instalacao nova.

Credenciais, bancos e backups reais ficam fora do Git. Nao execute o seed de
demonstracao nem comandos de reset em bancos com dados reais.
