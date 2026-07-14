# Deploy do Provas DCER

Este repositorio mantem uma unica base de codigo e dois modos oficiais de instalacao:

- `docker/`: aplicacao e PostgreSQL em containers.
- `bare-metal/`: aplicacao instalada diretamente no Linux, com Node.js, pnpm, PostgreSQL e systemd.

Use Docker quando quiser ambiente mais previsivel e facil de reproduzir. Use bare-metal quando o servidor nao puder, ou nao dever, rodar Docker.

Nao crie outro repositorio para a versao sem Docker. O codigo da aplicacao deve continuar unico; o que muda e apenas o modo de subir.
