/**
 * Supplier portal is the SRM book, not a new flag.
 * A party may use the supplier portal only when they have an srm_suppliers
 * row for this company, are not blocked, and book role is supplier or both.
 * Missing role + existing SRM row (not explicitly customer) is legacy supplier.
 */
import { bookRoleFromMeta, parsePartyBookRole } from '@/lib/accounting/party-roles';

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

export type CustomerBookGateFail = {
  ok: false;
  reason: 'missing' | 'blocked' | 'supplier_only' | 'not_customer';
  error: string;
};
export type CustomerBookGate = { ok: true } | CustomerBookGateFail;

/** CRM / customer portal: customer or both. Legacy: CRM row with no role. */
export function customerBookPartyGate(row: {
  status?: string | null;
  metadata?: unknown;
} | null | undefined): CustomerBookGate {
  if (!row) {
    return {
      ok: false,
      reason: 'missing',
      error: 'Customer not found on your books',
    };
  }
  if (String(row.status || '').toLowerCase() === 'blocked') {
    return {
      ok: false,
      reason: 'blocked',
      error: 'This customer is blocked',
    };
  }
  const role = bookRoleFromMeta(row.metadata);
  if (role === 'supplier') {
    return {
      ok: false,
      reason: 'supplier_only',
      error:
        'Supplier only — set book role to Customer or Both before issuing a customer portal',
    };
  }
  if (role === 'customer' || role === 'both' || role == null) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: 'not_customer',
    error: 'This party is not marked as a customer on your books',
  };
}

export function customerBookDisabledReason(gate: CustomerBookGate): string | null {
  if (gate.ok) return null;
  if (gate.reason === 'supplier_only') {
    return 'Supplier only — set book role to Customer or Both';
  }
  if (gate.reason === 'blocked') return 'Blocked';
  if (gate.reason === 'missing') return 'Not on customer book';
  return gate.error;
}

export type BookTwinHint = {
  exists?: boolean;
  role?: 'customer' | 'supplier' | 'both' | null;
};

/**
 * Supplier profiles / portal picker. Legacy (no role) is an SRM party only
 * when there is no CRM twin. A twin with no stamp is fail-closed.
 */
export function rowOnSupplierDesk(
  row: {
    status?: string | null;
    metadata?: unknown;
  } | null | undefined,
  twin?: BookTwinHint | null
): boolean {
  if (!supplierBookPartyGate(row).ok) return false;
  const role = bookRoleFromMeta(row?.metadata);
  if (role === 'supplier' || role === 'both') return true;
  if (twin?.role === 'customer') return false;
  if (twin?.exists) return false;
  return true;
}

/**
 * Customer profiles / portal picker. Legacy (no role) is a CRM party only
 * when there is no SRM twin. A twin with no stamp is fail-closed.
 */
export function rowOnCustomerDesk(
  row: {
    status?: string | null;
    metadata?: unknown;
  } | null | undefined,
  twin?: BookTwinHint | null
): boolean {
  if (!customerBookPartyGate(row).ok) return false;
  const role = bookRoleFromMeta(row?.metadata);
  if (role === 'customer' || role === 'both') return true;
  if (twin?.role === 'supplier') return false;
  if (twin?.exists) return false;
  return true;
}

