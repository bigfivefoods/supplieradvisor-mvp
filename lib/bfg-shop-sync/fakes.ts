/**
 * In-memory SyncStore / BooksPort for the unit tests. No database, no network.
 * It mimics the unique keys of record the migration adds.
 */
import type {
  AlertInput,
  BooksPort,
  ClaimResult,
  Inserted,
  PaymentEntry,
  Row,
  SyncPorts,
  SyncStore,
} from './ports';

const meta = (r: Row) => ((r.metadata as Row) || {}) as Row;
const digits = (v: unknown) => String(v || '').replace(/\D+/g, '');
const norm = (v: unknown) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export class FakeDb {
  customers: Row[] = [];
  orders: Row[] = [];
  invoices: Row[] = [];
  payments: Row[] = [];
  twins: Row[] = [];
  products: Row[] = [];
  banks: number[] = [101];
  events = new Map<string, { status: string; response?: Row; fingerprint: string | null }>();
  alerts: AlertInput[] = [];
  calls: string[] = [];
  seq = 1000;
  /** Set to make a store call throw (to test failure handling). */
  failOn: string | null = null;
  /** When true the fake books refuse to sync an invoice. */
  booksFail = false;
  settled = new Set<number>();
  settleCalls: Array<{ paymentId: number; amount: number; bankAccountId: number }> = [];
  voidCalls: number[] = [];
  syncCalls: Array<{ invoiceId: number; status: string }> = [];
  ensureGlCalls = 0;
  docSeq = 0;
  /** invoice numbers that "already exist" so the first allocation collides. */
  takenNumbers = new Set<string>();

  next() {
    return ++this.seq;
  }
}

