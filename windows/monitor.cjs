const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const http = require('node:http');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dataRoot = process.argv[2];
const settings = JSON.parse(fs.readFileSync(path.join(dataRoot, 'settings.json'), 'utf8').trim());
const appRoot = path.join(root, 'app');
const env = {
  ...process.env,
  NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
  PORT: String(settings.backendPort), HOSTNAME: '127.0.0.1',
  DATABASE_URL: `postgresql://provas_dcer:${settings.dbPassword}@127.0.0.1:${settings.dbPort}/provas_dcer?schema=public`,
  APP_URL: `https://localhost:${settings.publicPort}`,
  ADMIN_SESSION_SECRET: settings.sessionSecret,
  ADMIN_MFA_ENCRYPTION_KEY: settings.mfaKey,
  SYSTEM_APP_ROOT: appRoot,
  SYSTEM_BACKUP_DIR: path.join(dataRoot, 'backups'),
  SYSTEM_RESTORE_DIR: path.join(dataRoot, 'restores'),
  PATH: `${path.join(root, 'postgresql', 'bin')};${process.env.PATH}`,
  MAIL_DRIVER: settings.smtp?.host ? 'smtp' : 'disabled',
  MAIL_FROM: settings.smtp?.from || 'Provas DCER <no-reply@localhost>',
  SMTP_HOST: settings.smtp?.host || '', SMTP_PORT: String(settings.smtp?.port || 587),
  SMTP_SECURE: String(settings.smtp?.secure || false),
  SMTP_USER: settings.smtp?.user || '', SMTP_PASSWORD: settings.smtp?.password || '',
};
let child;
let stopping = false;
function startBackend() {
  child = spawn(process.execPath, ['server.js'], { cwd: appRoot, env, windowsHide: true, stdio: ['ignore', 'inherit', 'inherit'] });
  child.on('error', (error) => console.error('Backend startup:', error.message));
  child.on('exit', () => { if (!stopping) setTimeout(startBackend, 2500); });
}
startBackend();
const server = https.createServer({
  pfx: fs.readFileSync(path.join(dataRoot, 'localhost.pfx')),
  passphrase: settings.certPassword,
}, (req, res) => {
  const host = `localhost:${settings.publicPort}`;
  if (req.headers.host !== host && req.headers.host !== `127.0.0.1:${settings.publicPort}`) {
    res.writeHead(400); res.end('Host invalido'); return;
  }
  const upstream = http.request({
    hostname: '127.0.0.1', port: settings.backendPort, path: req.url, method: req.method,
    headers: { ...req.headers, host, 'x-forwarded-host': host, 'x-forwarded-proto': 'https', 'x-forwarded-for': '127.0.0.1' },
  }, (response) => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(503); res.end('A aplicacao esta iniciando. Aguarde alguns segundos.'); });
  req.pipe(upstream);
});
server.on('error', (error) => { stopping = true; if (child) child.kill(); console.error(error); process.exit(1); });
server.listen(settings.publicPort, '127.0.0.1', () => console.log(`Provas DCER em https://localhost:${settings.publicPort}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  stopping = true; if (child) child.kill(); server.close(() => process.exit(0));
});
