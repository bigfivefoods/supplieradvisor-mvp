/**
 * Supplier portal is the SRM book, not a new flag.
 * A party may use the supplier portal only when they have an srm_suppliers
 * row for this company, are not blocked, and book role is supplier or both.
 * Missing role + existing SRM row (not explicitly customer) is legacy supplier.
 */
import { bookRoleFromMeta } from '@/lib/accounting/party-roles';

export type SupplierBookGateOk = { ok: true };
export type SupplierBookGateFail = {
  ok: false;
  reason: 'missing' | 'blocked' | 'customer_only' | 'not_supplier';
  error: string;
};

export type SupplierBookGate = SupplierBookGateOk | SupplierBookGateFail;

export function supplierBookPartyGate(row: {
  status?: string | null;
  metadata?: unknown;
} | null | undefined): SupplierBookGate {
  if (!row) {
    return {
      ok: false,
      reason: 'missing',
      error: 'Supplier not found on your books',
    };
  }
  if (String(row.status || '').toLowerCase() === 'blocked') {
    return {
      ok: false,
      reason: 'blocked',
      error: 'This supplier is blocked',
    };
  }
  const role = bookRoleFromMeta(row.metadata);
  if (role === 'customer') {
    return {
      ok: false,
      reason: 'customer_only',
      error:
        'Customer only — set book role to Supplier or Both before issuing a supplier portal',
    };
  }
  if (role === 'supplier' || role === 'both' || role == null) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: 'not_supplier',
    error: 'This party is not marked as a supplier on your books',
  };
}

export function supplierBookDisabledReason(gate: SupplierBookGate): string | null {
  if (gate.ok) return null;
  if (gate.reason === 'customer_only') {
    return 'Customer only — set book role to Supplier or Both';
  }
  if (gate.reason === 'blocked') return 'Blocked';
  if (gate.reason === 'missing') return 'Not on supplier book';
  return gate.error;
}

function asMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

/** PO belongs to this supplier-portal viewer (srm id and/or linked profile id). */
export function poBelongsToSupplierViewer(
  po: {
    supplier_id?: unknown;
    supplier_profile_id?: unknown;
    metadata?: unknown;
  },
  viewer: { supplierId: number; linkedProfileId?: number | null }
): boolean {
  const sid = Number(po.supplier_id);
  const spid = Number(po.supplier_profile_id);
  const metaSrm = Number(asMeta(po.metadata).srm_supplier_id);
  const srmId = Number(viewer.supplierId);
  const linked = Number(viewer.linkedProfileId);
  if (Number.isFinite(srmId) && srmId > 0) {
    if (sid === srmId || metaSrm === srmId) return true;
  }
  if (Number.isFinite(linked) && linked > 0) {
    if (sid === linked || spid === linked) return true;
  }
  return false;
}

export function validateLotDates(
  manufactured: string | null | undefined,
  expiry: string | null | undefined
): string | null {
  const m = String(manufactured || '').slice(0, 10);
  const e = String(expiry || '').slice(0, 10);
  if (!m || !e) return null;
  if (e < m) return 'Expiry must be on or after the manufacture date';
  return null;
}

export function inventoryLotPayloadFromBatch(opts: {
  companyId: number;
  productId: number | null;
  batchNumber: string;
  qty: number;
  manufacturedDate?: string | null;
  expiryDate?: string | null;
  bestBefore?: string | null;
  supplierRef?: string | null;
  warehouseId?: number | null;
}): Record<string, unknown> {
  return {
    profile_id: opts.companyId,
    product_id: opts.productId,
    lot_number: String(opts.batchNumber).trim().slice(0, 120),
    manufactured_date: opts.manufacturedDate || null,
    expiry_date: opts.expiryDate || null,
    best_before: opts.bestBefore || null,
    qty_on_hand: Number(opts.qty) || 0,
    supplier_ref: opts.supplierRef || null,
    warehouse_id: opts.warehouseId || null,
    status: 'active',
  };
}

export function tradePortalMessageInsertRow(opts: {
  portalId: number;
  viewerId: number;
  profileId: number;
  author: 'host' | 'guest';
  body: string;
  purchaseOrderId?: number | null;
}): Record<string, unknown> {
  const poId = Number(opts.purchaseOrderId);
  const hasPo = Number.isFinite(poId) && poId > 0;
  const row: Record<string, unknown> = {
    portal_id: opts.portalId,
    viewer_id: opts.viewerId,
    profile_id: opts.profileId,
    author: opts.author,
    body: opts.body,
  };
  if (hasPo) {
    row.purchase_order_id = poId;
    row.metadata = { po_id: poId };
  }
  return row;
}

export function stripMissingMessageColumn(
  row: Record<string, unknown>,
  missing: string | null
): Record<string, unknown> {
  if (!missing) return row;
  const next = { ...row };
  delete next[missing];
  return next;
}

export function messageMatchesPo(
  row: { purchase_order_id?: unknown; metadata?: unknown },
  poId: number
): boolean {
  if (!(poId > 0)) return false;
  if (Number(row.purchase_order_id) === poId) return true;
  const meta = asMeta(row.metadata);
  return Number(meta.po_id) === poId;
}
