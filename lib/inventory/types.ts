export type ProductPriceRow = {
  currency: string;
  cost_price: number;
  sell_price: number;
};

export type ProductRecord = {
  id: number;
  profile_id?: number | null;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  public_id?: string | null;
  category?: string | null;
  product_type?: string | null;
  uom?: string | null;
  /** Primary currency (first price row) */
  base_currency?: string | null;
  sell_price?: number | null;
  cost_price?: number | null;
  /** Up to 3 currency price rows */
  prices?: ProductPriceRow[] | null;
  reorder_level?: number | null;
  reorder_qty?: number | null;
  short_description?: string | null;
  status?: string | null;
  primary_image_url?: string | null;
  specs_sheet_url?: string | null;
  specs_sheet_name?: string | null;
  /** Upstream manufacturer sheet (preserved when sales co replaces local sheet) */
  upstream_specs_sheet_url?: string | null;
  upstream_specs_sheet_name?: string | null;
  /** Pedigree when imported from a connected seller / pricing agreement */
  source_profile_id?: number | null;
  source_product_id?: number | null;
  source_agreement_id?: number | null;
  source_agreement_line_id?: number | null;
  track_lot?: boolean | null;
  track_serial?: boolean | null;
  is_sellable?: boolean | null;
  is_purchasable?: boolean | null;
  qr_payload?: string | null;
  onchain_status?: string | null;
  onchain_hash?: string | null;
  onchain_tx_hash?: string | null;
  onchain_token_id?: string | null;
  onchain_chain?: string | null;
  onchain_anchored_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  /** computed */
  qty_on_hand?: number;
};

/** Who owns / controls the location in our network */
export type WarehouseOwnerType = 'own' | 'supplier' | 'customer';

export type WarehouseRecord = {
  id: number;
  profile_id?: number | null;
  name: string;
  code?: string | null;
  /** warehouse | store | container | virtual | supplier_dc | customer_site | 3pl */
  warehouse_type?: string | null;
  /** own | supplier | customer */
  owner_type?: WarehouseOwnerType | string | null;
  partner_name?: string | null;
  partner_ref?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  allow_stock?: boolean | null;
  postal_code?: string | null;
  region?: string | null;
  status?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  /** Physical GPS of the site (required for accurate transfer ETA) */
  lat?: number | null;
  lng?: number | null;
  container_id?: number | null;
  is_default?: boolean | null;
  stock_lines?: number;
  units_on_hand?: number;
};

export function warehouseHasPhysicalCoords(w?: {
  lat?: number | null;
  lng?: number | null;
} | null) {
  return (
    w != null &&
    w.lat != null &&
    w.lng != null &&
    Number.isFinite(Number(w.lat)) &&
    Number.isFinite(Number(w.lng))
  );
}

export function warehousePhysicalPoint(w?: {
  lat?: number | null;
  lng?: number | null;
} | null): { lat: number; lng: number } | null {
  if (!warehouseHasPhysicalCoords(w)) return null;
  return { lat: Number(w!.lat), lng: Number(w!.lng) };
}

/** draft → shipped / in_transit → partially_received → received | cancelled */
export type TransferOrderStatus =
  | 'draft'
  | 'shipped'
  | 'in_transit'
  | 'partially_received'
  | 'received'
  | 'cancelled';

export type StockTransferLine = {
  id?: number;
  transfer_id?: number;
  product_id: number;
  product_name?: string | null;
  sku?: string | null;
  uom?: string | null;
  qty_requested: number;
  qty_shipped?: number;
  qty_received?: number;
  lot_number?: string | null;
  notes?: string | null;
};

