/** Marketplace — network catalogue of inventory goods & services */

export const LISTING_VISIBILITY = [
  { value: 'public', label: 'Open market', desc: 'Visible to all businesses' },
  { value: 'connected', label: 'Connected only', desc: 'Only accepted network edges' },
] as const;

export const LISTING_STATUSES = [
  'draft',
  'active',
  'paused',
  'archived',
] as const;

export type ListingVisibility = 'public' | 'connected' | string;
export type ListingStatus = (typeof LISTING_STATUSES)[number] | string;

export type MarketplaceListing = {
  id: number;
  seller_profile_id: number;
  product_id?: number | null;
  title: string;
  description?: string | null;
  category?: string | null;
  product_type?: string | null;
  sku?: string | null;
  uom?: string | null;
  unit_price?: number | null;
  currency?: string | null;
  min_order_qty?: number | null;
  moq_note?: string | null;
  visibility?: ListingVisibility | null;
  status?: ListingStatus | null;
  primary_image_url?: string | null;
  show_stock?: boolean | null;
  stock_qty_snapshot?: number | null;
  lead_time_days?: number | null;
  incoterms?: string | null;
  origin_country?: string | null;
  origin_city?: string | null;
  tags?: string[] | null;
  public_id?: string | null;
  onchain_hash?: string | null;
  onchain_status?: string | null;
  metadata?: Record<string, unknown> | null;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
  /** enriched */
  seller?: {
    id: number;
    trading_name?: string | null;
    city?: string | null;
    country?: string | null;
    verification_status?: string | null;
    is_verified?: boolean | null;
    wallet_address?: string | null;
    logo_url?: string | null;
  } | null;
  is_connected?: boolean;
  is_own?: boolean;
};

export type MarketplaceInquiry = {
  id: number;
  listing_id: number;
  buyer_profile_id: number;
  seller_profile_id: number;
  quantity?: number | null;
  unit_price?: number | null;
  currency?: string | null;
  message?: string | null;
  status?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  created_at?: string;
  listing?: Partial<MarketplaceListing> | null;
  buyer?: { id: number; trading_name?: string | null } | null;
};

export function formatMoney(n: number | null | undefined, currency = 'ZAR') {
  const v = Number(n || 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'ZAR',
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${currency} ${v.toLocaleString()}`;
  }
}

export function listingStatusClass(s?: string | null) {
  switch (String(s || '').toLowerCase()) {
    case 'active':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'paused':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'draft':
      return 'bg-neutral-100 text-neutral-600 border-neutral-200';
    case 'archived':
      return 'bg-slate-100 text-slate-500 border-slate-200';
    default:
      return 'bg-neutral-100 text-neutral-600 border-neutral-200';
  }
}

export function visibilityLabel(v?: string | null) {
  if (v === 'connected') return 'Connected only';
  return 'Open market';
}

export function inquiryStatusClass(s?: string | null) {
  switch (String(s || '').toLowerCase()) {
    case 'new':
      return 'bg-sky-100 text-sky-800';
    case 'quoted':
      return 'bg-violet-100 text-violet-800';
    case 'accepted':
    case 'converted':
      return 'bg-emerald-100 text-emerald-800';
    case 'declined':
    case 'cancelled':
      return 'bg-neutral-100 text-neutral-600';
    default:
      return 'bg-neutral-100 text-neutral-600';
  }
}
