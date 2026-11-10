/**
 * The real SyncStore / BooksPort: PostgREST reads and writes plus the existing
 * SupplierAdvisor® accounting code. Only reached from the route; the unit tests
 * use in-memory fakes and never import this file.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { missingSchemaColumn } from '@/lib/customers/schema-column';
import { docNumber } from '@/lib/customers/documents';
import type {
  BooksPort,
  ClaimResult,
  Inserted,
  PaymentEntry,
  Row,
  SyncPorts,
  SyncStore,
} from './ports';

/** A claim that stays "processing" this long is treated as abandoned. */
const STALE_CLAIM_MS = 60_000;

/** Columns that must never be silently dropped when a schema column is missing. */
const CRITICAL = new Set([
  'profile_id',
  'metadata',
  'status',
  'items',
  'customer_id',
  'subtotal',
  'tax_amount',
  'total_amount',
  'invoice_number',
  'order_number',
]);

function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** "4123456789" -> "%4%1%2%3%4%5%6%7%8%9%" so separators in stored values still match. */
function spaced(v: string): string {
  return `%${v.split('').join('%')}%`;
}

type PgErr = { message?: string; code?: string } | null;

function isUnique(err: PgErr): boolean {
  return err?.code === '23505' || /duplicate key|unique constraint/i.test(err?.message || '');
}

function conflictKind(err: PgErr): 'ref' | 'number' | 'other' {
  const m = err?.message || '';
  if (/shop_order_ref/i.test(m)) return 'ref';
  if (/invoice_number/i.test(m)) return 'number';
  return 'other';
}

async function insertTolerant(table: string, payload: Row): Promise<Inserted> {
  const sb = getSupabaseServer();
  const row = { ...payload };
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await sb.from(table).insert(row).select('*').single();
    if (!error && data) return { ok: true, row: data as Row };
    if (isUnique(error)) return { ok: false, conflict: conflictKind(error) };
    const col = missingSchemaColumn(error?.message || '');
    if (col && row[col] !== undefined && !CRITICAL.has(col)) {
      delete row[col];
      continue;
    }
    throw new Error(`insert ${table} failed`);
  }
  throw new Error(`insert ${table} failed`);
}

async function updateTolerant(table: string, profileId: number, id: number, patch: Row): Promise<Row> {
  const sb = getSupabaseServer();
  const row = { ...patch };
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await sb
      .from(table)
      .update(row)
      .eq('id', id)
      .eq('profile_id', profileId)
      .select('*')
      .single();
    if (!error && data) return data as Row;
    const col = missingSchemaColumn(error?.message || '');
    if (col && row[col] !== undefined && !CRITICAL.has(col)) {
      delete row[col];
      continue;
    }
    throw new Error(`update ${table} failed`);
  }
  throw new Error(`update ${table} failed`);
}

async function selectFirst(
  table: string,
  build: (q: ReturnType<ReturnType<typeof getSupabaseServer>['from']>) => unknown
): Promise<Row | null> {
  const sb = getSupabaseServer();
  const q = build(sb.from(table)) as PromiseLike<{ data: Row[] | null; error: PgErr }>;
  const { data, error } = await q;
  if (error) throw new Error(`select ${table} failed`);
  return data && data.length ? data[0] : null;
}

