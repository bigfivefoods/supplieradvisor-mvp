/**
 * Display helpers for a stored Netcash Debit Order service key.
 * This module has no key material and no ciphertext.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Last four characters of a saved key, shown only as the public tail. */
export function savedKeyLabel(last4: string): string {
  const tail = String(last4 || '').trim().slice(-4);
  if (!/^[0-9A-Za-z]{4}$/.test(tail)) return '';
  return `Saved, ending in ••••${tail}`;
}

export function formatCredentialStamp(iso: string): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  const month = MONTHS[Number(get('month')) - 1] || '';
  const day = String(Number(get('day')));
  if (!month || !get('year')) return '';
  return `${day} ${month} ${get('year')}, ${get('hour')}:${get('minute')}`;
}

export function credentialUpdatedLine(updatedAt: string, updatedBy: string): string {
  const when = formatCredentialStamp(updatedAt);
  const who = String(updatedBy || '').replace(/\s+/g, ' ').trim();
  if (!when && !who) return '';
  if (when && who) return `Last updated ${when} SAST by ${who}.`;
  if (when) return `Last updated ${when} SAST.`;
  return `Last updated by ${who}.`;
}

/** Drop a secret if it ever lands in a message. The public tail is not removed. */
export function redactSecret(message: string, secret: string): string {
  const text = String(message || '');
  const key = String(secret || '');
  if (key.length < 8 || !text.includes(key)) return text;
  return text.split(key).join('');
}
