/**
 * Bank account numbers on credit applications are stored sealed.
 * The list still shows the last four digits after the value is opened.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'enc1:';

function keyMaterial(): Buffer | null {
  const secret =
    process.env.CREDIT_ACCOUNT_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!secret) return null;
  return createHash('sha256').update(`supplieradvisor-credit:${secret}`).digest();
}

/** Seal digits only. Empty input stays empty. */
export function sealAccountNumber(plain: string): string {
  const digits = String(plain || '').replace(/\D/g, '');
  if (!digits) return '';
  const key = keyMaterial();
  if (!key) {
    throw new Error('Credit account encryption key is not set');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(digits, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`;
}

/** Open a sealed value. A legacy plaintext number is returned as digits. */
export function openAccountNumber(stored: string | null | undefined): string {
  const value = String(stored || '');
  if (!value) return '';
  if (!value.startsWith(PREFIX)) return value.replace(/\D/g, '');
  const key = keyMaterial();
  if (!key) return '';
  const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split('.');
  if (!ivB64 || !tagB64 || !dataB64) return '';
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivB64, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
    return plain.replace(/\D/g, '');
  } catch {
    return '';
  }
}

export function isSealedAccount(stored: string | null | undefined): boolean {
  return String(stored || '').startsWith(PREFIX);
}