export function createFakePorts(db: FakeDb, nowMs: number): SyncPorts {
  const hit = (name: string) => {
    db.calls.push(name);
    if (db.failOn === name) throw new Error('boom');
  };
  const store: SyncStore = {
    async claimKey({ key, event, fingerprint }): Promise<ClaimResult> {
      hit('claimKey');
      const ex = db.events.get(key);
      if (!ex) {
        db.events.set(key, { status: 'processing', fingerprint });
        return { kind: 'claimed' };
      }
      if (ex.status === 'done' && ex.response) {
        return { kind: 'replay', response: ex.response, fingerprint: ex.fingerprint };
      }
      void event;
      return { kind: 'in_progress' };
    },
    async completeKey({ key, response }) {
      hit('completeKey');
      const ex = db.events.get(key)!;
      ex.status = 'done';
      ex.response = JSON.parse(JSON.stringify(response));
    },
    async releaseKey({ key }) {
      hit('releaseKey');
      const ex = db.events.get(key);
      if (ex && ex.status === 'processing') db.events.delete(key);
    },
    async customerByShopId(_p, id) {
      hit('customerByShopId');
      return db.customers.find((c) => meta(c).shop_customer_id === id) ?? null;
    },
    async customerById(_p, id) {
      hit('customerById');
      return db.customers.find((c) => c.id === id) ?? null;
    },
    async customersByVat(_p, d) {
      hit('customersByVat');
      return db.customers.filter((c) => digits(c.vat_number) === d);
    },
    async customersByRegistration(_p, n) {
      hit('customersByRegistration');
      return db.customers.filter((c) => norm(c.registration_number) === n);
    },
    async customersByEmail(_p, email) {
      hit('customersByEmail');
      return db.customers.filter((c) => String(c.email || '').toLowerCase() === email);
    },
    async customersByName(_p, name) {
      hit('customersByName');
      return db.customers.filter(
        (c) => String(c.trading_name || '').toLowerCase() === name.toLowerCase()
      );
    },
    async insertCustomer(row): Promise<Inserted> {
      hit('insertCustomer');
      const sid = meta(row).shop_customer_id;
      if (sid && db.customers.some((c) => meta(c).shop_customer_id === sid)) {
        return { ok: false, conflict: 'other' };
      }
      const saved = { id: db.next(), ...row };
      db.customers.push(saved);
      return { ok: true, row: saved };
    },
    async updateCustomer(_p, id, patch) {
      hit('updateCustomer');
      const row = db.customers.find((c) => c.id === id)!;
      Object.assign(row, patch);
      return row;
    },
    async productsByShopIds(_p, ids) {
      hit('productsByShopIds');
      const out: Record<string, Row> = {};
      for (const p of db.products) {
        const sid = String(meta(p).shop_product_id || '');
        if (sid && ids.includes(sid)) out[sid] = p;
      }
      return out;
    },
    async orderByShopRef(_p, ref) {
      hit('orderByShopRef');
      return db.orders.find((o) => meta(o).shop_order_ref === ref) ?? null;
    },
    async insertOrder(row): Promise<Inserted> {
      hit('insertOrder');
      if (db.orders.some((o) => meta(o).shop_order_ref === meta(row).shop_order_ref)) {
        return { ok: false, conflict: 'ref' };
      }
      const saved = { id: db.next(), ...row };
      db.orders.push(saved);
      return { ok: true, row: saved };
    },
    async updateOrder(_p, id, patch) {
      hit('updateOrder');
      const row = db.orders.find((o) => o.id === id)!;
      Object.assign(row, patch);
      return row;
    },
    async invoiceByShopRef(_p, ref) {
      hit('invoiceByShopRef');
      return db.invoices.find((i) => meta(i).shop_order_ref === ref) ?? null;
    },
    async insertInvoice(row): Promise<Inserted> {
      hit('insertInvoice');
      if (db.invoices.some((i) => meta(i).shop_order_ref === meta(row).shop_order_ref)) {
        return { ok: false, conflict: 'ref' };
      }
      if (
        db.takenNumbers.has(String(row.invoice_number)) ||
        db.invoices.some((i) => i.invoice_number === row.invoice_number)
      ) {
        return { ok: false, conflict: 'number' };
      }
      const saved = { id: db.next(), ...row };
      db.invoices.push(saved);
      return { ok: true, row: saved };
    },
    async updateInvoice(_p, id, patch) {
      hit('updateInvoice');
      const row = db.invoices.find((i) => i.id === id)!;
      Object.assign(row, patch);
      return row;
    },
    async paymentByReference(_p, invoiceId, reference) {
      hit('paymentByReference');
      return db.payments.find((p) => p.invoice_id === invoiceId && p.reference === reference) ?? null;
    },
    async paymentCount(_p, invoiceId) {
      hit('paymentCount');
      return db.payments.filter((p) => p.invoice_id === invoiceId).length;
    },
    async recordPayment(entry: PaymentEntry): Promise<Inserted> {
      hit('recordPayment');
      if (db.payments.some((p) => p.invoice_id === entry.invoice_id && p.reference === entry.reference)) {
        return { ok: false, conflict: 'other' };
      }
      const saved = { id: db.next(), ...entry } as Row;
      db.payments.push(saved);
      return { ok: true, row: saved };
    },
    async bankAccountIds() {
      hit('bankAccountIds');
      return db.banks;
    },
    async financeTwin(_p, id) {
      hit('financeTwin');
      return db.twins.find((t) => t.id === id) ?? null;
    },
  };

  const books: BooksPort = {
    async ensurePartyGl() {
      db.ensureGlCalls += 1;
    },
    async syncInvoice({ invoice }) {
      db.syncCalls.push({ invoiceId: Number(invoice.id), status: String(invoice.status) });
      if (db.booksFail) return { ok: false, error: 'books down' };
      let twin = db.twins.find((t) => t.crm_invoice_id === invoice.id);
      if (!twin) {
        twin = { id: db.next(), crm_invoice_id: invoice.id, total_amount: invoice.total_amount };
        db.twins.push(twin);
      }
      // Like the real code: stamp the recognition journal on the CRM invoice metadata.
      const row = db.invoices.find((i) => i.id === invoice.id);
      if (row && !meta(row).recognition_journal_id) {
        row.metadata = { ...meta(row), recognition_journal_id: db.next(), finance_invoice_id: twin.id };
      }
      return { ok: true, financeInvoiceId: Number(twin.id) };
    },
    async voidInvoiceBooks({ invoice }) {
      db.voidCalls.push(Number(invoice.id));
      return { ok: true };
    },
    async settlePayment({ paymentId, amount, bankAccountId }) {
      db.settleCalls.push({ paymentId, amount, bankAccountId });
      db.settled.add(paymentId);
      return { ok: true };
    },
  };

  return {
    store,
    books,
    async alert(a) {
      db.alerts.push(a);
    },
    docNumber(prefix) {
      db.docSeq += 1;
      return `${prefix}-20261110-${String(db.docSeq).padStart(4, '0')}`;
    },
    nowMs: () => nowMs,
  };
}
