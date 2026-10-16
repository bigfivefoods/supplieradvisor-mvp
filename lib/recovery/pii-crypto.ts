import 'server-only';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { maskId } from './mask';

export { maskId };

const ENC_ENV = 'RECOVER_PII_ENC_KEY';
const HMAC_ENV = 'RECOVER_PII_HMAC_KEY';
const VERSION = 1;

if (typeof window !== 'undefined') {
  throw new Error('pii_not_configured');
}

export type PiiFailure = { ok: false; code: 'pii_not_configured' | 'decrypt_failed' };

function keyBytes(name: string): Buffer | null {
  const raw = process.env[name] || '';
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) return null;
  return Buffer.from(raw, 'hex');
}

export function piiConfigured(): boolean {
  return Boolean(keyBytes(ENC_ENV) && keyBytes(HMAC_ENV));
}

function blindIndexRaw(plain: string, key: Buffer): string {
  return createHmac('sha256', key).update(plain, 'utf8').digest('hex');
}

export function blindIndex(plain: string): { ok: true; hash: string } | PiiFailure {
  const macKey = keyBytes(HMAC_ENV);
  if (!macKey) return { ok: false, code: 'pii_not_configured' };
  return { ok: true, hash: blindIndexRaw(plain, macKey) };
}

export function encryptId(
  plain: string
): { ok: true; enc: string; hash: string; last4: string; version: number } | PiiFailure {
  const encKey = keyBytes(ENC_ENV);
  const macKey = keyBytes(HMAC_ENV);
  if (!encKey || !macKey) return { ok: false, code: 'pii_not_configured' };
  const trimmed = String(plain || '').trim();
  if (!trimmed) return { ok: false, code: 'pii_not_configured' };
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encKey, iv);
  cipher.setAAD(Buffer.from('recover-id-v1'));
  const ciphertext = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const enc = `v${VERSION}:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
  const digits = trimmed.replace(/\D/g, '');
  return {
    ok: true,
    enc,
    hash: blindIndexRaw(trimmed, macKey),
    last4: (digits || trimmed).slice(-4),
    version: VERSION,
  };
}

export function decryptId(enc: string): { ok: true; value: string } | PiiFailure {
  const encKey = keyBytes(ENC_ENV);
  if (!encKey) return { ok: false, code: 'pii_not_configured' };
  const parts = String(enc || '').split(':');
  if (parts.length !== 4 || parts[0] !== `v${VERSION}`) return { ok: false, code: 'decrypt_failed' };
  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[2], 'base64url');
    const data = Buffer.from(parts[3], 'base64url');
    if (iv.length !== 12 || tag.length !== 16) return { ok: false, code: 'decrypt_failed' };
    const decipher = createDecipheriv('aes-256-gcm', encKey, iv);
    decipher.setAAD(Buffer.from('recover-id-v1'));
    decipher.setAuthTag(tag);
    const value = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    return { ok: true, value };
  } catch {
    return { ok: false, code: 'decrypt_failed' };
  }
}

export function idsEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
