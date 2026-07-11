/**
 * Load quote/order/invoice + seller profile + customer contact for render/send.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { normalizeItems } from '@/lib/customers/documents';
import {
  extractBankFromProfile,
  resolveCustomerContact,
  renderCommercialDocumentHtml,
  type DocRenderInput,
} from '@/lib/customers/invoice-document';

const TABLES = {
  quote: 'customer_quotes',
  order: 'sales_orders',
  invoice: 'customer_invoices',
} as const;

const NUM_FIELD = {
  quote: 'quote_number',
  order: 'order_number',
  invoice: 'invoice_number',
} as const;

export type DocKind = keyof typeof TABLES;

export async function loadCommercialDocument(opts: {
  companyId: number;
  type: DocKind;
  id: number;
}): Promise<
  | {
      ok: true;
      doc: Record<string, unknown>;
      html: string;
      input: DocRenderInput;
      toEmail: string | null;
      bankDetailsIncluded: boolean;
    }
  | { ok: false; error: string; status: number }
> {
  const { companyId, type, id } = opts;
  if (!TABLES[type]) {
    return { ok: false, error: 'Invalid document type', status: 400 };
  }

  const supabase = getSupabaseServer();
  const { data: doc, error } = await supabase
    .from(TABLES[type])
    .select('*')
    .eq('id', id)
    .eq('profile_id', companyId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message, status: 500 };
  if (!doc) return { ok: false, error: 'Document not found', status: 404 };

  const customerId = doc.customer_id != null ? Number(doc.customer_id) : null;
  const [{ data: profile }, { data: customer }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', companyId).maybeSingle(),
    customerId
      ? supabase.from('customers').select('*').eq('id', customerId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const seller = extractBankFromProfile((profile || {}) as Record<string, unknown>);
  const contact = resolveCustomerContact(
    customer as Record<string, unknown> | null,
    doc as Record<string, unknown>
  );

  // Persist missing contact fields back onto the document when we resolved them
  // (best-effort, non-blocking for render)
  if (
    customerId &&
    (!doc.contact_email || !doc.customer_name) &&
    (contact.contactEmail || contact.customerName)
  ) {
    void supabase
      .from(TABLES[type])
      .update({
        customer_name: contact.customerName || doc.customer_name,
        contact_name: contact.contactName || doc.contact_name,
        contact_email: contact.contactEmail || doc.contact_email,
        contact_phone: contact.contactPhone || doc.contact_phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('profile_id', companyId);
  }

  const items = normalizeItems(doc.items);
  const input: DocRenderInput = {
    kind: type,
    number: String(doc[NUM_FIELD[type]] || id),
    status: doc.status,
    currency: doc.currency,
    issuedAt: doc.created_at || doc.issued_at || doc.issue_date,
    dueDate: doc.due_date,
    validUntil: doc.valid_until,
    customerName: contact.customerName,
    contactName: contact.contactName,
    contactEmail: contact.contactEmail,
    contactPhone: contact.contactPhone,
    notes: doc.notes,
    items,
    subtotal: Number(doc.subtotal || 0),
    taxRate: Number(doc.tax_rate || 0),
    taxAmount: Number(doc.tax_amount || 0),
    totalAmount: Number(doc.total_amount || 0),
    seller,
  };

  const html = renderCommercialDocumentHtml(input);
  const bankDetailsIncluded = Boolean(
    seller.bank_name || seller.account_number || seller.iban
  );

  return {
    ok: true,
    doc: doc as Record<string, unknown>,
    html,
    input,
    toEmail: contact.contactEmail,
    bankDetailsIncluded,
  };
}
