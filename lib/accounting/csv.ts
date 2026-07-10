/**
 * Bank statement CSV parsers for SA banks (FNB / RMB-style) + universal template.
 * Amounts are signed: + money in (credit to bank), − money out (debit from bank).
 */

export type ParsedBankLine = {
  txn_date: string; // YYYY-MM-DD
  description: string;
  reference: string | null;
  amount: number;
  balance_after: number | null;
  counterparty_name: string | null;
  external_id: string;
  raw: Record<string, string>;
};

export type ParseResult = {
  format: 'fnb' | 'rmb' | 'universal' | 'auto';
  lines: ParsedBankLine[];
  warnings: string[];
  skipped: number;
};

function normalizeHeader(h: string): string {
  return String(h || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[_\s/.\-]+/g, '');
}

/** Minimal CSV split that respects double-quoted fields */
export function splitCsvLine(line: string, delimiter = ','): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out.map((c) => c.replace(/^"|"$/g, '').trim());
}

function detectDelimiter(headerLine: string): string {
  const commas = (headerLine.match(/,/g) || []).length;
  const semis = (headerLine.match(/;/g) || []).length;
  const tabs = (headerLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semis) return '\t';
  if (semis > commas) return ';';
  return ',';
}

export function parseAmount(raw: string | null | undefined): number | null {
  if (raw == null || String(raw).trim() === '') return null;
  let s = String(raw).trim();
  // (1,234.56) accounting negative
  const paren = s.match(/^\((.+)\)$/);
  if (paren) s = '-' + paren[1];
  s = s.replace(/R\s*/gi, '').replace(/\s/g, '');
  // 1.234,56 European
  if (/^\-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\-?\d+,\d{2}$/.test(s)) {
    s = s.replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : null;
}

/** Accept DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, DD Mon YYYY */
export function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    const m = String(dmy[2]).padStart(2, '0');
    const d = String(dmy[1]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // DD Mon YYYY
  const mon = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (mon) {
    const months: Record<string, string> = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      may: '05',
      jun: '06',
      jul: '07',
      aug: '08',
      sep: '09',
      oct: '10',
      nov: '11',
      dec: '12',
    };
    const mm = months[mon[2].slice(0, 3).toLowerCase()];
    if (mm) {
      return `${mon[3]}-${mm}-${String(mon[1]).padStart(2, '0')}`;
    }
  }

  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    return new Date(t).toISOString().slice(0, 10);
  }
  return null;
}

function hashLine(parts: Array<string | number | null | undefined>): string {
  const s = parts.map((p) => String(p ?? '')).join('|');
  // simple stable hash (not crypto) — good enough for dedupe within company
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return `bt_${Math.abs(h).toString(36)}_${s.length}`;
}

type ColMap = {
  date?: string;
  description?: string;
  reference?: string;
  amount?: string;
  moneyIn?: string;
  moneyOut?: string;
  balance?: string;
  counterparty?: string;
};

function mapColumns(headers: string[]): { map: ColMap; normalized: string[] } {
  const normalized = headers.map(normalizeHeader);
  const map: ColMap = {};

  const find = (...candidates: string[]) => {
    for (const c of candidates) {
      const i = normalized.indexOf(c);
      if (i >= 0) return headers[i];
    }
    return undefined;
  };

  map.date = find(
    'date',
    'transactiondate',
    'txndate',
    'posteddate',
    'valuedate',
    'postingdate',
    'trandate'
  );
  map.description = find(
    'description',
    'narration',
    'details',
    'transactiondescription',
    'trandesc',
    'memo',
    'particulars'
  );
  map.reference = find(
    'reference',
    'ref',
    'chequenumber',
    'chequeno',
    'transactionreference',
    'bankreference',
    'trancode'
  );
  map.amount = find('amount', 'value', 'transactionamount', 'amt');
  map.moneyIn = find(
    'moneyin',
    'credit',
    'creditamount',
    'deposit',
    'credits',
    'amountin',
    'cr'
  );
  map.moneyOut = find(
    'moneyout',
    'debit',
    'debitamount',
    'withdrawal',
    'debits',
    'amountout',
    'dr',
    'payments'
  );
  map.balance = find('balance', 'runningbalance', 'accountbalance', 'closingbalance');
  map.counterparty = find(
    'counterparty',
    'payee',
    'payer',
    'beneficiary',
    'name',
    'fromto'
  );

  return { map, normalized };
}

