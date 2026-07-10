/**
 * Extract text from bank statement PDFs and parse into bank lines.
 * Tuned for FNB / RMB Gold Business (and similar SA) text PDFs.
 * Works best with text-based PDFs (not scanned image-only).
 */

import type { ParsedBankLine, ParseResult } from './csv';
import { parseAmount, parseDate } from './csv';

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function hashLine(parts: Array<string | number | null | undefined>): string {
  const s = parts.map((p) => String(p ?? '')).join('|');
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return `pdf_${Math.abs(h).toString(36)}_${s.length}`;
}

/** Strip currency noise and normalize spaces */
function cleanLine(s: string): string {
  return s
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse FNB-style money token: 1,234.56 / 1234.56 / 1 234.56 / 10,062.50Cr / (500.00)
 * Returns signed amount: Cr = money in (+), Dr = money out (−).
 * Bare amounts default to `defaultSign` (+1 or −1).
 */
function parseMoneyToken(
  raw: string,
  defaultSign: 1 | -1 = -1
): { amount: number; flagged: boolean } | null {
  let s = String(raw || '').trim();
  if (!s) return null;

  let flagged = false;
  let sign: 1 | -1 = defaultSign;

  // Trailing Cr/Dr (glued or spaced)
  const crdr = s.match(/^(.*?)[\s]*(CR|DR|Cr|Dr|Credit|Debit)$/i);
  if (crdr) {
    s = crdr[1].trim();
    flagged = true;
    const flag = crdr[2].toUpperCase();
    if (flag.startsWith('CR') || flag === 'CREDIT') sign = 1;
    else sign = -1;
  }

  // Leading sign / parens
  if (/^\(.*\)$/.test(s)) {
    s = s.slice(1, -1);
    sign = -1;
    flagged = true;
  }
  if (s.startsWith('+')) {
    s = s.slice(1);
    sign = 1;
    flagged = true;
  } else if (s.startsWith('-')) {
    s = s.slice(1);
    sign = -1;
    flagged = true;
  }

  s = s.replace(/^R\s*/i, '').replace(/\s/g, '');
  // 1.234,56 European
  if (/^\d{1,3}(\.\d{3})+,\d{2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const amount = Math.round((Math.abs(n) * sign + Number.EPSILON) * 100) / 100;
  return { amount, flagged };
}

/**
 * Pull trailing money tokens from a line (right → left).
 * FNB lines often end with: [amount][balance Cr/Dr][optional fee]
 */
function extractTrailingMoneyTokens(line: string): {
  tokens: Array<{ amount: number; flagged: boolean; raw: string }>;
  head: string;
} {
  const tokens: Array<{ amount: number; flagged: boolean; raw: string }> = [];
  let rest = line.trim();

  // From the right: amount with optional glued/spaced Cr|Dr
  // e.g. 3.68 | 316,828.77Cr | 10,062.50Cr | 100,000.00 | R2 500.00
  const tokenRe =
    /(?:^|\s)((?:R\s*)?-?[\d]{1,3}(?:[,\s]\d{3})*(?:\.\d{2})|\d+\.\d{2})\s*(CR|DR|Cr|Dr)?\s*$/i;

  for (let i = 0; i < 5; i++) {
    const m = rest.match(tokenRe);
    if (!m) break;
    const raw = (m[1] + (m[2] || '')).replace(/\s+/g, '');
    // default bare amounts as positive here; sign fixed later for FNB
    const parsed = parseMoneyToken(raw, 1);
    if (!parsed) break;
    tokens.unshift({ ...parsed, raw });
    rest = rest.slice(0, m.index).trim();
  }

  return { tokens, head: rest };
}

type PeriodContext = {
  start: Date | null;
  end: Date | null;
  years: number[];
  defaultYear: number;
};

/** Pull statement period / date from header text for year resolution. */
function extractPeriodContext(text: string): PeriodContext {
  const years: number[] = [];
  let start: Date | null = null;
  let end: Date | null = null;

  // Statement Period : 28 February 2026 to 31 March 2026
  const period = text.match(
    /Statement\s+Period\s*[:\-]?\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\s+to\s+(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i
  );
  if (period) {
    const s = parseDate(period[1]);
    const e = parseDate(period[2]);
    if (s) {
      start = new Date(s + 'T12:00:00Z');
      years.push(start.getUTCFullYear());
    }
    if (e) {
      end = new Date(e + 'T12:00:00Z');
      years.push(end.getUTCFullYear());
    }
  }

  // Statement Date : 31 March 2026  or header 2026/03/31
  const stmtDate = text.match(
    /Statement\s+Date\s*[:\-]?\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i
  );
  if (stmtDate) {
    const d = parseDate(stmtDate[1].includes('/') || stmtDate[1].includes('-')
      ? normalizeSlashDate(stmtDate[1])
      : stmtDate[1]);
    if (d) years.push(Number(d.slice(0, 4)));
  }

  // Account header line: 087 63143325983 2026/03/31 GOLD BUSINESS ACCOUNT
  const headerDate = text.match(/\b(20\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/);
  if (headerDate) years.push(Number(headerDate[1]));

  const uniq = [...new Set(years.filter((y) => y >= 2000 && y <= 2100))];
  const defaultYear =
    uniq[uniq.length - 1] ||
    (end ? end.getUTCFullYear() : new Date().getFullYear());

  return { start, end, years: uniq, defaultYear };
}

/** FNB header sometimes uses YYYY/MM/DD */
function normalizeSlashDate(raw: string): string {
  const m = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return raw;
}

function resolveDdMon(
  day: number,
  monName: string,
  ctx: PeriodContext
): string | null {
  const mon = MONTHS[monName.toLowerCase()];
  if (!mon || day < 1 || day > 31) return null;

  const candidates: number[] = [];
  if (ctx.start) candidates.push(ctx.start.getUTCFullYear());
  if (ctx.end) candidates.push(ctx.end.getUTCFullYear());
  for (const y of ctx.years) candidates.push(y);
  candidates.push(ctx.defaultYear);
  // year wrap for Dec/Jan periods
  candidates.push(ctx.defaultYear - 1, ctx.defaultYear + 1);

  const seen = new Set<number>();
  for (const y of candidates) {
    if (seen.has(y)) continue;
    seen.add(y);
    const iso = `${y}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dt = new Date(iso + 'T12:00:00Z');
    if (Number.isNaN(dt.getTime())) continue;
    if (dt.getUTCMonth() + 1 !== mon || dt.getUTCDate() !== day) continue; // invalid e.g. 31 Feb

    if (ctx.start && ctx.end) {
      // allow 2-day slack outside period (posted dates)
      const lo = new Date(ctx.start);
      lo.setUTCDate(lo.getUTCDate() - 3);
      const hi = new Date(ctx.end);
      hi.setUTCDate(hi.getUTCDate() + 5);
      if (dt >= lo && dt <= hi) return iso;
      continue;
    }
    return iso;
  }

  // fallback: default year even if outside period
  const y = ctx.defaultYear;
  return `${y}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Detect DD/MM/YYYY or DD Mon [YYYY] at start of line */
function extractLeadingDate(
  line: string,
  ctx: PeriodContext
): { date: string | null; rest: string } {
  // Full dates first
  let m = line.match(/^(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\s+(.+)$/);
  if (m) {
    const date = parseDate(m[1]);
    if (date) return { date, rest: m[2].trim() };
  }

  m = line.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
  if (m) {
    const date = parseDate(m[1]);
    if (date) return { date, rest: m[2].trim() };
  }

  m = line.match(/^(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\s+(.+)$/);
  if (m) {
    const date = parseDate(m[1]);
    if (date) return { date, rest: m[2].trim() };
  }

  m = line.match(/^(\d{1,2}\s+[A-Za-z]{3}\s+\d{2})\s+(.+)$/);
  if (m) {
    const parts = m[1].split(/\s+/);
    const y = Number(parts[2]) + 2000;
    const date = parseDate(`${parts[0]} ${parts[1]} ${y}`);
    if (date) return { date, rest: m[2].trim() };
  }

  // FNB: "28 Feb" / "02 Mar" without year
  m = line.match(/^(\d{1,2})\s+([A-Za-z]{3})\b\s+(.+)$/);
  if (m) {
    const date = resolveDdMon(Number(m[1]), m[2], ctx);
    if (date) return { date, rest: m[3].trim() };
  }

  return { date: null, rest: line };
}

function isNoiseLine(line: string): boolean {
  // Never drop lines that look like transactions (date-led)
  if (
    /^(\d{1,2}\s+[A-Za-z]{3}\b|\d{1,2}[\/\-.]\d{1,2}[\/\-.]|\d{4}-\d{2}-\d{2})/.test(
      line
    )
  ) {
    return false;
  }

  const l = line.toLowerCase();
  if (line.length < 6) return true;
  if (/^page\s+\d+/i.test(line)) return true;
  if (/^---page---$/i.test(line)) return true;
  if (/statement\s*(period|date|number)/i.test(l)) return true;
  if (/opening\s+balance|closing\s+balance|available\s+balance/i.test(l)) return true;
  // Header branding only — do NOT match "FNB App Payment" transaction lines (guarded above)
  if (
    /first national bank|rmb private bank|account number|branch (number|code)|delivery method/i.test(
      l
    ) &&
    line.length < 100
  )
    return true;
  if (/^fnb\b/i.test(line) && line.length < 40) return true;
  if (/^date\s+description/i.test(l)) return true;
  if (/^(accrued|bank|charges)\s*$/i.test(l)) return true;
  if (/money\s+in|money\s+out|balance\s*$/i.test(l) && line.length < 60) return true;
  if (/^\*+/.test(line)) return true;
  if (/vat\s+registration|tax\s+invoice|turnover for statement/i.test(l)) return true;
  if (/relationship manager|lost cards|account enquiries|universal branch/i.test(l))
    return true;
  if (/please contact us within|assume that you have received/i.test(l)) return true;
  if (/credit rate|debit rate|service fees|cash deposit fees/i.test(l)) return true;
  return false;
}

/**
 * Some extractors collapse page text into one long line. Split so each
 * date-led transaction can start on its own line.
 */
function ensureTransactionLines(text: string): string {
  const raw = text.replace(/\r\n/g, '\n');
  const lines = raw.split('\n').map(cleanLine).filter(Boolean);
  const dated = lines.filter((l) =>
    /^(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3}\b)/.test(
      l
    )
  );
  if (dated.length >= 2) return raw;

  // Insert newlines before date tokens (incl. DD Mon)
  return raw
    .replace(
      /(?<=\S)\s+(?=(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2})\s+)/g,
      '\n'
    )
    .replace(/(?<=\S)\s+(?=(\d{1,2}\s+[A-Za-z]{3})\s+(?=[A-Za-z*]))/g, '\n');
}

/**
 * FNB business lines:
 *  28 Feb POS Purchase ... 400568*2431 27 Feb 2,500.00 316,828.77Cr 3.68
 *  05 Mar Int-Banking Pmt Frm Inv-000025 10,062.50Cr 144,974.22Cr
 *  03 Mar FNB App Transfer To La 20,000.00 196,159.37Cr
 *
 * Convention after extracting trailing money tokens:
 *  - last may be accrued fee (small, unflagged) when previous is flagged balance
 *  - balance is usually flagged Cr/Dr
 *  - amount is previous; if flagged Cr → money in, else money out (debit)
 */
function interpretFnbAmounts(
  tokens: Array<{ amount: number; flagged: boolean; raw: string }>
): { amount: number; balance_after: number | null } | null {
  if (tokens.length === 0) return null;

  let working = [...tokens];

  // Drop trailing accrued bank charge if present (small absolute, unflagged, after a balance)
  if (working.length >= 3) {
    const last = working[working.length - 1];
    const prev = working[working.length - 2];
    if (
      !last.flagged &&
      Math.abs(last.amount) > 0 &&
      Math.abs(last.amount) < 50 &&
      (prev.flagged || Math.abs(prev.amount) > Math.abs(last.amount) * 5)
    ) {
      working = working.slice(0, -1);
    }
  }

  if (working.length === 1) {
    // Single amount: treat unflagged as outflow (typical POS)
    const t = working[0];
    const amount = t.flagged ? t.amount : -Math.abs(t.amount);
    return { amount, balance_after: null };
  }

  // balance = last; amount = second last
  const balTok = working[working.length - 1];
  const amtTok = working[working.length - 2];

  // Balance: Cr means positive bank balance
  let balance_after = balTok.amount;
  if (balTok.flagged) {
    // already signed by Cr/Dr
    balance_after = balTok.amount;
  } else {
    balance_after = Math.abs(balTok.amount);
  }

  let amount: number;
  if (amtTok.flagged) {
    amount = amtTok.amount; // Cr → +, Dr → −
  } else {
    // Unflagged transaction amount on FNB = debit (money out)
    amount = -Math.abs(amtTok.amount);
  }

  // If 3+ tokens left (e.g. money-in column, money-out column, balance) — rare after fee strip
  if (working.length >= 3 && !amtTok.flagged && !working[working.length - 3].flagged) {
    const a0 = working[working.length - 3];
    const a1 = amtTok;
    if (a0.amount !== 0 && a1.amount !== 0) {
      // credit col, debit col
      if (a0.amount > 0 && a1.amount === 0) amount = Math.abs(a0.amount);
      else if (a0.amount === 0 && a1.amount > 0) amount = -Math.abs(a1.amount);
    }
  }

  return { amount, balance_after };
}

/** Clean FNB description: drop process date (DD Mon) and card mask tokens at end. */
function cleanFnbDescription(head: string): string {
  let d = head.trim();
  // trailing process date like "27 Feb" or "01 Mar"
  d = d.replace(/\s+\d{1,2}\s+[A-Za-z]{3}\s*$/i, '');
  // trailing card mask 400568*2431
  d = d.replace(/\s+\d{4,6}\*\d{3,5}\s*$/i, '');
  // another process date if card was middle
  d = d.replace(/\s+\d{1,2}\s+[A-Za-z]{3}\s*$/i, '');
  return d.replace(/\s{2,}/g, ' ').trim().slice(0, 500) || 'Bank transaction';
}

/**
 * Parse plain text extracted from a bank statement PDF into transaction lines.
 */
export function parseBankStatementText(text: string): ParseResult {
  const warnings: string[] = [];
  const lines: ParsedBankLine[] = [];
  let skipped = 0;

  if (!text || !text.trim()) {
    return {
      format: 'auto',
      lines: [],
      warnings: [
        'PDF contained no extractable text. It may be a scanned image — use OCR export or ask the bank for CSV/Excel.',
      ],
      skipped: 0,
    };
  }

  const ctx = extractPeriodContext(text);

  // Normalize: sometimes PDFs put amount on next line; sometimes all on one line
  const rawLines = ensureTransactionLines(text)
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);

  // Merge orphan amount-only lines with previous
  const merged: string[] = [];
  for (const line of rawLines) {
    if (
      /^[R]?\s*\(?\-?[\d,]+\.\d{2}\)?\s*(CR|DR)?$/i.test(line) &&
      merged.length
    ) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${line}`;
    } else if (
      // continuation of wrapped description (no leading date, no strong amount pattern at start)
      merged.length &&
      !/^(\d{1,2}[\/\-.]\d{1,2}|\d{1,2}\s+[A-Za-z]{3}\b|\d{4}-\d{2}-\d{2})/.test(line) &&
      /[\d,]+\.\d{2}(Cr|Dr)?/i.test(line) &&
      !/^\d{1,2}\s+[A-Za-z]{3}\b/.test(line) &&
      line.length < 80 &&
      !isNoiseLine(line)
    ) {
      // only merge if previous line looks like incomplete txn (has date start, no balance Cr yet)
      const prev = merged[merged.length - 1];
      if (
        /^(\d{1,2}\s+[A-Za-z]{3}\b|\d{1,2}[\/\-.])/.test(prev) &&
        !/\d+\.\d{2}\s*\d{1,3}(?:,\d{3})*\.\d{2}(Cr|Dr)?/i.test(prev)
      ) {
        merged[merged.length - 1] = `${prev} ${line}`;
      } else {
        merged.push(line);
      }
    } else {
      merged.push(line);
    }
  }

  for (const line of merged) {
    if (isNoiseLine(line)) {
      skipped++;
      continue;
    }

    const { date, rest } = extractLeadingDate(line, ctx);
    if (!date) {
      skipped++;
      continue;
    }

    const { tokens, head } = extractTrailingMoneyTokens(rest);
    if (tokens.length === 0) {
      skipped++;
      continue;
    }

    const interpreted = interpretFnbAmounts(tokens);
    if (!interpreted || interpreted.amount === 0) {
      skipped++;
      continue;
    }

    let { amount, balance_after } = interpreted;

    // Heuristic: if amount equals balance and description suggests opening — skip
    if (
      balance_after != null &&
      Math.abs(amount) === Math.abs(balance_after) &&
      /opening|brought\s+forward|balance\s+b\/?f/i.test(head)
    ) {
      skipped++;
      continue;
    }

    // Infer sign from keywords if still ambiguous (bare positive leftover from non-FNB)
    if (
      amount > 0 &&
      /\b(payment to|paid to|debit order|purchase|withdrawal|fee|charge|stop order|send money|transfer to)\b/i.test(
        head
      )
    ) {
      if (
        !/\b(payment from|pmt frm|deposit|credit|received|salary|transfer from|refund|magtape credit)\b/i.test(
          head
        )
      ) {
        // Only flip if token wasn't explicitly Cr-flagged
        // If amount came out positive without Cr on FNB credit lines we already handled;
        // keyword flip for non-FNB universal lines
        if (!/\d+\.\d{2}\s*Cr\b/i.test(line) && !tokens.some((t) => t.flagged && t.amount > 0 && Math.abs(t.amount) === Math.abs(amount))) {
          amount = -Math.abs(amount);
        }
      }
    }

    // FNB: "Payment From" / "Pmt Frm" / "Magtape Credit" with bare amounts should be +
    if (
      amount < 0 &&
      /\b(payment from|pmt frm|int-banking pmt frm|magtape credit|deposit|salary)\b/i.test(head) &&
      tokens.some((t) => t.flagged && t.amount > 0)
    ) {
      // amount token should already be Cr-flagged; if we mis-picked fee, fix
      const creditTok = tokens.find((t) => t.flagged && t.amount > 0 && Math.abs(t.amount) !== Math.abs(balance_after || 0));
      if (creditTok) amount = Math.abs(creditTok.amount);
    }

    if (amount === 0) {
      skipped++;
      continue;
    }

    const description = cleanFnbDescription(head);
    const refMatch =
      description.match(/\b(INV[-_]?\d+)\b/i) ||
      description.match(/\b([A-Z0-9]{6,})\b/);
    const reference = refMatch ? refMatch[1] : null;

    const external_id = hashLine([date, description, amount, balance_after]);

    lines.push({
      txn_date: date,
      description,
      reference,
      amount,
      balance_after,
      counterparty_name: null,
      external_id,
      raw: { source_line: line },
    });
  }

  // Deduplicate identical external ids
  const deduped: ParsedBankLine[] = [];
  const seen = new Set<string>();
  for (const l of lines) {
    if (seen.has(l.external_id)) {
      skipped++;
      continue;
    }
    seen.add(l.external_id);
    deduped.push(l);
  }

  if (deduped.length === 0) {
    warnings.push(
      'No transactions found in PDF text. Try a different statement export, or convert PDF→CSV in Excel and import CSV.'
    );
  } else {
    warnings.push(
      `Parsed ${deduped.length} lines from PDF text. Review amounts carefully — PDF layouts vary by bank product.`
    );
  }

  return {
    format: 'auto',
    lines: deduped,
    warnings,
    skipped,
  };
}

/** Convert parsed lines to universal CSV string (for download / re-import) */
export function linesToCsv(lines: ParsedBankLine[]): string {
  const header = 'Date,Description,Amount,Reference,Balance';
  const rows = lines.map((l) => {
    const esc = (s: string) => {
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    return [
      l.txn_date,
      esc(l.description),
      l.amount.toFixed(2),
      esc(l.reference || ''),
      l.balance_after != null ? l.balance_after.toFixed(2) : '',
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

/**
 * Server-side: extract text from a PDF buffer.
 *
 * Primary: `unpdf` (modern pdf.js) — handles current bank statement PDFs.
 * Fallback: `pdf-parse/lib/pdf-parse.js` (never the package root — root index
 * runs a debug open of `./test/data/05-versions-space.pdf` when bundled).
 */
export async function extractPdfText(buffer: Buffer): Promise<{
  text: string;
  pages?: number;
  error?: string;
}> {
  const errors: string[] = [];

  try {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: false });
    const pages = result.totalPages || 0;
    const text = Array.isArray(result.text)
      ? result.text.join('\n')
      : String(result.text || '');
    if (text.trim()) {
      return { text, pages };
    }
    errors.push('unpdf returned empty text');
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'unpdf failed');
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (
      data: Buffer,
      opts?: { max?: number }
    ) => Promise<{ text: string; numpages: number }>;
    const result = await pdfParse(buffer, { max: 50 });
    return { text: result.text || '', pages: result.numpages };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'pdf-parse failed');
  }

  return {
    text: '',
    error: errors.join(' · ') || 'PDF parse failed',
  };
}

export async function parseBankPdfBuffer(buffer: Buffer): Promise<
  ParseResult & { textPreview?: string; pages?: number; csv?: string }
> {
  const extracted = await extractPdfText(buffer);
  if (extracted.error) {
    return {
      format: 'auto',
      lines: [],
      warnings: [extracted.error],
      skipped: 0,
    };
  }
  const parsed = parseBankStatementText(extracted.text);
  return {
    ...parsed,
    pages: extracted.pages,
    textPreview: extracted.text.slice(0, 1200),
    csv: linesToCsv(parsed.lines),
  };
}
