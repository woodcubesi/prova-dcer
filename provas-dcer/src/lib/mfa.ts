import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto";

const encryptedSecretVersion = "v1";
const cipherAlgorithm = "aes-256-gcm";
const totpIssuer = "Provas DCER Paulista";
const totpDigits = 6;
const totpPeriodSeconds = 30;
const totpWindowSteps = 1;
const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export type MfaVerificationResult = {
  valid: boolean;
  timeStep?: number;
};

function getEncryptionKey() {
  const secret =
    process.env.ADMIN_MFA_ENCRYPTION_KEY || process.env.ADMIN_SESSION_SECRET || "dev-secret";

  return createHash("sha256").update(secret).digest();
}

function encodeBase32(buffer: Buffer) {
  let bits = "";
  let result = "";

  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, "0");
  }

  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0");
    result += base32Alphabet[Number.parseInt(chunk, 2)];
  }

  return result;
}

function decodeBase32(value: string) {
  const normalized = value.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = "";
  const bytes: number[] = [];

  for (const char of normalized) {
    const index = base32Alphabet.indexOf(char);
    if (index === -1) {
      throw new Error("Invalid base32 secret.");
    }
    bits += index.toString(2).padStart(5, "0");
  }

  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
}

function generateTotp(secret: string, timeStep: number) {
  const key = decodeBase32(secret);
  const counter = Buffer.alloc(8);
  counter.writeUInt32BE(Math.floor(timeStep / 0x100000000), 0);
  counter.writeUInt32BE(timeStep >>> 0, 4);

  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 10 ** totpDigits).padStart(totpDigits, "0");
}

export function createTotpSecret() {
  return encodeBase32(randomBytes(20));
}

export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(cipherAlgorithm, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    encryptedSecretVersion,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptTotpSecret(encryptedSecret: string) {
  const [version, ivValue, tagValue, ciphertextValue] = encryptedSecret.split(":");

  if (version !== encryptedSecretVersion || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Invalid MFA secret format.");
  }

  const decipher = createDecipheriv(
    cipherAlgorithm,
    getEncryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function buildTotpUri(email: string, secret: string) {
  const params = new URLSearchParams({
    secret,
    issuer: totpIssuer,
    algorithm: "SHA1",
    digits: String(totpDigits),
    period: String(totpPeriodSeconds),
  });
  const label = `${totpIssuer}:${email}`;

  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export function normalizeMfaCode(value: string) {
  return value.replace(/\s+/g, "").trim();
}

export function verifyTotpCode(
  secret: string,
  code: string,
  lastUsedStep?: number | null,
): MfaVerificationResult {
  const token = normalizeMfaCode(code);

  if (!/^\d{6}$/.test(token)) {
    return { valid: false };
  }

  const currentStep = Math.floor(Date.now() / 1000 / totpPeriodSeconds);

  for (let offset = -totpWindowSteps; offset <= totpWindowSteps; offset += 1) {
    const timeStep = currentStep + offset;

    if (typeof lastUsedStep === "number" && timeStep <= lastUsedStep) {
      continue;
    }

    if (generateTotp(secret, timeStep) === token) {
      return { valid: true, timeStep };
    }
  }

  return { valid: false };
}
