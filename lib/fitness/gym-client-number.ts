/**
 * Gym desk client number = padded CoA AR leaf (1180-0000123).
 * Do not invent 1180.1, 6-digit pads, or 4100-*.
 */
const PADDED_AR_RE = /^1180-\d{7}$/;

export function gymClientNumberFromAr(ar?: string | null): string {
  const code = String(ar || '').trim();
  return PADDED_AR_RE.test(code) ? code : '';
}

export function needsAdvisorPersonCodeFromAr(
  person: {
    id?: string;
    code?: string | null;
    ar_account_code?: string | null;
  },
  others: Array<{ id?: string; code?: string | null }> = []
): boolean {
  const want = gymClientNumberFromAr(person.ar_account_code);
  if (!want) return false;
  if (String(person.code || '').trim() === want) return false;
  const selfId = String(person.id || '');
  return !others.some((o) => {
    if (o === person) return false;
    if (selfId && String(o.id || '') === selfId) return false;
    return String(o.code || '').trim() === want;
  });
}

export function applyAdvisorPersonCodeFromAr(
  person: {
    id?: string;
    code?: string | null;
    ar_account_code?: string | null;
  },
  others: Array<{ id?: string; code?: string | null }> = []
): boolean {
  if (!needsAdvisorPersonCodeFromAr(person, others)) return false;
  person.code = gymClientNumberFromAr(person.ar_account_code);
  return true;
}

export const needsGymClientNumber = needsAdvisorPersonCodeFromAr;
export const applyGymClientNumberFromAr = applyAdvisorPersonCodeFromAr;

export function recodeGymClientNumbers(
  clients: Array<{
    id?: string;
    code?: string | null;
    ar_account_code?: string | null;
  }>
): number {
  let n = 0;
  for (const person of clients || []) {
    if (applyAdvisorPersonCodeFromAr(person, clients)) n += 1;
  }
  return n;
}

/** Check-in keys: desk code, full CoA, 7-digit party UID, national ID. */
export function gymClientLookupKeys(person: {
  code?: string | null;
  ar_account_code?: string | null;
  id_number?: string | null;
}): string[] {
  const keys = new Set<string>();
  const add = (raw?: string | null) => {
    const t = String(raw || '')
      .trim()
      .toLowerCase();
    if (t) keys.add(t);
  };
  add(person.code);
  add(person.ar_account_code);
  add(person.id_number);
  const ar = String(person.ar_account_code || '').trim();
  if (PADDED_AR_RE.test(ar)) add(ar.slice(5));
  return [...keys];
}
