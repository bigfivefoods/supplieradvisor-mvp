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
  sell_price?: number | null;
  cost_price?: number | null;
  reorder_level?: number | null;
  reorder_qty?: number | null;
  short_description?: string | null;
  status?: string | null;
  primary_image_url?: string | null;
  specs_sheet_url?: string | null;
  specs_sheet_name?: string | null;
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

export type WarehouseRecord = {
  id: number;
  profile_id?: number | null;
  name: string;
  code?: string | null;
  warehouse_type?: string | null;
  status?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  container_id?: number | null;
  is_default?: boolean | null;
};

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
    case 'anchored':
      return 'bg-emerald-100 text-emerald-800';
    case 'hashed':
      return 'bg-sky-100 text-sky-800';
    default:
      return 'bg-neutral-100 text-neutral-600';
  }
}
