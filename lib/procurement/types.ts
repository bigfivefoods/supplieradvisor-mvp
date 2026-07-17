/**
 * Off-chain purchase order status machine (app layer).
 * On-chain POEscrowV2 is separate — never gate reviews only on chain enum.
 */

/**
 * Feature flag: optional client-signed POEscrowV2 for customer-portal POs.
 * Default false when unset. Never use POEscrowService (server private key) for buyer path.
 *
 * **Set both env vars together** to avoid split-brain:
 * - `CUSTOMER_PO_ESCROW_ENABLED` — server onchain API (preferred on server)
 * - `NEXT_PUBLIC_CUSTOMER_PO_ESCROW_ENABLED` — required for browser UI (non-public
 *   vars are stripped from the client bundle). Without NEXT_PUBLIC_, UI stays hidden
 *   even if the server flag is true.
 *
 * Buyer path ABI: `src/lib/contracts/abi/POEscrowV2.json` (event `PO_Created`, 3-arg createPO).
 */
export function isCustomerPoEscrowEnabled(): boolean {
  const raw =
    process.env.CUSTOMER_PO_ESCROW_ENABLED ??
    process.env.NEXT_PUBLIC_CUSTOMER_PO_ESCROW_ENABLED;
  if (raw === undefined || raw === '') return false;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase().trim());
}

/**
 * Feature flag: client-signed escrow on the **buyer SRM** path
 * (`/dashboard/suppliers/po`).
 *
 * Default **true** so operators can raise both standard and escrow POs.
 * ETH Sepolia has a default contract address; USDC is additive when configured.
 *
 * Disable with either env set to `0`/`false`/`off`:
 * - `SUPPLIER_PO_ESCROW_ENABLED`
 * - `NEXT_PUBLIC_SUPPLIER_PO_ESCROW_ENABLED` (required for browser UI)
 */
export function isSupplierPoEscrowEnabled(): boolean {
  const raw =
    process.env.SUPPLIER_PO_ESCROW_ENABLED ??
    process.env.NEXT_PUBLIC_SUPPLIER_PO_ESCROW_ENABLED;
  if (raw === undefined || raw === '') return true;
  return !['0', 'false', 'no', 'off'].includes(String(raw).toLowerCase().trim());
}

export const PO_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'funded',
  'invoiced',
  'paid',
  'completed',
  'cancelled',
] as const;

export type PoStatus = (typeof PO_STATUSES)[number];

/** Statuses that unlock POST /api/buyer/reviews */
export const PO_REVIEWABLE_STATUSES = ['paid', 'completed', 'invoiced'] as const;

export type PoReviewableStatus = (typeof PO_REVIEWABLE_STATUSES)[number];

/**
 * Allowed seller transitions for inbound customer-portal POs.
 * Buyer create leaves status at `sent`; seller progresses via
 * PATCH /api/customers/purchase-orders.
 * `invoiced` is also set directly when seller creates invoice from PO.
 */
export const SELLER_PO_TRANSITIONS: Record<string, string[]> = {
  sent: ['accepted', 'cancelled'],
  accepted: ['paid', 'completed', 'invoiced', 'cancelled'],
  funded: ['paid', 'completed', 'invoiced', 'cancelled'],
  invoiced: ['paid', 'completed'],
  paid: ['completed'],
};

/** Buyer may cancel only draft/sent own POs */
export const BUYER_PO_CANCEL_STATUSES = ['draft', 'sent'] as const;

/**
 * Buyer SRM (procurement) status machine — off-chain lifecycle.
 * Escrow fund maps to `funded`; seller may mark `invoiced`; delivery + OTIFEF → `completed`.
 */
export const SRM_BUYER_PO_TRANSITIONS: Record<string, string[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['accepted', 'cancelled'],
  accepted: ['funded', 'completed', 'cancelled'],
  funded: ['completed', 'cancelled'],
  invoiced: ['completed', 'cancelled'],
  paid: ['completed'],
  completed: [],
  cancelled: [],
};

