#!/bin/sh
set -eu

if [ -n "${DATABASE_URL:-}" ]; then
  echo "Waiting for database..."
  node - <<'NODE'
const net = require("net");
const dbUrl = new URL(process.env.DATABASE_URL);
const host = dbUrl.hostname;
const port = Number(dbUrl.port || 5432);
const deadline = Date.now() + 60000;

function check() {
  const socket = net.createConnection({ host, port });
  socket.setTimeout(2000);
  socket.on("connect", () => {
    socket.end();
    process.exit(0);
  });
  socket.on("timeout", retry);
  socket.on("error", retry);
}

function retry() {
  if (Date.now() > deadline) {
    console.error(`Database did not become reachable at ${host}:${port}`);
    process.exit(1);
  }
  setTimeout(check, 1000);
}

check();
NODE
fi

exec "$@"
