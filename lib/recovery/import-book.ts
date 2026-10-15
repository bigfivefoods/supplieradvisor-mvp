import { normaliseEmail, normalisePhoneZA, parseAmountCents, parseDateStrict } from './normalise';
import { validateSaId } from './sa-id';

export const MAX_BOOK_BYTES = 2 * 1024 * 1024;
export const MAX_BOOK_ROWS = 2000;

export type BookIssue = { row: number; field: string; code: string };

export type BookContact = {
  kind: 'phone' | 'email' | 'address';
  value: string;
  source: 'import';
  quality: 'unknown';
  do_not_contact: boolean;
  s129_delivery_method: 'registered_mail' | 'hand_delivery' | null;
};

export type ValidBookRow = {
  row: number;
  creditor_account_ref: string;
  display_name: string;
  kind: 'person' | 'company';
  first_names: string;
  last_name: string;
  company_name: string;
  id_type: 'sa_id' | 'passport' | 'company_reg' | 'other' | '';
  id_plain: string | null;
  principal_cents: number;
  interest_cents: number;
  fees_cents: number;
  costs_cents: number;
  original_cents: number;
  default_date: string | null;
  contacts: BookContact[];
};

export type BookValidation = {
  rows: ValidBookRow[];
  errors: BookIssue[];
  warnings: BookIssue[];
  summary: { will_create: number; already_placed: number; errors: number; warnings: number };
};

const FIELD_SYNONYMS: Record<string, string[]> = {
  creditor_account_ref: ['account number', 'acc no', 'account no', 'reference', 'policy no', 'policy number', 'account ref'],
  display_name: ['name', 'debtor', 'debtor name', 'customer name'],
  first_names: ['first name', 'first names', 'given name'],
  last_name: ['surname', 'last name', 'family name'],
  company_name: ['company', 'company name', 'business name'],
  id_number: ['id', 'id number', 'sa id', 'identity number'],
  id_type: ['id type', 'identity type'],
  phone: ['phone', 'mobile', 'cell', 'telephone'],
  email: ['email', 'e-mail'],
  address: ['address', 'postal address'],
  s129_delivery_method: ['s129', 'delivery method', 'section 129'],
  principal_cents: ['principal', 'capital', 'amount', 'balance', 'capital balance'],
  interest_cents: ['interest'],
  fees_cents: ['fees', 'fee'],
  costs_cents: ['costs', 'cost'],
  default_date: ['default date', 'date of default', 'defaulted'],
};

export function parseBookCsv(
  text: string
): { ok: true; headers: string[]; rows: string[][] } | { ok: false; code: 'utf8' | 'byte_cap' | 'empty' | 'row_cap' } {
  if (text.includes('\u0000')) return { ok: false, code: 'utf8' };
  if (byteLength(text) > MAX_BOOK_BYTES) return { ok: false, code: 'byte_cap' };
  let body = text;
  if (body.charCodeAt(0) === 0xfeff) body = body.slice(1);
  if (!body.trim()) return { ok: false, code: 'empty' };
  const delim = sniffDelim(body);
  const records = parseRecords(body, delim);
  if (records.length === 0) return { ok: false, code: 'empty' };
  if (records.length - 1 > MAX_BOOK_ROWS) return { ok: false, code: 'row_cap' };
  return {
    ok: true,
    headers: records[0].map((cell) => cell.trim()),
    rows: records.slice(1).filter((row) => row.some((cell) => cell.trim() !== '')),
  };
}

export function decodeBookUtf8(bytes: Uint8Array): { ok: true; text: string } | { ok: false; code: 'utf8' } {
  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, code: 'utf8' };
  }
}

export function suggestMapping(headers: readonly string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const key = header.trim().toLowerCase();
    for (const [field, names] of Object.entries(FIELD_SYNONYMS)) {
      if (names.includes(key) || key === field) {
        if (!mapping[field]) mapping[field] = header;
      }
    }
  }
  return mapping;
}

