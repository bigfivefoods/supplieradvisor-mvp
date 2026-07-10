/** Multi-company pricing agreements / list prices */

export const PRICING_AGREEMENT_STATUSES = [
  'draft',
  'active',
  'suspended',
  'expired',
  'cancelled',
] as const;

export type PricingAgreementStatus = (typeof PRICING_AGREEMENT_STATUSES)[number] | string;

export type PricingAgreementLine = {
  id?: number;
  agreement_id?: number;
  seller_product_id?: number | null;
  product_name: string;
  sku?: string | null;
  uom?: string | null;
  list_price: number;
  min_qty?: number | null;
  max_qty?: number | null;
  currency?: string | null;
  discount_pct?: number | null;
  notes?: string | null;
  /** Optional guide for buyer on-sell margin (not binding) */
  suggested_resale_price?: number | null;
  specs_sheet_url?: string | null;
  specs_sheet_name?: string | null;
  primary_image_url?: string | null;
  sort_order?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

export type PricingAgreement = {
  id: number;
  seller_profile_id: number;
  buyer_profile_id: number;
  title: string;
  agreement_number?: string | null;
  status: PricingAgreementStatus;
  currency?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
  connection_id?: number | null;
  metadata?: Record<string, unknown> | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  /** Joined */
  seller_name?: string | null;
  buyer_name?: string | null;
  lines?: PricingAgreementLine[];
  line_count?: number;
  /** Our role on this agreement relative to selected company */
  direction?: 'selling' | 'buying';
};

export type PricingLookupResult = {
  agreement_id: number;
  agreement_title: string;
  line_id: number;
  seller_profile_id: number;
  buyer_profile_id: number;
  seller_product_id?: number | null;
  product_name: string;
  sku?: string | null;
  uom?: string | null;
  list_price: number;
  currency: string;
  min_qty?: number | null;
  suggested_resale_price?: number | null;
  specs_sheet_url?: string | null;
  specs_sheet_name?: string | null;
  primary_image_url?: string | null;
};

export function agreementStatusClass(status?: string | null): string {
  switch (String(status || '').toLowerCase()) {
    case 'active':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'draft':
      return 'bg-sky-100 text-sky-800 border-sky-200';
    case 'suspended':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'expired':
    case 'cancelled':
      return 'bg-neutral-100 text-neutral-600 border-neutral-200';
    default:
      return 'bg-neutral-100 text-neutral-600 border-neutral-200';
  }
}

export function isAgreementEffective(
  a: Pick<PricingAgreement, 'status' | 'effective_from' | 'effective_to'>,
  onDate: Date = new Date()
): boolean {
  if (String(a.status).toLowerCase() !== 'active') return false;
  const day = onDate.toISOString().slice(0, 10);
  if (a.effective_from && day < a.effective_from) return false;
  if (a.effective_to && day > a.effective_to) return false;
  return true;
}

export function nextAgreementNumber(prefix = 'PA'): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const r = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${y}${m}-${r}`;
}

export function normalizeLineInput(raw: unknown): PricingAgreementLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const product_name = String(r.product_name || r.name || '').trim();
  if (!product_name) return null;
  const list_price = Number(r.list_price ?? r.unit_price ?? r.price ?? 0);
  return {
    id: r.id != null ? Number(r.id) : undefined,
    seller_product_id:
      r.seller_product_id != null
        ? Number(r.seller_product_id)
        : r.product_id != null
          ? Number(r.product_id)
          : null,
    product_name,
    sku: r.sku != null ? String(r.sku) : null,
    uom: r.uom != null ? String(r.uom) : 'unit',
    list_price: Number.isFinite(list_price) ? list_price : 0,
    min_qty: r.min_qty != null ? Number(r.min_qty) : 1,
    max_qty: r.max_qty != null ? Number(r.max_qty) : null,
    currency: r.currency != null ? String(r.currency) : null,
    discount_pct: r.discount_pct != null ? Number(r.discount_pct) : 0,
    notes: r.notes != null ? String(r.notes) : null,
    suggested_resale_price:
      r.suggested_resale_price != null ? Number(r.suggested_resale_price) : null,
    specs_sheet_url: r.specs_sheet_url != null ? String(r.specs_sheet_url) : null,
    specs_sheet_name: r.specs_sheet_name != null ? String(r.specs_sheet_name) : null,
    primary_image_url: r.primary_image_url != null ? String(r.primary_image_url) : null,
    sort_order: r.sort_order != null ? Number(r.sort_order) : 0,
  };
}
