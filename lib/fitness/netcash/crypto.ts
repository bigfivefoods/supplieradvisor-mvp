import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Seals the Netcash Debit Order service key and member account numbers.
 * Key material is GYM_NETCASH_ENC_KEY (64 hex characters). This module
 * reads that name. It does not set it and it does not log the key or the
 * plaintext. The company id is bound as additional authenticated data so a
 * ciphertext cannot be moved to another gym.
 */

const PREFIX = 'gnc1';

export function keyFromHex(raw: string | null | undefined): Buffer | null {
  const value = String(raw || '').trim();
  if (!/^[0-9a-fA-F]{64}$/.test(value)) return null;
  return Buffer.from(value, 'hex');
}

export function encryptionKey(): Buffer | null {
  return keyFromHex(process.env.GYM_NETCASH_ENC_KEY);
}

export function sealSecret(
  plain: string,
  key: Buffer,
  aad: string
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), enc.toString('base64url')].join('.');
}

export function openSecret(stored: string, key: Buffer, aad: string): string | null {
  const parts = String(stored || '').split('.');
  if (parts.length !== 4 || parts[0] !== PREFIX) return null;
  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[2], 'base64url');
    const data = Buffer.from(parts[3], 'base64url');
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function last4(value: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.slice(-4);
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function serviceKeyAad(companyId: number): string {
  return `gym-netcash-service-key:${companyId}`;
}

export function accountAad(companyId: number, mandateId: string): string {
  return `gym-netcash-account:${companyId}:${mandateId}`;
}