export function createSupabaseStore(): SyncStore {
  const sb = () => getSupabaseServer();
  return {
    async claimKey({ profileId, key, event, fingerprint }): Promise<ClaimResult> {
      const nowIso = new Date().toISOString();
      const ins = await sb()
        .from('bfg_shop_sync_events')
        .insert({
          profile_id: profileId,
          idempotency_key: key,
          event,
          status: 'processing',
          fingerprint,
          updated_at: nowIso,
        })
        .select('id')
        .maybeSingle();
      if (!ins.error) return { kind: 'claimed' };
      if (!isUnique(ins.error)) throw new Error('claim failed');
      const { data: existing } = await sb()
        .from('bfg_shop_sync_events')
        .select('id, status, response, fingerprint, updated_at')
        .eq('profile_id', profileId)
        .eq('idempotency_key', key)
        .maybeSingle();
      if (!existing) return { kind: 'in_progress' };
      if (existing.status === 'done' && existing.response) {
        return {
          kind: 'replay',
          response: existing.response as Row,
          fingerprint: (existing.fingerprint as string | null) ?? null,
        };
      }
      const age = Date.now() - Date.parse(String(existing.updated_at));
      if (Number.isFinite(age) && age > STALE_CLAIM_MS) {
        // Take over an abandoned claim; only one caller wins (compare-and-set on updated_at).
        const { data: won } = await sb()
          .from('bfg_shop_sync_events')
          .update({ updated_at: nowIso })
          .eq('id', existing.id)
          .eq('status', 'processing')
          .eq('updated_at', existing.updated_at)
          .select('id');
        if (won && won.length) return { kind: 'claimed' };
      }
      return { kind: 'in_progress' };
    },
    async completeKey({ profileId, key, response }) {
      const { error } = await sb()
        .from('bfg_shop_sync_events')
        .update({
          status: 'done',
          response,
          http_status: 200,
          updated_at: new Date().toISOString(),
        })
        .eq('profile_id', profileId)
        .eq('idempotency_key', key);
      if (error) throw new Error('complete failed');
    },
    async releaseKey({ profileId, key }) {
      await sb()
        .from('bfg_shop_sync_events')
        .delete()
        .eq('profile_id', profileId)
        .eq('idempotency_key', key)
        .eq('status', 'processing');
    },

    customerByShopId: (profileId, id) =>
      selectFirst('customers', (q) =>
        (q as any).select('*').eq('profile_id', profileId).eq('metadata->>shop_customer_id', id).limit(1)
      ),
    customerById: (profileId, id) =>
      selectFirst('customers', (q) =>
        (q as any).select('*').eq('profile_id', profileId).eq('id', id).limit(1)
      ),
    async customersByVat(profileId, digits) {
      const { data } = await sb()
        .from('customers')
        .select('*')
        .eq('profile_id', profileId)
        .ilike('vat_number', spaced(digits))
        .limit(25);
      return (data || []) as Row[];
    },
    async customersByRegistration(profileId, normalised) {
      const { data } = await sb()
        .from('customers')
        .select('*')
        .eq('profile_id', profileId)
        .ilike('registration_number', spaced(normalised))
        .limit(25);
      return (data || []) as Row[];
    },
    async customersByEmail(profileId, email) {
      const { data } = await sb()
        .from('customers')
        .select('*')
        .eq('profile_id', profileId)
        .ilike('email', escapeLike(email))
        .limit(5);
      return (data || []) as Row[];
    },
    async customersByName(profileId, name) {
      const { data } = await sb()
        .from('customers')
        .select('id')
        .eq('profile_id', profileId)
        .ilike('trading_name', escapeLike(name))
        .limit(10);
      return (data || []) as Row[];
    },
    insertCustomer: (row) => insertTolerant('customers', row),
    updateCustomer: (profileId, id, patch) => updateTolerant('customers', profileId, id, patch),

    async productsByShopIds(profileId, ids) {
      const { data, error } = await sb()
        .from('products')
        .select('id, metadata')
        .eq('profile_id', profileId)
        .in('metadata->>shop_product_id', ids);
      if (error) throw new Error('select products failed');
      const out: Record<string, Row> = {};
      for (const r of (data || []) as Row[]) {
        const meta = (r.metadata || {}) as Row;
        const sid = String(meta.shop_product_id || '');
        if (sid) out[sid] = r;
      }
      return out;
    },

    orderByShopRef: (profileId, ref) =>
      selectFirst('sales_orders', (q) =>
        (q as any)
          .select('*')
          .eq('profile_id', profileId)
          .eq('metadata->>shop_order_ref', ref)
          .order('id', { ascending: true })
          .limit(1)
      ),
    insertOrder: (row) => insertTolerant('sales_orders', row),
    updateOrder: (profileId, id, patch) => updateTolerant('sales_orders', profileId, id, patch),
    invoiceByShopRef: (profileId, ref) =>
      selectFirst('customer_invoices', (q) =>
        (q as any)
          .select('*')
          .eq('profile_id', profileId)
          .eq('metadata->>shop_order_ref', ref)
          .order('id', { ascending: true })
          .limit(1)
      ),
    insertInvoice: (row) => insertTolerant('customer_invoices', row),
    updateInvoice: (profileId, id, patch) => updateTolerant('customer_invoices', profileId, id, patch),

    paymentByReference: (profileId, invoiceId, reference) =>
      selectFirst('customer_invoice_payments', (q) =>
        (q as any)
          .select('*')
          .eq('profile_id', profileId)
          .eq('invoice_id', invoiceId)
          .eq('reference', reference)
          .limit(1)
      ),
    async paymentCount(profileId, invoiceId) {
      const { count, error } = await sb()
        .from('customer_invoice_payments')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .eq('invoice_id', invoiceId);
      if (error) throw new Error('count payments failed');
      return count || 0;
    },
    async recordPayment(entry: PaymentEntry): Promise<Inserted> {
      const { recordArPayment } = await import('@/lib/customers/ar-ledger');
      const res = await recordArPayment({ ...entry });
      if (res.ok && res.entry) return { ok: true, row: res.entry as unknown as Row };
      if (!res.ok && /duplicate key|unique/i.test(res.error || '')) {
        return { ok: false, conflict: 'other' };
      }
      throw new Error('record payment failed');
    },

    async bankAccountIds(profileId) {
      const { data, error } = await sb().from('bank_accounts').select('id').eq('profile_id', profileId).limit(5);
      if (error) throw new Error('select bank accounts failed');
      return ((data || []) as Row[]).map((r) => Number(r.id)).filter((n) => n > 0);
    },
    async financeTwin(profileId, id) {
      const { data } = await sb().from('invoices').select('*').eq('id', id).eq('profile_id', profileId).maybeSingle();
      return (data as Row | null) ?? null;
    },
  };
}

