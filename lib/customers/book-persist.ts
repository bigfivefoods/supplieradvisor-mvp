/** Empty string is a clear — store null so the column round-trips empty. */
export function emptyToNull(v: unknown): unknown {
  if (v === '') return null;
  return v;
}

export function numericOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

/** Columns a customer book save may write. Credit hold is a separate action. */
export const CUSTOMER_PATCH_FIELDS = [
  'trading_name',
  'legal_name',
  'email',
  'phone',
  'contact_name',
  'job_title',
  'status',
  'customer_type',
  'billing_address',
  'shipping_address',
  'credit_limit',
  'website',
  'industry',
  'vat_number',
  'registration_number',
  'city',
  'country',
  'continent',
  'province',
  'region',
  'postal_code',
  'currency',
  'payment_terms',
  'source',
  'owner_name',
  'notes',
  'rating',
  'logo_url',
] as const;

const NUMERIC_FIELDS = new Set<string>(['credit_limit', 'rating']);

export function customerPatchUpdates(
  body: Record<string, unknown>
): Record<string, unknown> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  for (const f of CUSTOMER_PATCH_FIELDS) {
    if (body[f] === undefined) continue;
    updates[f] = NUMERIC_FIELDS.has(f) ? numericOrNull(body[f]) : emptyToNull(body[f]);
  }
  if (updates.province != null && updates.region === undefined) {
    updates.region = updates.province;
  }
  if (updates.region != null && updates.province === undefined) {
    updates.province = updates.region;
  }
  return updates;
}

/** Terms and currency copied onto a quote, invoice, order, or PO from the saved party. */
export function savedPartyCommercial(row: {
  payment_terms?: string | null;
  currency?: string | null;
}): { paymentTerms: string | null; currency: string | null } {
  const paymentTerms = String(row.payment_terms || '').trim() || null;
  const currency = String(row.currency || '').trim().toUpperCase() || null;
  return { paymentTerms, currency };
}
