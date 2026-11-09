const { randomBytes, scryptSync } = require('node:crypto');
if (process.argv[2] === 'hash-stdin') {
  try {
    const { password } = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
    if (typeof password !== 'string' || password.length < 8 || password.length > 120) throw new Error();
    const salt = randomBytes(16).toString('hex');
    console.log(`scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`);
  } catch {
    console.error('Senha invalida. Use de 8 a 120 caracteres.');
    process.exitCode = 1;
  }
} else console.log(randomBytes(32).toString('hex'));
