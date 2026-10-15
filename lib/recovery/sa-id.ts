export type SaIdResult =
  | { ok: true }
  | { ok: false; reason: 'length' | 'digits' | 'date' | 'citizenship' | 'checksum' };

/** Calendar date is accepted when it is real in 19YY or in 20YY. Age is not inferred. */
export function validateSaId(id: string): SaIdResult {
  if (id.length !== 13) return { ok: false, reason: 'length' };
  if (!/^\d{13}$/.test(id)) return { ok: false, reason: 'digits' };
  const yy = Number(id.slice(0, 2));
  const mm = Number(id.slice(2, 4));
  const dd = Number(id.slice(4, 6));
  if (!calendarOk(1900 + yy, mm, dd) && !calendarOk(2000 + yy, mm, dd)) {
    return { ok: false, reason: 'date' };
  }
  const citizen = id[10];
  if (citizen !== '0' && citizen !== '1') return { ok: false, reason: 'citizenship' };
  if (!luhnOk(id)) return { ok: false, reason: 'checksum' };
  return { ok: true };
}

export function withChecksum(first12: string): string {
  if (!/^\d{12}$/.test(first12)) throw new Error('head');
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    let digit = Number(first12[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  const check = (10 - (sum % 10)) % 10;
  return `${first12}${check}`;
}

/** Fictional 13-digit value that fails the checksum. Not a person's number. */
export function fictionalInvalidSaId(n: number): string {
  const seq = String(5000 + (Math.abs(n) % 4000)).padStart(4, '0');
  const head = `900101${seq}08`;
  const valid = withChecksum(head);
  const bad = (Number(valid[12]) + 1) % 10;
  return `${valid.slice(0, 12)}${bad}`;
}

function calendarOk(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function luhnOk(id: string): boolean {
  let sum = 0;
  for (let i = 0; i < 13; i += 1) {
    let digit = Number(id[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}
