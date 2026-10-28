/**
 * Persist delivery notes on customer_invoices.metadata.
 * Public reads select no price, VAT or bank columns.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { missingSchemaColumn } from '@/lib/customers/schema-column';
import {
  assertNoCommercialFields,
  buildDeliveryNoteRecord,
  draftDeliveryLines,
  readDeliveryNotes,
  toPublicDeliveryNote,
  writeDeliveryNotes,
  type DeliveryNoteInput,
  type DeliveryNoteRecord,
  type DraftDeliveryLine,
  type PublicDeliveryNote,
  type SellerDeliveryNote,
} from '@/lib/customers/delivery-note';
import {
  buildDeliveryNoteToken,
  deliveryNotePdfUrl,
  deliveryNotePublicUrl,
  deliveryNoteTokenMatches,
  parseDeliveryNoteToken,
  rotateNonce,
  tryBuildDeliveryNoteToken,
} from '@/lib/customers/delivery-note-token';

type Supabase = ReturnType<typeof getSupabaseServer>;

export type DeliveryNoteFailure = { ok: false; error: string; status: number };

type InvoiceCore = {
  id: number;
  profile_id: number;
  invoice_number: string | null;
  customer_id: number | null;
  customer_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  billing_address: string | null;
  order_id: number | null;
  metadata: unknown;
  items?: unknown;
};

const INVOICE_EDIT_COLS =
  'id, profile_id, invoice_number, customer_id, customer_name, contact_name, contact_phone, billing_address, order_id, metadata, items';
const INVOICE_PUBLIC_COLS = 'id, profile_id, invoice_number, metadata';

function fail(error: string, status: number): DeliveryNoteFailure {
  return { ok: false, error, status };
}

function text(value: unknown): string | null {
  const s = String(value ?? '').trim();
  return s || null;
}

function sellerFromProfile(row: Record<string, unknown> | null): {
  name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
} {
  if (!row) {
    return { name: null, address: null, phone: null, email: null, logoUrl: null };
  }
  const address = [row.street || row.address, row.city, row.province, row.postal_code, row.country]
    .map((x) => (x ? String(x).trim() : ''))
    .filter(Boolean)
    .join(', ');
  return {
    name: text(row.trading_name) || text(row.legal_name),
    address: address || null,
    phone: text(row.contact_phone) || text(row.phone),
    email: text(row.contact_email) || text(row.email),
    logoUrl: text(row.logo_url),
  };
}

async function loadProfile(supabase: Supabase, companyId: number) {
  const { data } = await supabase.from('profiles').select('*').eq('id', companyId).maybeSingle();
  return sellerFromProfile((data || null) as Record<string, unknown> | null);
}

async function loadInvoice(
  supabase: Supabase,
  companyId: number,
  invoiceId: number,
  columns: string
): Promise<{ row: InvoiceCore | null; error: string | null; status: number }> {
  const { data, error } = await supabase
    .from('customer_invoices')
    .select(columns)
    .eq('id', invoiceId)
    .eq('profile_id', companyId)
    .maybeSingle();
  if (error) {
    if (missingSchemaColumn(error.message) === 'metadata') {
      return {
        row: null,
        error:
          'Invoice metadata is not available yet. Delivery notes are stored there (migration 20260817_customer_invoices_metadata.sql).',
        status: 503,
      };
    }
    return { row: null, error: error.message, status: 500 };
  }
  return { row: (data as InvoiceCore | null) || null, error: null, status: data ? 200 : 404 };
}

async function resolveDeliveryAddress(
  supabase: Supabase,
  companyId: number,
  invoice: InvoiceCore
): Promise<string | null> {
  const orderId = Number(invoice.order_id || 0);
  const customerId = Number(invoice.customer_id || 0);
  const [order, customer] = await Promise.all([
    orderId > 0
      ? supabase
          .from('sales_orders')
          .select('shipping_address')
          .eq('id', orderId)
          .eq('profile_id', companyId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    customerId > 0
      ? supabase
          .from('customers')
          .select('shipping_address, billing_address')
          .eq('id', customerId)
          .eq('profile_id', companyId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return (
    text((order.data as { shipping_address?: string } | null)?.shipping_address) ||
    text((customer.data as { shipping_address?: string } | null)?.shipping_address) ||
    text(invoice.billing_address) ||
    text((customer.data as { billing_address?: string } | null)?.billing_address)
  );
}

async function saveNotes(
  supabase: Supabase,
  companyId: number,
  invoiceId: number,
  metadata: unknown,
  notes: DeliveryNoteRecord[]
): Promise<DeliveryNoteFailure | null> {
  const next = writeDeliveryNotes(metadata, notes);
  const { error } = await supabase
    .from('customer_invoices')
    .update({ metadata: next, updated_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .eq('profile_id', companyId);
  if (!error) return null;
  if (missingSchemaColumn(error.message) === 'metadata') {
    return fail(
      'Invoice metadata is not available yet. Delivery notes are stored there (migration 20260817_customer_invoices_metadata.sql).',
      503
    );
  }
  return fail(error.message, 500);
}

function sellerNote(
  companyId: number,
  note: DeliveryNoteRecord,
  seller: ReturnType<typeof sellerFromProfile>
): SellerDeliveryNote {
  const view = toPublicDeliveryNote(note, seller);
  assertNoCommercialFields(view);
  const token = tryBuildDeliveryNoteToken({
    companyId,
    invoiceId: note.invoice_id || 0,
    noteId: note.id,
    nonce: note.nonce,
  });
  return {
    ...view,
    id: note.id,
    revoked: Boolean(note.revoked_at),
    createdAt: note.created_at,
    shareUrl: token ? deliveryNotePublicUrl(token) : '',
    pdfUrl: token ? deliveryNotePdfUrl(token) : '',
  };
}

export async function getDeliveryNoteDesk(opts: {
  companyId: number;
  invoiceId: number;
}): Promise<
  | {
      ok: true;
      invoiceNumber: string;
      customerName: string | null;
      contactPhone: string | null;
      notes: SellerDeliveryNote[];
      draft: {
        deliveryDate: string;
        deliveryAddress: string | null;
        lines: DraftDeliveryLine[];
      };
    }
  | DeliveryNoteFailure
> {
  const supabase = getSupabaseServer();
  const loaded = await loadInvoice(supabase, opts.companyId, opts.invoiceId, INVOICE_EDIT_COLS);
  if (!loaded.row) {
    return fail(loaded.error || 'Invoice not found', loaded.status === 200 ? 404 : loaded.status);
  }
  const invoice = loaded.row;
  const [seller, address] = await Promise.all([
    loadProfile(supabase, opts.companyId),
    resolveDeliveryAddress(supabase, opts.companyId, invoice),
  ]);
  const notes = readDeliveryNotes(invoice.metadata);
  return {
    ok: true,
    invoiceNumber: String(invoice.invoice_number || invoice.id),
    customerName: text(invoice.customer_name),
    contactPhone: text(invoice.contact_phone),
    notes: notes.map((n) => sellerNote(opts.companyId, { ...n, invoice_id: invoice.id }, seller)),
    draft: {
      deliveryDate: new Date().toISOString().slice(0, 10),
      deliveryAddress: address,
      lines: draftDeliveryLines(invoice.items, notes),
    },
  };
}

export async function createDeliveryNote(opts: {
  companyId: number;
  invoiceId: number;
  input: DeliveryNoteInput;
}): Promise<{ ok: true; note: SellerDeliveryNote } | DeliveryNoteFailure> {
  const supabase = getSupabaseServer();
  const loaded = await loadInvoice(supabase, opts.companyId, opts.invoiceId, INVOICE_EDIT_COLS);
  if (!loaded.row) {
    return fail(loaded.error || 'Invoice not found', loaded.status === 200 ? 404 : loaded.status);
  }
  const invoice = loaded.row;
  const [seller, address] = await Promise.all([
    loadProfile(supabase, opts.companyId),
    resolveDeliveryAddress(supabase, opts.companyId, invoice),
  ]);
  const existing = readDeliveryNotes(invoice.metadata);
  const built = buildDeliveryNoteRecord({
    invoiceId: invoice.id,
    invoiceNumber: String(invoice.invoice_number || invoice.id),
    customerName: invoice.customer_name,
    contactName: invoice.contact_name,
    contactPhone: invoice.contact_phone,
    sellerName: seller.name,
    items: invoice.items,
    existing,
    input: {
      ...opts.input,
      deliveryAddress: opts.input.deliveryAddress ?? address,
    },
  });
  if (!built.ok) return fail(built.error, 400);
  const saved = await saveNotes(supabase, opts.companyId, invoice.id, invoice.metadata, [
    built.note,
    ...existing,
  ]);
  if (saved) return saved;
  return { ok: true, note: sellerNote(opts.companyId, built.note, seller) };
}

export async function revokeDeliveryNote(opts: {
  companyId: number;
  invoiceId: number;
  noteId: string;
}): Promise<{ ok: true } | DeliveryNoteFailure> {
  const supabase = getSupabaseServer();
  const loaded = await loadInvoice(
    supabase,
    opts.companyId,
    opts.invoiceId,
    'id, profile_id, metadata'
  );
  if (!loaded.row) {
    return fail(loaded.error || 'Invoice not found', loaded.status === 200 ? 404 : loaded.status);
  }
  const notes = readDeliveryNotes(loaded.row.metadata);
  const idx = notes.findIndex((n) => n.id === opts.noteId);
  if (idx < 0) return fail('Delivery note not found', 404);
  notes[idx] = {
    ...notes[idx],
    revoked_at: new Date().toISOString(),
    nonce: rotateNonce(),
  };
  const saved = await saveNotes(
    supabase,
    opts.companyId,
    opts.invoiceId,
    loaded.row.metadata,
    notes
  );
  if (saved) return saved;
  return { ok: true };
}

export async function acknowledgeDeliveryNote(opts: {
  token: string;
  name: string;
  date: string;
}): Promise<{ ok: true; view: PublicDeliveryNote } | DeliveryNoteFailure> {
  const payload = parseDeliveryNoteToken(opts.token);
  if (!payload) return fail('This delivery note link is not available.', 403);
  const date = String(opts.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return fail('Enter the date you received the goods.', 400);
  }
  const name = String(opts.name || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  if (name.length < 2) return fail('Enter the name of the person who received the goods.', 400);

  const supabase = getSupabaseServer();
  const loaded = await loadInvoice(
    supabase,
    payload.companyId,
    payload.invoiceId,
    INVOICE_PUBLIC_COLS
  );
  if (!loaded.row) return fail('This delivery note link is not available.', 403);
  const notes = readDeliveryNotes(loaded.row.metadata);
  const idx = notes.findIndex((n) => n.id === payload.noteId);
  const note = idx >= 0 ? notes[idx] : null;
  if (!deliveryNoteTokenMatches(note, payload) || !note) {
    return fail('This delivery note link is not available.', 403);
  }
  notes[idx] = {
    ...note,
    received_by_name: name,
    received_by_date: date,
  };
  const saved = await saveNotes(
    supabase,
    payload.companyId,
    payload.invoiceId,
    loaded.row.metadata,
    notes
  );
  if (saved) return fail('This delivery note link is not available.', 403);
  const seller = await loadProfile(supabase, payload.companyId);
  const view = toPublicDeliveryNote(notes[idx], seller);
  assertNoCommercialFields(view);
  return { ok: true, view };
}

export async function loadPublicDeliveryNote(
  token: string
): Promise<{ ok: true; view: PublicDeliveryNote } | DeliveryNoteFailure> {
  const payload = parseDeliveryNoteToken(token);
  if (!payload) return fail('This delivery note link is not available.', 403);
  const supabase = getSupabaseServer();
  const [invoiceLoaded, seller] = await Promise.all([
    loadInvoice(supabase, payload.companyId, payload.invoiceId, INVOICE_PUBLIC_COLS),
    loadProfile(supabase, payload.companyId),
  ]);
  if (!invoiceLoaded.row) return fail('This delivery note link is not available.', 403);
  const note = readDeliveryNotes(invoiceLoaded.row.metadata).find((n) => n.id === payload.noteId);
  if (!deliveryNoteTokenMatches(note, payload) || !note) {
    return fail('This delivery note link is not available.', 403);
  }
  const view = toPublicDeliveryNote(
    { ...note, invoice_number: note.invoice_number || String(invoiceLoaded.row.invoice_number || '') },
    seller
  );
  assertNoCommercialFields(view);
  return { ok: true, view };
}

export async function loadSellerDeliveryNote(opts: {
  companyId: number;
  invoiceId: number;
  noteId: string;
}): Promise<{ ok: true; view: PublicDeliveryNote } | DeliveryNoteFailure> {
  const supabase = getSupabaseServer();
  const [loaded, seller] = await Promise.all([
    loadInvoice(supabase, opts.companyId, opts.invoiceId, INVOICE_PUBLIC_COLS),
    loadProfile(supabase, opts.companyId),
  ]);
  if (!loaded.row) {
    return fail(loaded.error || 'Invoice not found', loaded.status === 200 ? 404 : loaded.status);
  }
  const note = readDeliveryNotes(loaded.row.metadata).find((n) => n.id === opts.noteId);
  if (!note || note.revoked_at) return fail('Delivery note not found', 404);
  const view = toPublicDeliveryNote(note, seller);
  assertNoCommercialFields(view);
  return { ok: true, view };
}

/** Used by share URLs when the caller already holds the note. */
export function shareLinksFor(companyId: number, note: DeliveryNoteRecord): {
  shareUrl: string;
  pdfUrl: string;
} | null {
  try {
    const token = buildDeliveryNoteToken({
      companyId,
      invoiceId: note.invoice_id,
      noteId: note.id,
      nonce: note.nonce,
    });
    return {
      shareUrl: deliveryNotePublicUrl(token),
      pdfUrl: deliveryNotePdfUrl(token),
    };
  } catch {
    return null;
  }
}
