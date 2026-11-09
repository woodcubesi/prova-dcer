# SMTP por instalacao

Disponivel em Docker, Linux nativo e Windows em **Sistema > E-mail / SMTP**.
Somente administradores podem acessar, salvar ou testar esta configuracao.

1. Informe o endereco publico da instalacao, sem caminho, por exemplo
   `https://provas.suaigreja.org.br`. Os links de senha e MFA usam esse endereco.
2. Ative o envio e configure servidor, porta, nome e e-mail do remetente.
3. Selecione STARTTLS obrigatorio (normalmente porta 587) ou TLS direto
   (normalmente porta 465), conforme o provedor.
4. Para SMTP autenticado, habilite autenticacao e preencha usuario e senha.
   Para relay autorizado por IP, deixe autenticacao desmarcada. Libere no
   provedor o IP de saida da respectiva instalacao.
5. Salve e envie um e-mail de teste. A confirmacao significa que o servidor
   SMTP aceitou a mensagem; confira tambem a caixa de entrada/spam.

Senha em branco preserva a senha salva. Alterar servidor ou usuario exige
informar novamente a senha. Desmarcar autenticacao remove a senha salva.
As alteracoes valem imediatamente, sem reiniciar servico ou container.
Desativar o envio na tela impede o uso de configuracoes SMTP do ambiente.

As credenciais SMTP sao cifradas no banco com AES-256-GCM. Preserve a chave
`SYSTEM_SETTINGS_ENCRYPTION_KEY`, se definida; na ausencia dela, e utilizada
`ADMIN_MFA_ENCRYPTION_KEY` ou `ADMIN_SESSION_SECRET`, nesta ordem. Nao troque
essas chaves sem reconfigurar as credenciais. O Windows usa as chaves da pasta
data. Backups incluem os dados SMTP cifrados; uma restauracao em outra
instalacao precisa das mesmas chaves ou de uma nova senha SMTP.

Instalacoes novas em servidor iniciam com envio desativado. Nao existe relay
padrao do desenvolvedor. Em atualizacoes, as variaveis SMTP antigas continuam
validas somente ate a primeira configuracao salva pela tela. Elas nao sao
alteradas pela interface e podem ser removidas apos a validacao do novo SMTP.
`MAIL_DRIVER=console` e exclusivo para desenvolvimento e registra mensagens
nos logs; uma configuracao salva pela tela sempre tem prioridade.

## Atualizar

- Docker: construa a imagem, execute `pnpm db:push` no container e recrie o app
  conforme o procedimento normal. Preserve volumes e chaves.
- Linux: `deploy/bare-metal/deploy-linux.sh` aplica o schema antes de reiniciar.
- Windows: use o novo instalador. A tabela de configuracao e adicionada de
  forma idempotente na inicializacao, inclusive sobre bancos existentes.

Nao desative a validacao de certificados TLS. Autenticacao com senha exige
TLS; o modo sem TLS e destinado somente a relays sem autenticacao em rede
confiavel.
