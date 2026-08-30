/** Brief 9 — default list page is 50 rows, never more than 100. */

export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 100;

export function parseListLimit(
  raw: string | null | undefined,
  fallback = DEFAULT_LIST_LIMIT
): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), MAX_LIST_LIMIT);
}

export function parseBeforeId(raw: string | null | undefined): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export const CUSTOMER_LIST_COLUMNS =
  'id, trading_name, legal_name, email, phone, contact_name, status, customer_type, city, country, industry, linked_profile_id, invite_status, credit_limit, currency, logo_url, source, created_at, updated_at, metadata';

export const SUPPLIER_LIST_COLUMNS =
  'id, trading_name, legal_name, email, phone, contact_name, status, invite_status, city, country, industry, linked_profile_id, logo_url, connection_id, verified, otifef_pct, rating_avg, trust_score, wallet_address, created_at, updated_at, metadata';

export const DOC_LIST_COLUMNS =
  'id, status, invoice_number, quote_number, order_number, customer_id, customer_name, total_amount, amount_paid, currency, due_date, created_at, contact_email, visibility, items';
