/**
 * Off-chain purchase order status machine (app layer).
 * On-chain POEscrowV2 is separate — never gate reviews only on chain enum.
 */

export const PO_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'funded',
  'paid',
  'completed',
  'cancelled',
] as const;

export type PoStatus = (typeof PO_STATUSES)[number];

/** Statuses that unlock POST /api/buyer/reviews */
export const PO_REVIEWABLE_STATUSES = ['paid', 'completed'] as const;

export type PoReviewableStatus = (typeof PO_REVIEWABLE_STATUSES)[number];

/**
 * Allowed seller transitions for inbound customer-portal POs.
 * Buyer create leaves status at `sent`; seller progresses via
 * PATCH /api/customers/purchase-orders.
 */
export const SELLER_PO_TRANSITIONS: Record<string, string[]> = {
  sent: ['accepted', 'cancelled'],
  accepted: ['paid', 'completed', 'cancelled'], // paid or completed both unlock reviews
  funded: ['paid', 'completed', 'cancelled'],
  paid: ['completed'],
};

/** Buyer may cancel only draft/sent own POs */
export const BUYER_PO_CANCEL_STATUSES = ['draft', 'sent'] as const;

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
