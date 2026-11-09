# Provas DCER Paulista

Sistema de cadastro de ER/MR, provas, eventos, correcao, rankings, relatorios e administracao com MFA.

A mesma aplicacao pode ser instalada **com Docker** ou **diretamente no Linux**, no mesmo repositorio. Nao existem duas versoes do codigo.

## Escolha a instalacao

| Modo | Guia | Componentes |
| --- | --- | --- |
| Docker em servidor | [Instalar com Docker](provas-dcer/deploy/docker/README.md) | Aplicacao e PostgreSQL em containers |
| Linux sem Docker | [Instalar direto no Linux](provas-dcer/deploy/bare-metal/README.md) | Node.js 24, pnpm, PostgreSQL e systemd |
| Desenvolvimento | [Guia de desenvolvimento](provas-dcer/README.md) | Codigo em `provas-dcer/` |

## Baixar

```bash
git clone https://github.com/woodcubesi/prova-dcer.git
cd prova-dcer/provas-dcer
```

Para instalar a versao atual, siga um dos guias acima. O modo Docker constroi a imagem a partir do codigo baixado; nao depende de um pacote publico no GHCR.

## Primeiro acesso

Em uma instalacao nova, crie o primeiro administrador com `pnpm admin:create`, conforme o guia escolhido. A senha inicial padrao e `dcerpaulista`. O acesso usa e-mail e senha e solicita a configuracao do autenticador MFA.

Em uma instalacao existente, preserve o banco, o arquivo de ambiente e as chaves de sessao/MFA. O comando inicial nao substitui administradores existentes.

Use HTTPS no endereco publico. Credenciais, bancos e backups reais ficam fora do Git.