export function createBooksPort(): BooksPort {
  return {
    async ensurePartyGl(profileId) {
      const { ensurePartyGlAccounts } = await import('@/lib/accounting/party-gl-accounts');
      await ensurePartyGlAccounts(profileId);
    },
    async syncInvoice({ profileId, invoice, createdBy }) {
      const { syncCrmInvoiceToBooks } = await import('@/lib/accounting/crm-invoice-gl');
      const r = await syncCrmInvoiceToBooks({ profileId, crmInvoice: invoice, createdBy });
      return { ok: r.ok, financeInvoiceId: r.financeInvoiceId, error: r.error };
    },
    async voidInvoiceBooks({ profileId, invoice, createdBy }) {
      // The void branch of syncCrmInvoiceToBooks calls reverseInvoiceBooks and marks the Finance twin void.
      const { syncCrmInvoiceToBooks } = await import('@/lib/accounting/crm-invoice-gl');
      const r = await syncCrmInvoiceToBooks({
        profileId,
        crmInvoice: { ...invoice, status: 'void' },
        createdBy,
      });
      return { ok: r.ok, error: r.error };
    },
    async settlePayment({ profileId, financeInvoice, paymentId, amount, paidAt, bankAccountId, createdBy }) {
      const { settleInvoicePayment } = await import('@/lib/accounting/invoice-gl');
      const r = await settleInvoicePayment({
        profileId,
        invoice: financeInvoice,
        paymentId,
        amount,
        paidAt,
        bankAccountId,
        createdBy,
      });
      return { ok: r.ok, error: r.error };
    },
  };
}

export function createSyncPorts(): SyncPorts {
  return {
    store: createSupabaseStore(),
    books: createBooksPort(),
    docNumber,
    nowMs: () => Date.now(),
    async alert(a) {
      try {
        const profileId = Number(a.metadata.profile_id || 0);
        if (!profileId) return;
        await getSupabaseServer().from('notifications').insert({
          profile_id: profileId,
          type: 'bfg_shop_sync_alert',
          title: a.title,
          body: a.body,
          metadata: a.metadata,
          read: false,
        });
      } catch {
        /* soft */
      }
    },
  };
}
