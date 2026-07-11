/**
 * South Africa–oriented VAT helpers (works for any % rate).
 *
 * Categories:
 *  - standard   → taxable at rate (e.g. 15%)
 *  - zero_rated → taxable at 0% (still “VAT”, but zero)
 *  - exempt     → outside VAT (no input/output)
 *  - out_of_scope → not a supply (transfers, capital, salaries, etc.)
 */

export type VatCategory = 'standard' | 'zero_rated' | 'exempt' | 'out_of_scope';

export type VatRateLike = {
  code?: string | null;
  name?: string | null;
  rate?: number | null;
  tax_type?: string | null;
  is_default?: boolean | null;
  is_recoverable?: boolean | null;
  category?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Infer category from code/name/rate when explicit category missing. */
export function resolveVatCategory(rate: VatRateLike | null | undefined): VatCategory {
  if (!rate) return 'out_of_scope';
  const explicit = String(rate.category || rate.metadata?.category || '').toLowerCase();
  if (
    explicit === 'standard' ||
    explicit === 'zero_rated' ||
    explicit === 'exempt' ||
    explicit === 'out_of_scope'
  ) {
    return explicit as VatCategory;
  }

  const code = String(rate.code || '').toUpperCase();
  const name = String(rate.name || '').toLowerCase();

  if (code.includes('EXEMPT') || name.includes('exempt')) return 'exempt';
  if (
    code.includes('OUT') ||
    name.includes('out of scope') ||
    name.includes('non-vatable') ||
    name.includes('not vatable')
  ) {
    return 'out_of_scope';
  }
  if (
    code.includes('VAT0') ||
    code.includes('ZERO') ||
    name.includes('zero-rated') ||
    name.includes('zero rated')
  ) {
    return 'zero_rated';
  }

  const r = Number(rate.rate || 0);
  if (r > 0) return 'standard';
  if (r === 0 && (code.includes('VAT') || name.includes('vat'))) return 'zero_rated';
  return 'exempt';
}

/** VAT from tax-exclusive base (tax = base × rate/100). */
export function vatFromExclusive(exclusive: number, ratePct: number): {
  exclusive: number;
  vat: number;
  inclusive: number;
} {
  const ex = round2(Math.abs(exclusive));
  const rate = Number(ratePct) || 0;
  if (rate <= 0) return { exclusive: ex, vat: 0, inclusive: ex };
  const vat = round2((ex * rate) / 100);
  return { exclusive: ex, vat, inclusive: round2(ex + vat) };
}

/**
 * VAT from tax-inclusive total (common on bank lines).
 * tax = inclusive × rate / (100 + rate)
 */
export function vatFromInclusive(inclusive: number, ratePct: number): {
  exclusive: number;
  vat: number;
  inclusive: number;
} {
  const inc = round2(Math.abs(inclusive));
  const rate = Number(ratePct) || 0;
  if (rate <= 0) return { exclusive: inc, vat: 0, inclusive: inc };
  const vat = round2((inc * rate) / (100 + rate));
  const exclusive = round2(inc - vat);
  return { exclusive, vat, inclusive: inc };
}

export function computeVatAmount(opts: {
  amount: number;
  ratePct: number;
  category?: VatCategory;
  /** default true for bank; false for invoice lines that are usually exclusive */
  taxInclusive?: boolean;
}): { net: number; vat: number; gross: number; category: VatCategory } {
  const category = opts.category || (opts.ratePct > 0 ? 'standard' : 'exempt');
  if (category === 'exempt' || category === 'out_of_scope' || category === 'zero_rated') {
    const abs = round2(Math.abs(opts.amount));
    return { net: abs, vat: 0, gross: abs, category };
  }
  if (opts.taxInclusive !== false) {
    const r = vatFromInclusive(opts.amount, opts.ratePct);
    return { net: r.exclusive, vat: r.vat, gross: r.inclusive, category };
  }
  const r = vatFromExclusive(opts.amount, opts.ratePct);
  return { net: r.exclusive, vat: r.vat, gross: r.inclusive, category };
}

/**
 * Heuristic: should this bank line default to standard VAT?
 * Transfers/salaries/loans → out of scope; merchants → often standard.
 */
export function suggestVatCode(description: string | null | undefined, amount: number): {
  code: string;
  reason: string;
} {
  const d = String(description || '').toLowerCase();
  const abs = Math.abs(amount);

  if (
    /\b(salary|wages|payroll|drawings|loan|transfer to|transfer from|fnb app transfer|inter-?account|savings)\b/i.test(
      d
    )
  ) {
    return { code: 'OUT', reason: 'Looks like a transfer / payroll / loan — out of scope' };
  }
  if (/\b(interest|dividend)\b/i.test(d)) {
    return { code: 'EXEMPT', reason: 'Financial interest often exempt / non-standard' };
  }
  if (/\b(export|zero.?rated)\b/i.test(d)) {
    return { code: 'VAT0', reason: 'Possible zero-rated supply' };
  }
  if (abs > 0 && /\b(pos|purchase|fuel|shell|rent|invoice|supplier|payment to|debit order)\b/i.test(d)) {
    return { code: 'VAT15', reason: 'Typical taxable purchase / sale' };
  }
  if (amount > 0 && /\b(deposit|receipt|customer|sale|yoco|paystack|eft from)\b/i.test(d)) {
    return { code: 'VAT15', reason: 'Possible taxable sale / customer receipt' };
  }
  return { code: 'VAT15', reason: 'Default standard VAT — review if exempt' };
}

export function categoryLabel(c: VatCategory): string {
  switch (c) {
    case 'standard':
      return 'Standard-rated';
    case 'zero_rated':
      return 'Zero-rated';
    case 'exempt':
      return 'Exempt';
    case 'out_of_scope':
      return 'Out of scope';
    default:
      return c;
  }
}

/** ZA-style display of VAT inclusive split for UI. */
export function formatVatSplit(gross: number, ratePct: number, taxInclusive = true): string {
  const { net, vat } = computeVatAmount({
    amount: gross,
    ratePct,
    taxInclusive,
    category: ratePct > 0 ? 'standard' : 'zero_rated',
  });
  return `Net ${net.toFixed(2)} + VAT ${vat.toFixed(2)} = ${Math.abs(gross).toFixed(2)}`;
}

export const ZA_VAT_SEED = [
  {
    code: 'VAT15',
    name: 'Standard VAT 15%',
    rate: 15,
    tax_type: 'vat',
    is_default: true,
    is_recoverable: true,
    country: 'ZA',
    category: 'standard' as VatCategory,
  },
  {
    code: 'VAT0',
    name: 'Zero-rated VAT',
    rate: 0,
    tax_type: 'vat',
    is_default: false,
    is_recoverable: true,
    country: 'ZA',
    category: 'zero_rated' as VatCategory,
  },
  {
    code: 'EXEMPT',
    name: 'VAT exempt',
    rate: 0,
    tax_type: 'vat',
    is_default: false,
    is_recoverable: false,
    country: 'ZA',
    category: 'exempt' as VatCategory,
  },
  {
    code: 'OUT',
    name: 'Out of scope (non-supply)',
    rate: 0,
    tax_type: 'vat',
    is_default: false,
    is_recoverable: false,
    country: 'ZA',
    category: 'out_of_scope' as VatCategory,
  },
];