function detectFormat(normalized: string[]): ParseResult['format'] {
  const set = new Set(normalized);
  // FNB often: Date, Description, Amount, Balance or Money In / Money Out
  if (
    (set.has('moneyin') || set.has('credit')) &&
    (set.has('moneyout') || set.has('debit'))
  ) {
    return 'fnb';
  }
  if (set.has('amount') && set.has('date') && set.has('description')) {
    return 'universal';
  }
  return 'auto';
}

/**
 * Parse full CSV text into bank lines.
 * formatHint: 'fnb' | 'rmb' | 'universal' | 'auto'
 */
export function parseBankCsv(
  csvText: string,
  formatHint: string = 'auto'
): ParseResult {
  const warnings: string[] = [];
  const text = String(csvText || '').replace(/^\uFEFF/, '');
  const rawLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (rawLines.length < 2) {
    return { format: 'auto', lines: [], warnings: ['CSV has no data rows'], skipped: 0 };
  }

  // Skip title lines until we find a header with a date-like column
  let headerIdx = 0;
  let delimiter = ',';
  let headers: string[] = [];
  let colMap: ColMap = {};
  let format: ParseResult['format'] = 'auto';

  for (let i = 0; i < Math.min(15, rawLines.length); i++) {
    delimiter = detectDelimiter(rawLines[i]);
    const cells = splitCsvLine(rawLines[i], delimiter);
    const { map, normalized } = mapColumns(cells);
    if (map.date && (map.description || map.amount || map.moneyIn || map.moneyOut)) {
      headerIdx = i;
      headers = cells;
      colMap = map;
      format =
        formatHint === 'fnb' || formatHint === 'rmb' || formatHint === 'universal'
          ? (formatHint as ParseResult['format'])
          : detectFormat(normalized);
      break;
    }
  }

  if (!colMap.date) {
    return {
      format: 'auto',
      lines: [],
      warnings: [
        'Could not detect date/description columns. Use universal headers: Date, Description, Amount, Reference, Balance',
      ],
      skipped: 0,
    };
  }

  const lines: ParsedBankLine[] = [];
  let skipped = 0;

  for (let i = headerIdx + 1; i < rawLines.length; i++) {
    const cells = splitCsvLine(rawLines[i], delimiter);
    if (cells.every((c) => !c)) {
      skipped++;
      continue;
    }
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? '';
    });

    const get = (key?: string) => (key ? row[key] ?? '' : '');
    const date = parseDate(get(colMap.date));
    if (!date) {
      skipped++;
      continue;
    }

    let amount: number | null = null;
    if (colMap.amount) {
      amount = parseAmount(get(colMap.amount));
    }
    if (amount == null && (colMap.moneyIn || colMap.moneyOut)) {
      const inn = parseAmount(get(colMap.moneyIn)) || 0;
      const out = parseAmount(get(colMap.moneyOut)) || 0;
      // FNB: money in positive, money out positive in own columns
      if (inn !== 0 && out !== 0) {
        amount = inn - out;
      } else if (inn !== 0) {
        amount = Math.abs(inn);
      } else if (out !== 0) {
        amount = -Math.abs(out);
      } else {
        amount = 0;
      }
    }

    if (amount == null || amount === 0) {
      // zero-amount rows often fees with empty columns — skip
      skipped++;
      continue;
    }

    const description =
      get(colMap.description) ||
      get(colMap.counterparty) ||
      get(colMap.reference) ||
      'Bank transaction';

    const reference = get(colMap.reference) || null;
    const balance_after = colMap.balance ? parseAmount(get(colMap.balance)) : null;
    const counterparty_name = get(colMap.counterparty) || null;

    const external_id = hashLine([
      date,
      description,
      reference,
      amount,
      balance_after,
    ]);

    lines.push({
      txn_date: date,
      description: description.slice(0, 500),
      reference: reference ? reference.slice(0, 200) : null,
      amount,
      balance_after,
      counterparty_name: counterparty_name ? counterparty_name.slice(0, 200) : null,
      external_id,
      raw: row,
    });
  }

  if (lines.length === 0) {
    warnings.push('No transaction rows parsed. Check date format (DD/MM/YYYY or YYYY-MM-DD).');
  }

  return { format, lines, warnings, skipped };
}

/** Template CSV for manual paste/export */
export const UNIVERSAL_CSV_TEMPLATE = `Date,Description,Amount,Reference,Balance
2026-07-01,Customer payment ABC,+15000.00,INV-001,100000.00
2026-07-02,Office rent,-8500.00,RENT-JUL,91500.00
2026-07-03,Supplier payment XYZ,-3200.50,BILL-042,88299.50
`;
