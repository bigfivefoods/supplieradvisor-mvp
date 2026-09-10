/**
 * Stable enquiry UID (ENQ-…) paired with the quotation UID (QT-…).
 * Same date+suffix: QT-20260909-QVE1 ↔ ENQ-20260909-QVE1.
 */
import { parseTradeThread } from '@/lib/customers/trade-thread';

const TRADE_NUM = /^(ENQ|QT)-(\d{8}-[A-Za-z0-9]+)$/i;

export type TradeDocKind = 'ENQ' | 'QT';

export function parseTradeDocNumber(
  raw: unknown
): { kind: TradeDocKind; body: string } | null {
  const s = String(raw || '')
    .trim()
    .toUpperCase();
  const m = TRADE_NUM.exec(s);
  if (!m) return null;
  return { kind: m[1] as TradeDocKind, body: m[2] };
}

export function enquiryUidFromNumber(raw: unknown): string | null {
  const p = parseTradeDocNumber(raw);
  return p ? `ENQ-${p.body}` : null;
}

export function quoteUidFromNumber(raw: unknown): string | null {
  const p = parseTradeDocNumber(raw);
  return p ? `QT-${p.body}` : null;
}

/** Keep the same date+suffix when issuing ENQ-… as a quotation. */
export function quoteUidWhenIssuing(enquiryNumber: unknown): string | null {
  return quoteUidFromNumber(enquiryNumber);
}

export function resolveEnquiryUid(doc: {
  quote_number?: unknown;
  status?: unknown;
  enquiry_number?: unknown;
  metadata?: unknown;
}): string | null {
  const stored = String(doc.enquiry_number || '').trim();
  if (stored) return enquiryUidFromNumber(stored) || stored.toUpperCase();
  const thread = parseTradeThread(doc.metadata, doc.status);
  if (thread.enquiry_number) {
    return (
      enquiryUidFromNumber(thread.enquiry_number) ||
      String(thread.enquiry_number).trim().toUpperCase()
    );
  }
  return enquiryUidFromNumber(doc.quote_number);
}

const ISSUED = new Set([
  'sent',
  'accepted',
  'deposit_due',
  'deposit_paid',
  'processing',
]);

const CLOSED = new Set([
  'converted',
  'rejected',
  'expired',
  'cancelled',
  'canceled',
  'lost',
]);

/** Enquiry desk: inbound request plus the issued quote on the same thread. */
export function isEnquiryInboxRow(doc: {
  quote_number?: unknown;
  status?: unknown;
  enquiry_number?: unknown;
  metadata?: unknown;
}): boolean {
  const st = String(doc.status || '').toLowerCase();
  if (CLOSED.has(st)) return false;
  const num = String(doc.quote_number || '').toUpperCase();
  if (st === 'enquiry' || num.startsWith('ENQ-')) return true;
  return Boolean(resolveEnquiryUid(doc) && ISSUED.has(st));
}

/** Quotes desk: hide unissued enquiries (they live under Enquiry). */
export function isIssuedQuoteRow(doc: {
  quote_number?: unknown;
  status?: unknown;
}): boolean {
  const st = String(doc.status || '').toLowerCase();
  if (st === 'enquiry') return false;
  const num = String(doc.quote_number || '').toUpperCase();
  if (num.startsWith('ENQ-') && (st === 'draft' || st === 'enquiry' || !st)) {
    return false;
  }
  return true;
}
