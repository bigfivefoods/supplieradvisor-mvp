export function digitsOnly(raw: unknown): string {
  return String(raw || '').replace(/\D/g, '');
}

export function maskAccountNumber(raw: unknown): string {
  const d = digitsOnly(raw);
  if (!d) return '';
  if (d.length <= 4) return `•••• ${d}`;
  return `•••• ${d.slice(-4)}`;
}

export function maskIdNumber(raw: unknown): string {
  const d = digitsOnly(raw);
  if (!d) return '';
  if (d.length <= 4) return `•••• ${d}`;
  return `${'•'.repeat(Math.max(4, d.length - 4))}${d.slice(-4)}`;
}

export function maskEmail(raw: unknown): string {
  const value = String(raw || '').trim();
  const [name, host] = value.split('@');
  if (!name || !host) return value;
  if (name.length <= 2) return `${name[0] || '*'}***@${host}`;
  return `${name[0]}***${name.slice(-1)}@${host}`;
}