export function isSrmBuyerTransitionAllowed(from: string, to: string): boolean {
  const allowed = SRM_BUYER_PO_TRANSITIONS[String(from || '').toLowerCase()];
  return Array.isArray(allowed) && allowed.includes(String(to || '').toLowerCase());
}

export function poStatusBadgeClass(status?: string | null): string {
  switch (String(status || '').toLowerCase()) {
    case 'draft':
      return 'bg-neutral-100 text-neutral-700';
    case 'sent':
      return 'bg-sky-100 text-sky-800';
    case 'accepted':
      return 'bg-indigo-100 text-indigo-800';
    case 'funded':
      return 'bg-violet-100 text-violet-800';
    case 'invoiced':
      return 'bg-amber-100 text-amber-900';
    case 'paid':
    case 'completed':
      return 'bg-emerald-100 text-emerald-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-neutral-100 text-neutral-600';
  }
}

export function isPoStatus(value: unknown): value is PoStatus {
  return typeof value === 'string' && (PO_STATUSES as readonly string[]).includes(value);
}

export function isSellerTransitionAllowed(from: string, to: string): boolean {
  const allowed = SELLER_PO_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

export function isPoReviewable(status: string | null | undefined): boolean {
  return (PO_REVIEWABLE_STATUSES as readonly string[]).includes(String(status || ''));
}

/** Peer review status on po_reviews */
export const PO_REVIEW_STATUSES = ['published', 'hidden'] as const;
export type PoReviewStatus = (typeof PO_REVIEW_STATUSES)[number];

/** Optional dimension keys for multi-axis rating (1–5 each). */
export const PO_REVIEW_DIMENSION_KEYS = [
  'quality',
  'delivery',
  'communication',
  'value',
] as const;

export type PoReviewDimensionKey = (typeof PO_REVIEW_DIMENSION_KEYS)[number];

export type PoReviewRecord = {
  id: number;
  purchase_order_id: number;
  reviewer_profile_id: number;
  reviewee_profile_id: number;
  rating: number;
  title?: string | null;
  body?: string | null;
  dimensions?: Record<string, number> | null;
  status?: PoReviewStatus | string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

/** Normalize optional dimensions map; invalid keys/values dropped. */
export function normalizeReviewDimensions(
  raw: unknown
): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k).toLowerCase().trim();
    if (!key || key.length > 40) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 1 || n > 5) continue;
    out[key] = Math.round(n);
  }
  return out;
}

export type PoLineItem = {
  product_id?: number | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  uom?: string | null;
  primary_image_url?: string | null;
  line_total?: number;
};

export function normalizePoItems(
  items: unknown
): { items: PoLineItem[]; total: number } | { error: string } {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'At least one line item is required' };
  }

  const normalized: PoLineItem[] = [];
  let total = 0;

  for (const raw of items) {
    if (!raw || typeof raw !== 'object') {
      return { error: 'Invalid line item' };
    }
    const row = raw as Record<string, unknown>;
    const item_name = String(row.item_name || row.name || '').trim();
    if (!item_name) {
      return { error: 'Each line item needs item_name' };
    }
    const quantity = Number(row.quantity);
    const unit_price = Number(row.unit_price);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: `Invalid quantity for item "${item_name}"` };
    }
    if (!Number.isFinite(unit_price) || unit_price < 0) {
      return { error: `Invalid unit_price for item "${item_name}"` };
    }
    const line_total = Math.round(quantity * unit_price * 100) / 100;
    total += line_total;
    normalized.push({
      product_id:
        row.product_id != null && Number.isFinite(Number(row.product_id))
          ? Number(row.product_id)
          : null,
      item_name,
      quantity,
      unit_price,
      uom: row.uom != null ? String(row.uom) : null,
      primary_image_url:
        row.primary_image_url != null ? String(row.primary_image_url) : null,
      line_total,
    });
  }

  total = Math.round(total * 100) / 100;
  return { items: normalized, total };
}