export function partyTwinKeys(row: {
  id?: unknown;
  linked_profile_id?: unknown;
  email?: unknown;
  trading_name?: unknown;
  legal_name?: unknown;
}): string[] {
  const keys: string[] = [];
  const linked = Number(row.linked_profile_id);
  if (Number.isFinite(linked) && linked > 0) keys.push(`linked:${linked}`);
  const email = String(row.email || '')
    .trim()
    .toLowerCase();
  if (email.includes('@')) keys.push(`email:${email}`);
  const name = String(row.trading_name || row.legal_name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(pty|ltd|limited|npc|npo|cc|inc|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (name.length > 1) keys.push(`name:${name}`);
  return keys;
}

export function indexBookTwins(
  rows: Array<{
    linked_profile_id?: unknown;
    email?: unknown;
    trading_name?: unknown;
    legal_name?: unknown;
    metadata?: unknown;
  }>
): Map<string, BookTwinHint> {
  const map = new Map<string, BookTwinHint>();
  for (const row of rows) {
    const role = bookRoleFromMeta(row.metadata);
    const hint: BookTwinHint = { exists: true, role };
    for (const key of partyTwinKeys(row)) {
      const prev = map.get(key);
      map.set(key, {
        exists: true,
        role: hint.role || prev?.role || null,
      });
    }
  }
  return map;
}

export function twinHintFor(
  row: {
    linked_profile_id?: unknown;
    email?: unknown;
    trading_name?: unknown;
    legal_name?: unknown;
  },
  twins: Map<string, BookTwinHint>
): BookTwinHint | null {
  for (const key of partyTwinKeys(row)) {
    const hit = twins.get(key);
    if (hit) return hit;
  }
  return null;
}

type DeskPartyRow = {
  status?: string | null;
  metadata?: unknown;
  linked_profile_id?: unknown;
  email?: unknown;
  trading_name?: unknown;
  legal_name?: unknown;
};

export function filterSupplierDeskRows<T extends DeskPartyRow>(
  suppliers: T[],
  customers: DeskPartyRow[]
): T[] {
  const twins = indexBookTwins(customers);
  return suppliers.filter((row) =>
    rowOnSupplierDesk(row, twinHintFor(row, twins))
  );
}

export function filterCustomerDeskRows<T extends DeskPartyRow>(
  customers: T[],
  suppliers: DeskPartyRow[]
): T[] {
  const twins = indexBookTwins(suppliers);
  return customers.filter((row) =>
    rowOnCustomerDesk(row, twinHintFor(row, twins))
  );
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

/** Host-company PO: buyer_profile_id, or older rows keyed on profile_id / company_id. */
export function poHostedByBuyer(
  po: {
    buyer_profile_id?: unknown;
    profile_id?: unknown;
    company_id?: unknown;
  },
  companyId: number
): boolean {
  const host = Number(companyId);
  if (!Number.isFinite(host) || host <= 0) return false;
  const buyer = Number(po.buyer_profile_id);
  if (buyer === host) return true;
  if (Number.isFinite(buyer) && buyer > 0) return false;
  const profile = Number(po.profile_id);
  const company = Number(po.company_id);
  return profile === host || company === host;
}

export function mergePortalDocRows<T extends { id: number; kind?: string }>(
  primary?: T[] | null,
  secondary?: T[] | null
): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const row of [...(primary || []), ...(secondary || [])]) {
    if (!row || row.id == null) continue;
    const key = `${row.kind || ''}#${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export function supplierPortalPoPdfHref(opts: {
  token: string;
  poId: number;
  storedUrl?: string | null;
}): string {
  const stored = String(opts.storedUrl || '').trim();
  if (/^https?:\/\//i.test(stored)) return stored;
  const token = encodeURIComponent(String(opts.token || '').trim());
  const id = Number(opts.poId);
  return `/api/public/portals/trade/po-pdf?token=${token}&id=${id}`;
}

export function defaultCreateBookRole(
  kind: 'supplier' | 'customer',
  raw?: unknown
): 'customer' | 'supplier' | 'both' {
  const parsed =
    parsePartyBookRole(raw) ||
    bookRoleFromMeta(
      raw && typeof raw === 'object' ? raw : { party_book_role: raw }
    );
  if (parsed === 'both') return 'both';
  return kind === 'supplier' ? 'supplier' : 'customer';
}

export function poPdfUrlFromMeta(metadata: unknown): string | null {
  const meta = asMeta(metadata);
  const url = String(meta.pdf_url || meta.attachment_url || '').trim();
  return /^https?:\/\//i.test(url) ? url : null;
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
