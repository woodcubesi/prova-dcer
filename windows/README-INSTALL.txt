PROVAS DCER PAULISTA - WINDOWS X64 - SERVICO WINDOWS

Versao nativa Windows 11 x64, sem Docker, WSL ou virtualizacao.
Node.js 24 e PostgreSQL 16 estao incluidos no instalador.

A pasta padrao e C:\Program Files\Provas DCER. Tudo fica dentro dela:
  app          aplicacao
  node         executavel Node.js
  postgresql   banco e ferramentas nativas
  windows      controle do servico e atalhos
  data         banco, configuracoes, certificados, logs e backups

A instalacao pede permissao de administrador. A subpasta data e restrita
a administradores, SYSTEM e a conta administrativa que executar o servico.
Os dados sao preservados na desinstalacao; nao apague data sem backup.

O servico Provas DCER Paulista (nome interno ProvasDCER) inicia
automaticamente e funciona mesmo sem usuario conectado.
Ele inicia com a conta LocalSystem. Para usar sua conta administradora:
1. Abra services.msc.
2. Abra Provas DCER Paulista > Propriedades > Logon.
3. Marque Esta conta, informe .\usuario ou DOMINIO\usuario e a senha.
4. Aplique e reinicie o servico.
Use uma conta que tenha permissao de administrador neste computador.
As credenciais de Logon sao gerenciadas pelo Windows, nao pelo aplicativo.

Escolha a porta HTTPS no instalador (padrao 3443).
Abra Provas DCER Paulista pelo menu Iniciar ou acesse
https://localhost:PORTA/admin/login.
Primeiro acesso: use o e-mail e a senha definidos na instalacao.
Configure o autenticador MFA.

O instalador confia um certificado TLS exclusivo de localhost no computador.
O certificado e removido na desinstalacao; banco e backups sao preservados.

Para alterar a porta depois: pare o servico, edite publicPort em
data\settings.json e windows\connection.json (como administrador) e reinicie.
A configuracao SMTP fica no painel em Sistema > E-mail / SMTP.
Informe servidor, porta, seguranca, remetente, autenticacao e endereco publico.
O envio fica desativado ate configurar. Use Enviar teste para validar.
Configuracoes antigas de data\settings.json sao compatibilidade ate salvar
a primeira configuracao pelo painel.
Nao compartilhe settings.json: contem segredos e chaves de MFA.
Para migracao, preserve o backup e tambem settings.json.

Esta versao nao importa automaticamente dados do Contabo ou de instalacoes
anteriores em AppData. Faca backup antes de migrar dados.
Nao publique esta instancia local diretamente na internet.

Desenvolvimento: Josue Sampaio Lopes Coutinho - josue@woodcube.com.br
Codigo base: https://github.com/woodcubesi/prova-dcer

O assistente pede nome, e-mail, senha e confirmacao do primeiro administrador.
A senha deve ter de 8 a 120 caracteres e nao e preenchida automaticamente.
Ela e transmitida ao gerador de hash por um pipe privado, sem linha de comando
ou arquivo em texto aberto. Apenas o hash scrypt e salvo temporariamente na
pasta data protegida e removido apos a inicializacao.
Contas e senhas existentes sao preservadas ao atualizar ou reinstalar.
Esta senha nao e a senha da conta Windows usada no Logon do servico.
