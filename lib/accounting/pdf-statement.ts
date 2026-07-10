/**
 * Extract text from bank statement PDFs and parse into bank lines.
 * Works best with text-based FNB/RMB PDFs (not scanned image-only PDFs).
 */

import type { ParsedBankLine, ParseResult } from './csv';
import { parseAmount, parseDate } from './csv';

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
 * Amount tokens at end of line: optional CR/DR, R prefix, commas, parentheses.
 * Returns signed amount (positive = money in for CR or bare credit context).
 */
function extractTrailingAmounts(line: string): {
  amounts: number[];
  head: string;
} {
  const amounts: number[] = [];
  let rest = line;

  // Match from the end: amount patterns, optionally preceded by CR/DR
  // e.g. "1,234.56" or "R1 234.56" or "(500.00)" or "500.00 CR"
  const amountRe =
    /(?:\b(CR|DR|Credit|Debit)\b\s*)?([R]?\s*\(?\-?[\d]{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?\)?|\(?\-?\d+\.\d{2}\)?)(?:\s*(CR|DR))?$/i;

  for (let i = 0; i < 4; i++) {
    const m = rest.match(amountRe);
    if (!m) break;
    const token = m[2] || m[0];
    let n = parseAmount(token.replace(/\s/g, ''));
    if (n == null) break;
    const flag = (m[1] || m[3] || '').toUpperCase();
    if (flag === 'DR' || flag === 'DEBIT') n = -Math.abs(n);
    else if (flag === 'CR' || flag === 'CREDIT') n = Math.abs(n);
    amounts.unshift(n);
    rest = rest.slice(0, m.index).trim();
  }

  return { amounts, head: rest };
}

/** Detect DD/MM/YYYY or similar at start of line */
function extractLeadingDate(line: string): { date: string | null; rest: string } {
  // 01/07/2024 or 01-07-2024 or 2024-07-01 or 01 Jul 2024
  const patterns = [
    /^(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\s+(.+)$/,
    /^(\d{4}-\d{2}-\d{2})\s+(.+)$/,
    /^(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\s+(.+)$/,
    /^(\d{1,2}\s+[A-Za-z]{3}\s+\d{2})\s+(.+)$/, // 01 Jul 24
  ];
  for (const re of patterns) {
    const m = line.match(re);
    if (m) {
      let dateStr = m[1];
      // expand 2-digit year month names if needed
      if (/^\d{1,2}\s+[A-Za-z]{3}\s+\d{2}$/.test(dateStr)) {
        const parts = dateStr.split(/\s+/);
        const y = Number(parts[2]) + 2000;
        dateStr = `${parts[0]} ${parts[1]} ${y}`;
      }
      const d = parseDate(dateStr);
      if (d) return { date: d, rest: m[2].trim() };
    }
  }
  return { date: null, rest: line };
}

function isNoiseLine(line: string): boolean {
  const l = line.toLowerCase();
  if (line.length < 8) return true;
  if (/^page\s+\d+/i.test(line)) return true;
  if (/statement\s*(period|date|number)/i.test(l)) return true;
  if (/opening\s+balance|closing\s+balance|available\s+balance/i.test(l) && !/\d{1,2}[\/\-]\d{1,2}/.test(line))
    return true;
  if (/first national bank|fnb|rmb private|account number|branch code/i.test(l) && line.length < 80)
    return true;
  if (/^date\s+description/i.test(l)) return true;
  if (/money\s+in|money\s+out|balance\s*$/i.test(l) && line.length < 60) return true;
  if (/^\*+/.test(line)) return true;
  if (/vat\s+registration|tax\s+invoice/i.test(l)) return true;
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
    /^(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3})/.test(l)
  );
  if (dated.length >= 2) return raw;

  // Insert newlines before date tokens that look like txn starts
  return raw.replace(
    /(?<=\S)\s+(?=(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2})\s+)/g,
    '\n'
  );
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
      warnings: ['PDF contained no extractable text. It may be a scanned image — use OCR export or ask the bank for CSV/Excel.'],
      skipped: 0,
    };
  }

  // Normalize: sometimes PDFs put amount on next line; sometimes all on one line
  const rawLines = ensureTransactionLines(text)
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);

  // Merge orphan amount-only lines with previous
  const merged: string[] = [];
  for (const line of rawLines) {
    if (/^[R]?\s*\(?\-?[\d,]+\.\d{2}\)?\s*(CR|DR)?$/i.test(line) && merged.length) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${line}`;
    } else {
      merged.push(line);
    }
  }

  for (const line of merged) {
    if (isNoiseLine(line)) {
      skipped++;
      continue;
    }

    const { date, rest } = extractLeadingDate(line);
    if (!date) {
      skipped++;
      continue;
    }

    const { amounts, head } = extractTrailingAmounts(rest);
    if (amounts.length === 0) {
      skipped++;
      continue;
    }

    // Convention: last amount is often balance; previous is transaction amount
    // If only one amount: treat as txn amount (no balance)
    let amount: number;
    let balance_after: number | null = null;

    if (amounts.length >= 2) {
      balance_after = amounts[amounts.length - 1];
      amount = amounts[amounts.length - 2];
      // If there's money-in and money-out columns (3 amounts before balance rare)
      if (amounts.length >= 3) {
        // in, out, balance
        const a0 = amounts[0];
        const a1 = amounts[1];
        if (a0 !== 0 && a1 !== 0 && Math.abs(a0) !== Math.abs(a1)) {
          // prefer non-zero: if one looks like fee small and one large...
          // FNB style: credit, debit, balance — one of credit/debit is 0
          amount = Math.abs(a0) >= Math.abs(a1) ? (a0 !== 0 ? a0 : -Math.abs(a1)) : -Math.abs(a1);
          // Better: if first is credit column and second debit
          if (a0 > 0 && a1 === 0) amount = a0;
          else if (a0 === 0 && a1 > 0) amount = -a1;
          else if (a0 > 0 && a1 > 0) amount = a0 - a1;
        }
      }
    } else {
      amount = amounts[0];
    }

    // Heuristic: if amount equals balance and description suggests opening — skip
    if (
      balance_after != null &&
      Math.abs(amount) === Math.abs(balance_after) &&
      /opening|brought\s+forward|balance\s+b\/?f/i.test(head)
    ) {
      skipped++;
      continue;
    }

    // Infer sign from keywords if amount is positive but looks like payment
    if (amount > 0 && /\b(payment to|paid to|debit order|purchase|withdrawal|fee|charge|stop order)\b/i.test(head)) {
      // keep positive if description is "payment from"
      if (!/\b(payment from|deposit|credit|received|salary|transfer from|refund)\b/i.test(head)) {
        amount = -Math.abs(amount);
      }
    }

    if (amount === 0) {
      skipped++;
      continue;
    }

    const description = head.replace(/\s{2,}/g, ' ').slice(0, 500) || 'Bank transaction';
    // Try to pull a ref-like token
    const refMatch = description.match(/\b([A-Z0-9]{6,})\b/);
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

  // Deduplicate consecutive identical lines
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
    textPreview: extracted.text.slice(0, 800),
    csv: linesToCsv(parsed.lines),
  };
}