export function canonicalBook(text: string): string {
  let body = text;
  if (body.charCodeAt(0) === 0xfeff) body = body.slice(1);
  return body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export async function fileSha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(canonicalBook(text));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function validateBook(
  parsed: { headers: string[]; rows: string[][] },
  mapping: Record<string, string>,
  ctx: {
    existingRefs?: readonly string[];
    today?: string;
    mandate?: { nca_regulated: boolean; product_type: string };
  } = {}
): BookValidation {
  const errors: BookIssue[] = [];
  const warnings: BookIssue[] = [];
  const rows: ValidBookRow[] = [];
  const seen = new Set<string>();
  const existing = new Set((ctx.existingRefs || []).map((ref) => ref.trim().toLowerCase()));
  const index = new Map(parsed.headers.map((header, i) => [header, i]));

  const cell = (row: string[], field: string) => {
    const header = mapping[field];
    if (!header || !index.has(header)) return '';
    return String(row[index.get(header) as number] ?? '').trim();
  };

  if (!mapping.creditor_account_ref) errors.push({ row: 0, field: 'creditor_account_ref', code: 'missing_column' });
  if (!mapping.display_name && !mapping.first_names && !mapping.company_name) {
    errors.push({ row: 0, field: 'display_name', code: 'missing_column' });
  }
  if (!mapping.principal_cents) errors.push({ row: 0, field: 'principal_cents', code: 'missing_column' });
  if (errors.length) {
    return { rows: [], errors, warnings, summary: { will_create: 0, already_placed: 0, errors: errors.length, warnings: 0 } };
  }

  let already = 0;
  parsed.rows.forEach((raw, offset) => {
    const row = offset + 2;
    const ref = cell(raw, 'creditor_account_ref');
    if (!ref) {
      errors.push({ row, field: 'creditor_account_ref', code: 'required' });
      return;
    }
    const key = ref.toLowerCase();
    if (seen.has(key) || existing.has(key)) {
      errors.push({ row, field: 'creditor_account_ref', code: 'duplicate_account' });
      already += 1;
      seen.add(key);
      return;
    }
    seen.add(key);
    const first = cell(raw, 'first_names');
    const last = cell(raw, 'last_name');
    const company = cell(raw, 'company_name');
    const named = cell(raw, 'display_name') || [first, last].filter(Boolean).join(' ') || company;
    if (!named) {
      errors.push({ row, field: 'display_name', code: 'required' });
      return;
    }
    const principal = parseAmountCents(cell(raw, 'principal_cents'));
    if (!principal.ok) {
      errors.push({ row, field: 'principal_cents', code: principal.reason });
      return;
    }
    const interest = optionalAmount(cell(raw, 'interest_cents'));
    const fees = optionalAmount(cell(raw, 'fees_cents'));
    const costs = optionalAmount(cell(raw, 'costs_cents'));
    if (!interest.ok) {
      errors.push({ row, field: 'interest_cents', code: interest.reason });
      return;
    }
    if (!fees.ok) {
      errors.push({ row, field: 'fees_cents', code: fees.reason });
      return;
    }
    if (!costs.ok) {
      errors.push({ row, field: 'costs_cents', code: costs.reason });
      return;
    }
    let defaultDate: string | null = null;
    const dateRaw = cell(raw, 'default_date');
    if (dateRaw) {
      const date = parseDateStrict(dateRaw, { purpose: 'default_date', today: ctx.today });
      if (!date.ok) {
        errors.push({ row, field: 'default_date', code: date.reason });
        return;
      }
      defaultDate = date.value;
    }
    const contacts: BookContact[] = [];
    const phoneRaw = cell(raw, 'phone');
    if (phoneRaw) {
      const phone = normalisePhoneZA(phoneRaw);
      if (!phone.ok) warnings.push({ row, field: 'phone', code: 'invalid_phone' });
      else contacts.push({ kind: 'phone', value: phone.value, source: 'import', quality: 'unknown', do_not_contact: false, s129_delivery_method: null });
    }
    const emailRaw = cell(raw, 'email');
    if (emailRaw) {
      const email = normaliseEmail(emailRaw);
      if (!email.ok) warnings.push({ row, field: 'email', code: 'invalid_email' });
      else contacts.push({ kind: 'email', value: email.value, source: 'import', quality: 'unknown', do_not_contact: false, s129_delivery_method: null });
    }
    const address = cell(raw, 'address');
    if (address) {
      const method = cell(raw, 's129_delivery_method');
      const s129 = method === 'registered_mail' || method === 'hand_delivery' ? method : null;
      contacts.push({ kind: 'address', value: address.slice(0, 320), source: 'import', quality: 'unknown', do_not_contact: false, s129_delivery_method: s129 });
    }
    let idPlain: string | null = null;
    let idType = cell(raw, 'id_type') as ValidBookRow['id_type'];
    const idRaw = cell(raw, 'id_number');
    if (idRaw) {
      if (!idType) idType = 'sa_id';
      if (idType === 'sa_id') {
        const checked = validateSaId(idRaw);
        if (!checked.ok) warnings.push({ row, field: 'id_number', code: 'invalid_id' });
        else idPlain = idRaw;
      } else {
        idPlain = idRaw.slice(0, 40);
      }
    }
    void ctx.mandate;
    rows.push({
      row,
      creditor_account_ref: ref.slice(0, 80),
      display_name: named.slice(0, 200),
      kind: company && !first ? 'company' : 'person',
      first_names: first.slice(0, 120),
      last_name: last.slice(0, 120),
      company_name: company.slice(0, 200),
      id_type: idType,
      id_plain: idPlain,
      principal_cents: principal.cents,
      interest_cents: interest.cents,
      fees_cents: fees.cents,
      costs_cents: costs.cents,
      original_cents: principal.cents,
      default_date: defaultDate,
      contacts,
    });
  });

  return {
    rows,
    errors: errors.slice(0, 200),
    warnings: warnings.slice(0, 200),
    summary: {
      will_create: rows.length,
      already_placed: already,
      errors: errors.length,
      warnings: warnings.length,
    },
  };
}

function optionalAmount(raw: string): { ok: true; cents: number } | { ok: false; reason: string } {
  if (!raw) return { ok: true, cents: 0 };
  const parsed = parseAmountCents(raw);
  return parsed.ok ? { ok: true, cents: parsed.cents } : parsed;
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function sniffDelim(text: string): ',' | ';' {
  const line = text.split(/\r?\n/, 1)[0] || '';
  const commas = (line.match(/,/g) || []).length;
  const semis = (line.match(/;/g) || []).length;
  return semis > commas ? ';' : ',';
}

function parseRecords(text: string, delim: ',' | ';'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const body = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (quoted) {
      if (char === '"') {
        if (body[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === delim) {
      row.push(cell);
      cell = '';
      continue;
    }
    if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
