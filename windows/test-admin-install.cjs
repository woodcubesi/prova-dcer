const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomBytes, scryptSync } = require('node:crypto');
const { Client } = require('../provas-dcer/node_modules/pg');

const root = path.resolve(__dirname, '..');
const runtime = path.join(root, 'build/windows/Provas DCER Verificacao');
const data = path.join(root, 'build/windows', `administrator-check-${Date.now()}`);
const startScript = path.join(runtime, 'windows/Start-DCER.ps1');
function powershell(args, input) {
  const outputFile = input === undefined ? path.join(data, `test-process-${Date.now()}.log`) : null;
  if (outputFile) fs.mkdirSync(data, {recursive:true});
  const output = outputFile ? fs.openSync(outputFile, 'w') : null;
  try {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', ...args], {
      input, encoding: 'utf8', timeout: 180000, windowsHide: true,
      stdio: output === null ? 'pipe' : ['ignore', output, output],
      env: {...process.env, PSModulePath: path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/Modules')},
    });
    if (outputFile) result.stdout = fs.readFileSync(outputFile, 'utf8');
    return result;
  } finally { if (output !== null) fs.closeSync(output); }
}
function passwordInput(password) {
  return JSON.stringify({password}).replace(/[^\x20-\x7e]/g, value => `\\u${value.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
function makeHash(password) {
  const result = powershell(['-File', path.join(__dirname, 'test-hash-pipe.ps1'), '-RuntimeRoot', runtime], passwordInput(password));
  assert.equal(result.status, 0, 'Falha no pipe de senha');
  const hash = result.stdout.trim();
  assert.match(hash, /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
  const [, salt, digest] = hash.split(':');
  assert.equal(scryptSync(password, salt, 64).toString('hex'), digest);
  return hash;
}
function start() {
  const result = powershell(['-File', startScript, '-DataRoot', data, '-PublicPort', '33451', '-NoBrowser', '-SkipTrust']);
  if (result.status !== 0) console.error(result.stdout, result.stderr);
  assert.equal(result.status, 0, 'Inicializacao nativa falhou');
}
function stop() {
  const result = powershell(['-File', startScript, '-DataRoot', data, '-Stop', '-RemoveCertificate']);
  assert.equal(result.status, 0, 'Encerramento nativo falhou');
}
async function account() {
  const settings = JSON.parse(fs.readFileSync(path.join(data, 'settings.json'), 'utf8').replace(/^\uFEFF/, ''));
  const client = new Client({host:'127.0.0.1', port:settings.dbPort, user:'provas_dcer', password:settings.dbPassword, database:'provas_dcer'});
  await client.connect();
  try { return (await client.query('SELECT name, email, "passwordHash" FROM "AdminUser"')).rows; }
  finally { await client.end(); }
}
function verifyNoPlaintext(password) {
  const scan = directory => {
    for (const file of fs.readdirSync(directory, {withFileTypes:true})) {
      const full = path.join(directory, file.name);
      if (file.isDirectory()) { if (file.name !== 'database') scan(full); }
      else assert.equal(fs.readFileSync(full).includes(Buffer.from(password)), false, 'Senha em texto aberto nos arquivos de configuracao/logs');
    }
  };
  scan(data);
}
(async () => {
  for (const file of ['Start-DCER.ps1','crypto.cjs','bootstrap-admin.cjs']) {
    fs.copyFileSync(path.join(__dirname, file), path.join(runtime, 'windows', file));
  }
  fs.copyFileSync(path.join(root, 'provas-dcer/deploy/schema/system-mail-settings.sql'), path.join(runtime, 'windows/system-mail-settings.sql'));
  const password = randomBytes(24).toString('hex') + '\u00e9"\\\'';
  const passwordHash = makeHash(password);
  makeHash('x'.repeat(120));
  for (const invalid of ['short', 'x'.repeat(121)]) {
    const result = powershell(['-File', path.join(__dirname, 'test-hash-pipe.ps1'), '-RuntimeRoot', runtime], passwordInput(invalid));
    assert.notEqual(result.status, 0);
  }
  console.log('PASSWORD_PIPE_AND_LIMITS_OK');
  const bootstrap = {name:'Josu\u00e9 Teste D\'\u00c1vila "Admin"', email:'instalacao-teste@dcer.local', publicPort:33451, passwordHash};
  fs.mkdirSync(data, {recursive:true});
  fs.writeFileSync(path.join(data, 'bootstrap.json'), JSON.stringify(bootstrap));
  try {
    start();
    const first = await account();
    assert.deepEqual(first, [{name:bootstrap.name, email:bootstrap.email, passwordHash}]);
    assert.equal(fs.existsSync(path.join(data, 'bootstrap.json')), false);
    verifyNoPlaintext(password);
    console.log('CUSTOM_ADMIN_CREATED_AND_BOOTSTRAP_REMOVED');
    const browser = spawnSync(path.join(runtime, 'node/node.exe'), [path.join(__dirname, 'test-runtime.cjs'), 'https://localhost:33451', bootstrap.email], {
      cwd: root, env:{...process.env, WINDOWS_TEST_PASSWORD:password}, encoding:'utf8', timeout:120000, windowsHide:true,
    });
    process.stdout.write(browser.stdout || '');
    if (browser.status !== 0) process.stderr.write(browser.stderr || '');
    assert.equal(browser.status, 0, 'Login com senha escolhida falhou');
    stop();
    const replacement = {...bootstrap, name:'Nao substituir', email:'outro@dcer.local', passwordHash:makeHash(randomBytes(24).toString('hex'))};
    fs.writeFileSync(path.join(data, 'bootstrap.json'), JSON.stringify(replacement));
    start();
    assert.deepEqual(await account(), first);
    assert.equal(fs.existsSync(path.join(data, 'bootstrap.json')), false);
    verifyNoPlaintext(password);
    console.log('EXISTING_ADMIN_PRESERVED_OK');
  } finally { stop(); }
  console.log('NATIVE_ADMIN_INSTALL_VALIDATION_OK');
})().catch(error => {console.error(error); process.exitCode = 1;});
