/**
 * Multi-party order chain helpers (SO ↔ PO linking + cascade fields).
 * Phase A foundation — optional linking only; never mandatory.
 */

export type OrderType = 'sales_order' | 'purchase_order';
export type LinkType = 'fulfillment' | 'production' | 'dropship';
export type LinkStatus = 'active' | 'unlinked';

export type ProductionStatus =
  | 'released'
  | 'in_progress'
  | 'completed'
  | 'on_hold'
  | 'cancelled'
  | null;

export type SalesOrderOrigin =
  | 'customer_portal'
  | 'internal'
  | 'api'
  | 'import';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface OrderLink {
  id: number;
  company_id: number;
  source_order_id: number;
  source_order_type: OrderType;
  target_order_id: number;
  target_order_type: OrderType;
  link_type: LinkType;
  status: LinkStatus;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  created_by?: string | null;
  unlinked_by?: string | null;
  unlinked_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderBatch {
  id: number;
  company_id: number;
  order_id: number;
  order_type: OrderType;
  order_line_index?: number | null;
  batch_number: string;
  qty: number;
  uom?: string;
  produced_at?: string | null;
  manufacturer_profile_id?: number | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface SupplierPayment {
  id: number;
  company_id: number;
  po_id: number;
  amount: number;
  currency: string;
  payment_date: string;
  reference?: string | null;
  method?: string | null;
  status: 'pending' | 'recorded' | 'confirmed' | 'void';
  pop_document_id?: string | null;
  pop_url?: string | null;
  share_with_supplier: boolean;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
}

/** Fields that are allowed to cascade from PO → linked SO (never commercial). */
export const CASCADE_SAFE_FIELDS = [
  'production_status',
  'confirmed_qty',
  'promised_date',
  'actual_completion_date',
] as const;

export type CascadeSafeField = (typeof CASCADE_SAFE_FIELDS)[number];

export function isCascadeSafeField(field: string): field is CascadeSafeField {
  return (CASCADE_SAFE_FIELDS as readonly string[]).includes(field);
}

/** Build a human-readable cascade source tag. */
export function cascadeSourceTag(orderType: OrderType, orderId: number): string {
  return `${orderType}:${orderId}`;
}

/**
 * Map manufacturer production status to a customer-visible high-level status.
 * Never exposes internal manufacturer capacity or cost language.
 */
export function customerVisibleProductionStatus(
  status: ProductionStatus | string | null | undefined
): string {
  switch (status) {
    case 'released':
      return 'Scheduled';
    case 'in_progress':
      return 'In production';
    case 'completed':
      return 'Produced';
    case 'on_hold':
      return 'On hold';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Pending';
  }
}

export const PRODUCTION_STATUS_OPTIONS: {
  value: Exclude<ProductionStatus, null>;
  label: string;
}[] = [
  { value: 'released', label: 'Released' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled' },
];
