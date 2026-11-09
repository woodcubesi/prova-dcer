# Provas DCER Windows - instalacao em pasta unica e servico

O instalador reutiliza a aplicacao da pasta provas-dcer deste repositorio.
Compile em um checkout local fora de pastas sincronizadas pelo OneDrive.

Saida: `dist/Provas-DCER-1.1.0-windows-x64-setup.exe`.
Pasta padrao: `C:\Program Files\Provas DCER`.
Banco, configuracoes, certificados, logs e backups: subpasta `data`.

## Baixar e instalar

Baixe o [instalador Windows 1.1.0](https://github.com/woodcubesi/prova-dcer/releases/download/v1.1.0/Provas-DCER-1.1.0-windows-x64-setup.exe)
na [pagina da versao](https://github.com/woodcubesi/prova-dcer/releases/tag/v1.1.0).
Execute como administrador e siga o assistente. Nao e necessario instalar
Docker, Node.js ou PostgreSQL separadamente. O executavel nao e assinado
digitalmente. O arquivo `.sha256` publicado junto permite conferir integridade.

O instalador precisa de administrador. Usa Windows 11 x64, Node.js 24,
PostgreSQL 16 e WinSW incluidos, sem Docker/WSL/virtualizacao.

## Servico

Nome interno: `ProvasDCER`. Nome exibido: `Provas DCER Paulista`.
Inicio automatico atrasado, com reinicio em caso de falha.
O supervisor inicia o PostgreSQL e a aplicacao, verifica os processos e
encerra o banco de forma controlada ao parar o servico.

Inicialmente usa LocalSystem. Em `services.msc`, abra Propriedades > Logon
para informar sua conta administradora e a senha, e reinicie o servico.
A senha e armazenada pelo Windows; nao existe campo para ela no aplicativo.
Atualizacoes preservam a conta de Logon do servico existente.

O atalho apenas abre o navegador. A aplicacao independe de usuario conectado.
O certificado HTTPS de localhost e confiado no repositorio LocalMachine.
A pasta de dados permite acesso a SYSTEM, Administradores e a conta do servico.

## Primeiro acesso

Escolha porta, nome, e-mail, senha e confirmacao no assistente. Porta padrao 3443.
Acesse `https://localhost:PORTA/admin/login`.
A senha inicial e a definida pelo usuario (8 a 120 caracteres). Configure MFA no primeiro acesso.

A desinstalacao remove o servico e o certificado, preservando a subpasta data.
Nao ha migracao automatica de dados de instalacoes antigas em AppData.
Consulte `windows/README-INSTALL.txt` para configuracao SMTP e troca da porta.

## Compilar

```powershell
git clone https://github.com/woodcubesi/prova-dcer.git C:\src\prova-dcer
cd C:\src\prova-dcer
npx --yes pnpm@10.11.0 --dir provas-dcer install --frozen-lockfile
powershell -NoProfile -ExecutionPolicy Bypass -File windows/build-windows.ps1 -Resume
```

Node.js 24, pnpm 10.11.0, Inno Setup 6, PostgreSQL 16 e WinSW sao requisitos da
maquina de build, assim como os redistribuiveis C++ do Visual Studio Build Tools
2022. Os clientes nao precisam instalar esses componentes.
O executavel nao possui assinatura digital.

Por padrao, o script procura PostgreSQL em
`%LOCALAPPDATA%\DevTools\PostgreSQL\16.15\pgsql`, WinSW 2.12.0 em
`%LOCALAPPDATA%\DevTools\WinSW\WinSW.exe` e Inno Setup 6 em
`%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe`. Os parametros `-PostgresRoot`
e `-InnoCompiler` permitem informar outros caminhos. A compilacao gera o
instalador e o arquivo SHA-256 na pasta `dist`.

As dependencias standalone sao materializadas para evitar junctions externas.
O SQL inicial e gerado pelo Prisma; nao inclui seed nem dados reais.
Builds e testes locais ficam em build/, fora do Git e do instalador.

## Validacao

Login, MFA, backup e PDF/QR Code foram testados com o runtime Windows nativo.
`node windows/test-admin-install.cjs` valida a criacao do administrador com
nome/e-mail personalizados, senha com caracteres especiais, limites de senha,
login com MFA, backup e preservacao da conta em uma reinstalacao. Esse teste
usa uma pasta de dados descartavel fora do payload, sem instalar o servico.
O supervisor pode ser exercitado em primeiro plano com
`Run-Service.ps1 -VerificationMode`, sem registrar servico nem confiar
certificado na maquina. Arquivos de teste ficam fora do payload.

Os testes de navegador precisam do modulo Playwright disponivel no ambiente
de desenvolvimento ou do caminho do modulo em `PLAYWRIGHT_MODULE`.
A instalacao elevada e a troca de conta de Logon devem ser conferidas no
Windows de destino; os testes do runtime nao substituem essa verificacao.

O assistente pede nome, e-mail, senha e confirmacao do primeiro administrador.
A senha deve ter de 8 a 120 caracteres e nao e preenchida automaticamente.
Ela e transmitida ao gerador de hash por um pipe privado, sem linha de comando
ou arquivo em texto aberto. Apenas o hash scrypt e salvo temporariamente na
pasta data protegida e removido apos a inicializacao.
Contas e senhas existentes sao preservadas ao atualizar ou reinstalar.
Esta senha nao e a senha da conta Windows usada no Logon do servico.

## SMTP

Configure o envio em Sistema > E-mail / SMTP no painel. Cada instalacao usa
seu proprio servidor, com autenticacao opcional e senha cifrada no banco.
O envio inicia desativado ate configurar. A tabela e adicionada inclusive
em bancos de versoes anteriores. Consulte ../provas-dcer/deploy/SMTP.md.

A inicializacao do administrador usa consultas parametrizadas e arquivos
UTF-8 diretamente no Node.js, sem passar nomes ou hashes pela linha de
comando do psql. Isso evita falhas com acentos na conta LocalSystem.
O instalador detecta falhas de inicializacao e para o servico em vez de
aguardar repetidas tentativas de acesso ao painel.
