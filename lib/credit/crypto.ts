import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ENC_ALGO = 'aes-256-gcm';
const ENC_PREFIX = 'v1';
const ENC_CODE = 'CREDIT_ENCRYPTION_NOT_CONFIGURED';

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

function keyFromEnv(): Buffer | null {
  const raw = String(process.env.CREDIT_APP_ENCRYPTION_KEY || '').trim();
  if (!raw) return null;
  try {
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) return null;
    return key;
  } catch {
    return null;
  }
}

export function creditEncryptionConfigured(): boolean {
  return Boolean(keyFromEnv());
}

export function assertCreditEncryptionReady(): { ok: true } | { ok: false; status: 503; code: string; error: string } {
  if (keyFromEnv()) return { ok: true };
  if (!isProd()) return { ok: true };
  return {
    ok: false,
    status: 503,
    code: ENC_CODE,
    error: ENC_CODE,
  };
}

export function encryptField(plainText: string): string {
  const key = keyFromEnv();
  if (!key) {
    throw new Error(ENC_CODE);
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENC_ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(String(plainText || ''), 'utf8')),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    ENC_PREFIX,
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
}

export function decryptField(cipherText: string): string {
  const key = keyFromEnv();
  if (!key) throw new Error(ENC_CODE);
  const parts = String(cipherText || '').split('.');
  if (parts.length !== 4 || parts[0] !== ENC_PREFIX) {
    throw new Error('CREDIT_ENCRYPTION_PAYLOAD_INVALID');
  }
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const data = Buffer.from(parts[3], 'base64');
  const decipher = createDecipheriv(ENC_ALGO, key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(data), decipher.final()]);
  return out.toString('utf8');
}

export function sha256BufferHex(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}
