## Novidades

- Aba Sistema para configurar SMTP individualmente em Docker, Linux e Windows.
- Servidor, porta, TLS, remetente, autenticacao opcional e envio de teste.
- Senha SMTP cifrada no banco; acesso restrito a administradores.
- Redefinicao de senha e MFA usam o SMTP e o endereco publico da instalacao.
- Configuracoes SMTP antigas do ambiente continuam validas ate salvar pela tela.

## Windows sem Docker

Baixe `Provas-DCER-1.1.0-windows-x64-setup.exe` nos arquivos desta versao.

- Windows 11 x64, com Node.js 24 e PostgreSQL 16 incluidos.
- Pasta padrao `C:\Program Files\Provas DCER`, com dados na subpasta `data`.
- Servico Windows automatico, independente de usuario conectado.
- Porta HTTPS e nome, e-mail e senha do administrador escolhidos no assistente.
- Instalacoes existentes preservam dados, administradores e senhas.
- Tratamento de nomes com acentos na inicializacao do administrador.

O executavel ainda nao possui assinatura digital. Confira sua integridade com
o arquivo `.sha256` publicado junto. Execute a instalacao como administrador.
Faca backup antes de atualizar. A desinstalacao preserva a pasta `data`.

## Docker e Linux

O codigo-fonte desta versao inclui os procedimentos de instalacao nos dois
modos. Nas atualizacoes, preserve os arquivos de ambiente e as chaves de
sessao/MFA, aplique o schema com `pnpm db:push` e reinicie a aplicacao conforme
o guia da plataforma. Nao execute comandos de reset em bancos existentes.

## Validacao

Builds Linux/Docker e Windows, verificacao de tipos e lint aprovados.
Testados: SMTP isolado, recuperacao de senha e MFA, permissoes administrativas,
formulario com erro, interface desktop/celular e runtime Windows nativo.
O assistente elevado e a conta de Logon do servico precisam ser conferidos
no Windows de destino.