export type StockTransferOrder = {
  id: number;
  profile_id?: number | null;
  transfer_number?: string | null;
  /** Unguessable token for driver QR → /t/{token} */
  public_token?: string | null;
  driver_url?: string | null;
  status: TransferOrderStatus | string;
  from_warehouse_id?: number | null;
  to_warehouse_id?: number | null;
  from_warehouse_name?: string | null;
  to_warehouse_name?: string | null;
  expected_ship_date?: string | null;
  expected_receive_date?: string | null;
  shipped_at?: string | null;
  received_at?: string | null;
  cancelled_at?: string | null;
  carrier?: string | null;
  tracking_ref?: string | null;
  ship_notes?: string | null;
  receive_notes?: string | null;
  notes?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  vehicle_reg?: string | null;
  pickup_scanned_at?: string | null;
  dropoff_scanned_at?: string | null;
  last_lat?: number | null;
  last_lng?: number | null;
  last_location_at?: string | null;
  onchain_hash?: string | null;
  created_at?: string;
  updated_at?: string;
  lines?: StockTransferLine[];
};

export function transferDriverUrl(token?: string | null, appUrl?: string) {
  if (!token) return null;
  const base = (appUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://www.supplieradvisor.com').replace(
    /\/$/,
    ''
  );
  return `${base}/t/${token}`;
}

