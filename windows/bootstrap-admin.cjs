const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Client } = require(path.join(__dirname, '../app/node_modules/pg'));
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}
async function initializeAdmin(dataRoot) {
  const settings = readJson(path.join(dataRoot, 'settings.json'));
  const bootstrapFile = path.join(dataRoot, 'bootstrap.json');
  const client = new Client({
    host:'127.0.0.1', port:settings.dbPort, user:'provas_dcer',
    password:settings.dbPassword, database:'provas_dcer', connectionTimeoutMillis:10000,
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(731109260)');
    const existing = await client.query('SELECT 1 FROM "AdminUser" WHERE role IN (\'ADMIN\', \'ADMIN_TEACHER\') LIMIT 1');
    if (existing.rowCount === 0) {
      if (!fs.existsSync(bootstrapFile)) throw new Error('MISSING_BOOTSTRAP');
      const bootstrap = readJson(bootstrapFile);
      if (typeof bootstrap.name !== 'string' || bootstrap.name.trim().length < 3 ||
          typeof bootstrap.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bootstrap.email) ||
          !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(bootstrap.passwordHash)) {
        throw new Error('INVALID_BOOTSTRAP');
      }
      await client.query(
        'INSERT INTO "AdminUser" (id, name, email, "passwordHash", role, active, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, \'ADMIN\', true, now(), now())',
        [`win-${randomUUID()}`, bootstrap.name.trim(), bootstrap.email.trim().toLowerCase(), bootstrap.passwordHash],
      );
    }
    await client.query('COMMIT');
    if (fs.existsSync(bootstrapFile)) fs.unlinkSync(bootstrapFile);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}
initializeAdmin(process.argv[2]).catch(error => {
  const code = ['MISSING_BOOTSTRAP', 'INVALID_BOOTSTRAP'].includes(error.message) ? error.message : error.code || 'DATABASE_ERROR';
  console.error(`Nao foi possivel criar o administrador inicial (${code}).`);
  process.exitCode = 1;
});
