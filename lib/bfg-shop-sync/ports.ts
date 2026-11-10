/**
 * Ports for the shop sync handlers. The handlers hold the contract logic and
 * talk to the database and the books only through these interfaces, so the
 * unit tests run against in-memory fakes (no database, no network).
 * supabase-adapter.ts is the one real implementation.
 */

export type Row = Record<string, unknown>;

export type ClaimResult =
  | { kind: 'claimed' }
  | { kind: 'replay'; response: Row; fingerprint: string | null }
  | { kind: 'in_progress' };

export type Inserted =
  | { ok: true; row: Row }
  | { ok: false; conflict: 'ref' | 'number' | 'other' };

export type PaymentEntry = {
  profile_id: number;
  invoice_id: number;
  customer_id: number | null;
  amount: number;
  currency: string;
  paid_at: string;
  method: string;
  reference: string;
  notes: string;
  created_by: string;
};

export interface SyncStore {
  // Idempotency store keyed (profile_id, idempotency_key)
  claimKey(p: {
    profileId: number;
    key: string;
    event: string;
    fingerprint: string | null;
  }): Promise<ClaimResult>;
  completeKey(p: { profileId: number; key: string; response: Row }): Promise<void>;
  releaseKey(p: { profileId: number; key: string }): Promise<void>;

  // Customers (CRM `customers` table)
  customerByShopId(profileId: number, shopCustomerId: string): Promise<Row | null>;
  customerById(profileId: number, id: number): Promise<Row | null>;
  customersByVat(profileId: number, digits: string): Promise<Row[]>;
  customersByRegistration(profileId: number, normalised: string): Promise<Row[]>;
  customersByEmail(profileId: number, email: string): Promise<Row[]>;
  customersByName(profileId: number, name: string): Promise<Row[]>;
  insertCustomer(row: Row): Promise<Inserted>;
  updateCustomer(profileId: number, id: number, patch: Row): Promise<Row>;

  // Product map: products.metadata.shop_product_id
  productsByShopIds(profileId: number, shopProductIds: string[]): Promise<Record<string, Row>>;

  // Sales orders and invoices (keys of record: metadata.shop_order_ref)
  orderByShopRef(profileId: number, reference: string): Promise<Row | null>;
  insertOrder(row: Row): Promise<Inserted>;
  updateOrder(profileId: number, id: number, patch: Row): Promise<Row>;
  invoiceByShopRef(profileId: number, reference: string): Promise<Row | null>;
  insertInvoice(row: Row): Promise<Inserted>;
  updateInvoice(profileId: number, id: number, patch: Row): Promise<Row>;

  // Payments (customer_invoice_payments, key of record (invoice_id, reference))
  paymentByReference(profileId: number, invoiceId: number, reference: string): Promise<Row | null>;
  paymentCount(profileId: number, invoiceId: number): Promise<number>;
  recordPayment(entry: PaymentEntry): Promise<Inserted>;

  bankAccountIds(profileId: number): Promise<number[]>;
  financeTwin(profileId: number, financeInvoiceId: number): Promise<Row | null>;
}

/** Wrappers over the existing accounting code. No ad-hoc ledger writes. */
export interface BooksPort {
  ensurePartyGl(profileId: number): Promise<void>;
  /** syncCrmInvoiceToBooks: Dr AR, Cr Sales, Cr VAT, plus ledger-only COGS. */
  syncInvoice(p: {
    profileId: number;
    invoice: Row;
    createdBy: string;
  }): Promise<{ ok: boolean; financeInvoiceId?: number; error?: string }>;
  /** Void path: reverseInvoiceBooks via syncCrmInvoiceToBooks. */
  voidInvoiceBooks(p: {
    profileId: number;
    invoice: Row;
    createdBy: string;
  }): Promise<{ ok: boolean; error?: string }>;
  /** settleInvoicePayment: Dr bank, Cr AR, keyed on the payment row id. */
  settlePayment(p: {
    profileId: number;
    financeInvoice: Row;
    paymentId: number;
    amount: number;
    paidAt: string;
    bankAccountId: number;
    createdBy: string;
  }): Promise<{ ok: boolean; error?: string }>;
}

export type AlertInput = {
  code: string;
  title: string;
  body: string;
  metadata: Row;
};

export interface SyncPorts {
  store: SyncStore;
  books: BooksPort;
  /** Admin alert (never sent to customers). Soft-fails. */
  alert(a: AlertInput): Promise<void>;
  docNumber(prefix: string): string;
  nowMs(): number;
}