export function transferQrImageUrl(driverUrl: string, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(driverUrl)}`;
}

export const WAREHOUSE_OWNER_TYPES: {
  value: WarehouseOwnerType;
  label: string;
  description: string;
}[] = [
  { value: 'own', label: 'My warehouse', description: 'Your own facility or DC' },
  { value: 'supplier', label: 'Supplier location', description: 'Supplier DC / plant for inbound stock' },
  { value: 'customer', label: 'Customer location', description: 'Customer site / consignment stock' },
];

export const WAREHOUSE_TYPES: { value: string; label: string; owners?: WarehouseOwnerType[] }[] = [
  { value: 'warehouse', label: 'Warehouse / DC' },
  { value: 'store', label: 'Store / retail' },
  { value: 'supplier_dc', label: 'Supplier DC / plant', owners: ['supplier'] },
  { value: 'customer_site', label: 'Customer site', owners: ['customer'] },
  { value: '3pl', label: '3PL / bonded' },
  { value: 'virtual', label: 'Virtual / transit' },
  { value: 'container', label: 'Container outlet' },
];

export function transferStatusClass(s?: string | null) {
  switch ((s || '').toLowerCase()) {
    case 'received':
      return 'bg-emerald-100 text-emerald-800';
    case 'shipped':
    case 'in_transit':
      return 'bg-sky-100 text-sky-800';
    case 'partially_received':
      return 'bg-amber-100 text-amber-900';
    case 'cancelled':
      return 'bg-neutral-200 text-neutral-600';
    default:
      return 'bg-violet-100 text-violet-800';
  }
}

export function ownerTypeClass(s?: string | null) {
  switch ((s || 'own').toLowerCase()) {
    case 'supplier':
      return 'bg-orange-100 text-orange-800';
    case 'customer':
      return 'bg-indigo-100 text-indigo-800';
    default:
      return 'bg-emerald-100 text-emerald-800';
  }
}

export function ownerTypeLabel(s?: string | null) {
  const t = WAREHOUSE_OWNER_TYPES.find((o) => o.value === (s || 'own'));
  return t?.label || 'My warehouse';
}

export type StockLevelRecord = {
  id: number;
  profile_id?: number | null;
  product_id: number;
  warehouse_id?: number | null;
  qty_on_hand: number;
  qty_reserved?: number | null;
  reorder_level?: number | null;
  lot_number?: string | null;
  expiry_date?: string | null;
  bin_location?: string | null;
  product?: ProductRecord | null;
  warehouse?: WarehouseRecord | null;
};

export type StockMovementRecord = {
  id: number;
  profile_id?: number | null;
  product_id?: number | null;
  warehouse_id?: number | null;
  from_warehouse_id?: number | null;
  to_warehouse_id?: number | null;
  movement_type: string;
  quantity: number;
  unit_cost?: number | null;
  reference_type?: string | null;
  reference_id?: string | null;
  notes?: string | null;
  created_by?: string | null;
  onchain_hash?: string | null;
  lot_number?: string | null;
  created_at?: string;
};

/** Build QR payload URL for a product (scan → public product card). */
export function productQrPayload(publicId: string, appUrl?: string) {
  const base = (appUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://app.supplieradvisor.com').replace(
    /\/$/,
    ''
  );
  return `${base}/p/${publicId}`;
}

export function onchainStatusClass(s?: string | null) {
  switch ((s || '').toLowerCase()) {
    case 'minted':
      return 'bg-emerald-100 text-emerald-800';
    case 'anchored':
      // Simulated or soft anchor (no real mint) — amber so operators do not confuse with minted
      return 'bg-amber-100 text-amber-900';
    case 'hashed':
      return 'bg-sky-100 text-sky-800';
    default:
      return 'bg-neutral-100 text-neutral-600';
  }
}

/** Human label for passport mode */
export function onchainStatusLabel(s?: string | null, mode?: string | null): string {
  const status = (s || '').toLowerCase();
  if (mode === 'simulated' || status === 'anchored') return 'simulated anchor';
  if (status === 'minted') return 'minted on-chain';
  if (status === 'hashed') return 'hashed';
  return status || 'pending';
}

export const COMMON_CURRENCIES = [
  'ZAR',
  'USD',
  'EUR',
  'GBP',
  'NAD',
  'BWP',
  'ZMW',
  'MZN',
  'KES',
  'NGN',
  'AED',
  'CNY',
] as const;

/** Normalize up to 3 price rows; first row drives base sell/cost. */
export function normalizeProductPrices(
  rows: Array<{ currency?: string; cost_price?: number | string; sell_price?: number | string }>
): ProductPriceRow[] {
  const out: ProductPriceRow[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (out.length >= 3) break;
    const currency = String(r.currency || 'ZAR').trim().toUpperCase() || 'ZAR';
    if (seen.has(currency)) continue;
    seen.add(currency);
    out.push({
      currency,
      cost_price: Number(r.cost_price) || 0,
      sell_price: Number(r.sell_price) || 0,
    });
  }
  if (out.length === 0) {
    out.push({ currency: 'ZAR', cost_price: 0, sell_price: 0 });
  }
  return out;
}

/** Prices array for a product (handles legacy single-currency rows). */
export function productPriceList(p: {
  prices?: ProductPriceRow[] | null;
  base_currency?: string | null;
  cost_price?: number | null;
  sell_price?: number | null;
}): ProductPriceRow[] {
  if (Array.isArray(p.prices) && p.prices.length) {
    return normalizeProductPrices(p.prices);
  }
  return normalizeProductPrices([
    {
      currency: p.base_currency || 'ZAR',
      cost_price: p.cost_price ?? 0,
      sell_price: p.sell_price ?? 0,
    },
  ]);
}

/**
 * Pick display rows for catalogue.
 * - preferredCurrency: show that currency first when present
 * - dual: also return a second currency row when available
 */
export function pickDisplayPrices(
  p: {
    prices?: ProductPriceRow[] | null;
    base_currency?: string | null;
    cost_price?: number | null;
    sell_price?: number | null;
  },
  preferredCurrency?: string | null,
  dual = true
): ProductPriceRow[] {
  const list = productPriceList(p);
  const pref = preferredCurrency
    ? String(preferredCurrency).trim().toUpperCase()
    : null;

  let ordered = list;
  if (pref) {
    const hit = list.find((r) => r.currency === pref);
    if (hit) {
      ordered = [hit, ...list.filter((r) => r.currency !== pref)];
    }
  }

  if (!dual) return [ordered[0]];
  return ordered.slice(0, 2);
}

export function formatMoney(amount: number | null | undefined, currency = 'ZAR') {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.length === 3 ? currency : 'ZAR',
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}
