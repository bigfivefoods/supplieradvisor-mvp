/**
 * Post member-account charges onto CRM customers + customer_invoices (AR).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { recordArPayment } from '@/lib/customers/ar-ledger';
import { docNumber } from '@/lib/customers/documents';
import type { MemberAccountCharge } from '@/lib/b2c/member-account-types';

export async function ensureAdvisorCrmCustomer(opts: {
  companyId: number;
  name: string;
  email?: string | null;
  kind: string;
  refId: string;
}): Promise<{ id: number; name: string; email: string | null } | null> {
  const supabase = getSupabaseServer();
  const email = String(opts.email || '')
    .trim()
    .toLowerCase();
  const tag = `advisor_ref:${opts.kind}:${opts.refId}`;

  if (email) {
    const { data: hits } = await supabase
      .from('customers')
      .select('id, trading_name, email, notes')
      .eq('profile_id', opts.companyId)
      .ilike('email', email)
      .limit(5);
    const match = (hits || [])[0];
    if (match?.id) {
      return {
        id: Number(match.id),
        name: String(match.trading_name || opts.name),
        email: match.email ? String(match.email) : email,
      };
    }
  }

  const { data: tagged } = await supabase
    .from('customers')
    .select('id, trading_name, email, notes')
    .eq('profile_id', opts.companyId)
    .ilike('notes', `%${tag}%`)
    .limit(1)
    .maybeSingle();
  if (tagged?.id) {
    return {
      id: Number(tagged.id),
      name: String(tagged.trading_name || opts.name),
      email: tagged.email ? String(tagged.email) : email || null,
    };
  }

  const payload: Record<string, unknown> = {
    profile_id: opts.companyId,
    trading_name: opts.name.trim() || 'Member',
    contact_name: opts.name.trim() || 'Member',
    email: email || null,
    status: 'active',
    customer_type: 'consumer',
    source: 'advisor_member',
    currency: 'ZAR',
    notes: tag,
    updated_at: new Date().toISOString(),
  };
  let { data, error } = await supabase
    .from('customers')
    .insert(payload)
    .select('id, trading_name, email')
    .maybeSingle();
  if (error && /customer_type|column|schema cache/i.test(error.message || '')) {
    delete payload.customer_type;
    delete payload.source;
    const retry = await supabase
      .from('customers')
      .insert(payload)
      .select('id, trading_name, email')
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }
  if (error || !data?.id) {
    console.warn('[member-account] CRM customer', error?.message);
    return null;
  }
  return {
    id: Number(data.id),
    name: String(data.trading_name || opts.name),
    email: data.email ? String(data.email) : email || null,
  };
}

export async function createInvoiceForCharge(opts: {
  companyId: number;
  charge: MemberAccountCharge;
  customerId: number;
  customerName: string;
  customerEmail?: string | null;
}): Promise<{ invoice_id: number; invoice_number: string } | null> {
  const supabase = getSupabaseServer();
  const amount = Math.round(Number(opts.charge.amount_zar) * 100) / 100;
  if (!(amount > 0)) return null;
  const invoiceNumber = docNumber('INV');
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    profile_id: opts.companyId,
    customer_id: opts.customerId,
    invoice_number: invoiceNumber,
    status: 'sent',
    currency: 'ZAR',
    subtotal: amount,
    tax_rate: 0,
    tax_amount: 0,
    total_amount: amount,
    amount_paid: 0,
    customer_name: opts.customerName,
    contact_name: opts.customerName,
    contact_email: opts.customerEmail || null,
    notes: `Member account ${opts.charge.id} · ${opts.charge.kind}/${opts.charge.ref_id}`,
    items: [
      {
        name: opts.charge.description,
        quantity: 1,
        unit_price: amount,
        line_total: amount,
        uom: 'account',
      },
    ],
    due_date: opts.charge.due_date || now.slice(0, 10),
    payment_terms: 'Due on receipt',
    updated_at: now,
  };

  let { data, error } = await supabase
    .from('customer_invoices')
    .insert(payload)
    .select('id, invoice_number')
    .maybeSingle();
  if (error && /column|schema cache/i.test(error.message || '')) {
    delete payload.payment_terms;
    delete payload.contact_name;
    const retry = await supabase
      .from('customer_invoices')
      .insert(payload)
      .select('id, invoice_number')
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }
  if (error || !data?.id) {
    console.warn('[member-account] invoice', error?.message);
    return null;
  }
  return {
    invoice_id: Number(data.id),
    invoice_number: String(data.invoice_number || invoiceNumber),
  };
}

export async function applyInvoicePayment(opts: {
  companyId: number;
  invoiceId: number;
  amount: number;
  method: string;
  reference?: string | null;
  proofUrl?: string | null;
  notes?: string | null;
  actorUserId?: string | null;
  customerId?: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseServer();
  const { data: inv, error: invErr } = await supabase
    .from('customer_invoices')
    .select('id, total_amount, amount_paid, status, currency, customer_id')
    .eq('id', opts.invoiceId)
    .eq('profile_id', opts.companyId)
    .maybeSingle();
  if (invErr || !inv) {
    return { ok: false, error: invErr?.message || 'Invoice not found' };
  }
  const now = new Date().toISOString();
  const amount = Math.round(Number(opts.amount) * 100) / 100;
  const ledger = await recordArPayment({
    profile_id: opts.companyId,
    invoice_id: opts.invoiceId,
    customer_id:
      opts.customerId ??
      (inv.customer_id != null ? Number(inv.customer_id) : null),
    amount,
    currency: String(inv.currency || 'ZAR'),
    paid_at: now,
    method: opts.method,
    reference: opts.reference || null,
    proof_url: opts.proofUrl || null,
    notes: opts.notes || 'Member account payment',
    created_by: opts.actorUserId || null,
    amount_base: amount,
    base_currency: 'ZAR',
    fx_rate: 1,
    fx_as_of: now.slice(0, 10),
  });
  if (!ledger.ok) return { ok: false, error: ledger.error };

  const nextPaid = Number(inv.amount_paid || 0) + amount;
  const total = Number(inv.total_amount || 0);
  const fullyPaid = nextPaid >= total - 0.01;
  const update: Record<string, unknown> = {
    amount_paid: nextPaid,
    status: fullyPaid ? 'paid' : 'partial',
    paid_at: fullyPaid ? now : null,
    updated_at: now,
  };
  if (opts.reference) update.payment_reference = opts.reference;
  let { error: upErr } = await supabase
    .from('customer_invoices')
    .update(update)
    .eq('id', opts.invoiceId);
  if (
    upErr &&
    /payment_reference|column|schema cache/i.test(upErr.message || '')
  ) {
    delete update.payment_reference;
    const retry = await supabase
      .from('customer_invoices')
      .update(update)
      .eq('id', opts.invoiceId);
    upErr = retry.error;
  }
  if (upErr) return { ok: false, error: upErr.message };
  return { ok: true };
}

export async function attachInvoiceToCharge(
  companyId: number,
  charge: MemberAccountCharge
): Promise<MemberAccountCharge> {
  if (charge.invoice_id) return charge;
  const customer = await ensureAdvisorCrmCustomer({
    companyId,
    name: charge.member_name,
    email: charge.member_email,
    kind: charge.kind,
    refId: charge.ref_id,
  });
  if (!customer) return charge;
  const inv = await createInvoiceForCharge({
    companyId,
    charge,
    customerId: customer.id,
    customerName: customer.name,
    customerEmail: customer.email,
  });
  if (!inv) return { ...charge, customer_id: customer.id };
  return {
    ...charge,
    customer_id: customer.id,
    invoice_id: inv.invoice_id,
    invoice_number: inv.invoice_number,
  };
}
