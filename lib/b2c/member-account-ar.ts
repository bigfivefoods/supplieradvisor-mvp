/**
 * Post member-account charges onto CRM customers + customer_invoices (AR).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { recordArPayment } from '@/lib/customers/ar-ledger';
import { docNumber } from '@/lib/customers/documents';
import type { MemberAccountCharge } from '@/lib/b2c/member-account-types';
import { splitInclusiveVat, SA_VAT_PCT } from '@/lib/core-os/finance';
import {
  ADVISOR_CRM_CUSTOMER_TYPE,
  advisorKindAliases,
  advisorRefTag,
  canonicalAdvisorKind,
} from '@/lib/core-os/kinds';

/** Dual-write an Advisor member / patient onto Core Customers. */
export async function attachCrmToAdvisorPerson(opts: {
  companyId: number;
  kind: string;
  person: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    crm_customer_id?: number | null;
    ar_account_code?: string | null;
  };
}): Promise<number | null> {
  try {
    const crm = await ensureAdvisorCrmCustomer({
      companyId: opts.companyId,
      name: opts.person.name,
      email: opts.person.email || null,
      phone: opts.person.phone || null,
      kind: opts.kind,
      refId: opts.person.id,
    });
    if (crm?.id) {
      opts.person.crm_customer_id = crm.id;
      const stamp = String(crm.ar_account_code || '');
      if (/^1180-\d{7}$/.test(stamp)) {
        opts.person.ar_account_code = stamp;
      }
      return crm.id;
    }
  } catch {
    /* best-effort */
  }
  return null;
}

export async function ensureAdvisorCrmCustomer(opts: {
  companyId: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  kind: string;
  refId: string;
  skipPartyGl?: boolean;
}): Promise<{
  id: number;
  name: string;
  email: string | null;
  ar_account_code: string | null;
} | null> {
  const supabase = getSupabaseServer();
  const email = String(opts.email || '')
    .trim()
    .toLowerCase();
  const phone = String(opts.phone || '').trim() || null;
  const canonical = canonicalAdvisorKind(opts.kind);
  const tags = advisorKindAliases(opts.kind).map((k) =>
    advisorRefTag(k, opts.refId)
  );
  const notesBlob = tags.join('\n') || advisorRefTag(canonical, opts.refId);

  if (email) {
    const { data: hits } = await supabase
      .from('customers')
      .select('id, trading_name, email, phone, notes, customer_type')
      .eq('profile_id', opts.companyId)
      .ilike('email', email)
      .limit(5);
    const match = (hits || [])[0];
    if (match?.id) {
      const notes = String(match.notes || '');
      const missing = tags.filter((t) => !notes.includes(t));
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (missing.length) {
        patch.notes = notes ? `${notes}\n${missing.join('\n')}` : missing.join('\n');
      }
      if (phone && !(match as { phone?: string | null }).phone) patch.phone = phone;
      const type = String(
        (match as { customer_type?: string | null }).customer_type || ''
      ).toLowerCase();
      if (type !== ADVISOR_CRM_CUSTOMER_TYPE) {
        patch.customer_type = ADVISOR_CRM_CUSTOMER_TYPE;
      }
      if (Object.keys(patch).length > 1) {
        await supabase
          .from('customers')
          .update(patch)
          .eq('id', match.id)
          .eq('profile_id', opts.companyId);
      }
      return finishAdvisorCustomer(
        opts.companyId,
        {
          id: Number(match.id),
          name: String(match.trading_name || opts.name),
          email: match.email ? String(match.email) : email,
        },
        opts.skipPartyGl
      );
    }
  }

  type TaggedCustomer = {
    id: number;
    trading_name?: string | null;
    email?: string | null;
    customer_type?: string | null;
  };
  let tagged: TaggedCustomer | null = null;
  for (const t of tags) {
    const hit = await supabase
      .from('customers')
      .select('id, trading_name, email, notes, customer_type')
      .eq('profile_id', opts.companyId)
      .ilike('notes', `%${t}%`)
      .limit(1)
      .maybeSingle();
    const row = hit.data as TaggedCustomer | null;
    if (row?.id) {
      tagged = row;
      break;
    }
  }
  if (tagged?.id) {
    if (
      String(tagged.customer_type || '').toLowerCase() !== ADVISOR_CRM_CUSTOMER_TYPE
    ) {
      await supabase
        .from('customers')
        .update({
          customer_type: ADVISOR_CRM_CUSTOMER_TYPE,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tagged.id)
        .eq('profile_id', opts.companyId);
    }
    return finishAdvisorCustomer(
      opts.companyId,
      {
        id: Number(tagged.id),
        name: String(tagged.trading_name || opts.name),
        email: tagged.email ? String(tagged.email) : email || null,
      },
      opts.skipPartyGl
    );
  }

  const payload: Record<string, unknown> = {
    profile_id: opts.companyId,
    trading_name: opts.name.trim() || 'Member',
    contact_name: opts.name.trim() || 'Member',
    email: email || null,
    phone,
    status: 'active',
    customer_type: ADVISOR_CRM_CUSTOMER_TYPE,
    source: 'advisor_member',
    currency: 'ZAR',
    notes: notesBlob,
    updated_at: new Date().toISOString(),
  };
  let { data, error } = await supabase
    .from('customers')
    .insert(payload)
    .select('id, trading_name, email')
    .maybeSingle();
  if (error && /column|schema cache/i.test(error.message || '')) {
    delete payload.customer_type;
    delete payload.source;
    delete payload.phone;
    const retry = await supabase
      .from('customers')
      .insert(payload)
      .select('id, trading_name, email')
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  } else if (error && /customer_type/i.test(error.message || '')) {
    payload.customer_type = ADVISOR_CRM_CUSTOMER_TYPE;
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
  return finishAdvisorCustomer(opts.companyId, {
    id: Number(data.id),
    name: String(data.trading_name || opts.name),
    email: data.email ? String(data.email) : email || null,
  }, opts.skipPartyGl);
}

async function finishAdvisorCustomer(
  companyId: number,
  customer: { id: number; name: string; email: string | null },
  _skipFullCoa?: boolean
): Promise<{
  id: number;
  name: string;
  email: string | null;
  ar_account_code: string | null;
}> {
  let ar_account_code: string | null = null;
  try {
    const { ensureMemberArLeaf, memberArAccountCode } = await import(
      '@/lib/accounting/party-gl-accounts'
    );
    const leaf = await ensureMemberArLeaf({
      profileId: companyId,
      customerId: customer.id,
      name: customer.name,
    });
    const code = leaf?.code || memberArAccountCode(customer.id) || null;
    ar_account_code = /^1180-\d+$/.test(String(code || ''))
      ? code
      : memberArAccountCode(customer.id) || null;
  } catch (err) {
    console.warn('[member-account] member AR leaf', err);
  }
  return { ...customer, ar_account_code };
}

/** Flip advisor people who landed as CRM businesses (default customer_type). */
export async function stampAdvisorCustomersAsIndividuals(
  companyId: number
): Promise<number> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('customers')
    .select('id, customer_type, source, notes')
    .eq('profile_id', companyId)
    .limit(2000);
  if (error || !data?.length) return 0;
  const ids = data
    .filter((row) => {
      const type = String(row.customer_type || 'business').trim().toLowerCase();
      if (type === ADVISOR_CRM_CUSTOMER_TYPE) return false;
      const source = String(row.source || '').trim().toLowerCase();
      const notes = String(row.notes || '');
      return (
        source === 'advisor_member' ||
        source.startsWith('advisor_') ||
        notes.includes('advisor_ref:')
      );
    })
    .map((row) => Number(row.id))
    .filter((id) => id > 0);
  if (!ids.length) return 0;
  const { error: upErr } = await supabase
    .from('customers')
    .update({
      customer_type: ADVISOR_CRM_CUSTOMER_TYPE,
      updated_at: new Date().toISOString(),
    })
    .eq('profile_id', companyId)
    .in('id', ids);
  if (upErr) {
    console.warn('[member-account] stamp individuals', upErr.message);
    return 0;
  }
  return ids.length;
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
  const vat = splitInclusiveVat(amount, SA_VAT_PCT);
  const invoiceNumber = docNumber('INV');
  const now = new Date().toISOString();
  const periodNote = `period:${now.slice(0, 7)}:member:${opts.charge.ref_id}`;
  const payload: Record<string, unknown> = {
    profile_id: opts.companyId,
    customer_id: opts.customerId,
    invoice_number: invoiceNumber,
    status: 'sent',
    currency: 'ZAR',
    subtotal: vat.exclusive,
    tax_rate: SA_VAT_PCT,
    tax_amount: vat.vat,
    total_amount: vat.inclusive,
    amount_paid: 0,
    customer_name: opts.customerName,
    contact_name: opts.customerName,
    contact_email: opts.customerEmail || null,
    notes: `Member account ${opts.charge.id} · ${opts.charge.kind}/${opts.charge.ref_id} · ${periodNote}`,
    items: [
      {
        name: opts.charge.description,
        quantity: 1,
        unit_price: vat.exclusive,
        line_total: vat.exclusive,
        uom: 'account',
        account_code: '4400',
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
  try {
    const glId = await postAdvisorFeeToGl({
      companyId: opts.companyId,
      customerId: opts.customerId,
      customerName: opts.customerName,
      customerEmail: opts.customerEmail || null,
      invoiceNumber,
      exclusive: vat.exclusive,
      vat: vat.vat,
      inclusive: vat.inclusive,
      description: opts.charge.description,
      notes: String(payload.notes || ''),
      dueDate: String(payload.due_date || now.slice(0, 10)),
    });
    if (glId) {
      const stamped = await supabase
        .from('customer_invoices')
        .update({
          metadata: { finance_invoice_id: glId, advisor_fee: true, membership: true },
        })
        .eq('id', data.id);
      if (stamped.error && /column|schema cache|metadata/i.test(stamped.error.message || '')) {
        /* CRM metadata optional */
      }
    }
  } catch (e) {
    console.warn('[member-account] GL invoice', e);
  }
  return {
    invoice_id: Number(data.id),
    invoice_number: String(data.invoice_number || invoiceNumber),
  };
}

async function postAdvisorFeeToGl(opts: {
  companyId: number;
  customerId: number;
  customerName: string;
  customerEmail: string | null;
  invoiceNumber: string;
  exclusive: number;
  vat: number;
  inclusive: number;
  description: string;
  notes: string;
  dueDate: string;
}): Promise<number | null> {
  const supabase = getSupabaseServer();
  const { data: existing } = await supabase
    .from('invoices')
    .select('id')
    .eq('profile_id', opts.companyId)
    .eq('invoice_number', opts.invoiceNumber)
    .maybeSingle();
  if (existing?.id) return Number(existing.id);
  const { data, error } = await supabase
    .from('invoices')
    .insert({
      profile_id: opts.companyId,
      direction: 'receivable',
      customer_id: opts.customerId,
      counterparty_name: opts.customerName,
      invoice_number: opts.invoiceNumber,
      status: 'sent',
      currency: 'ZAR',
      subtotal: opts.exclusive,
      tax_rate: SA_VAT_PCT,
      tax_amount: opts.vat,
      total_amount: opts.inclusive,
      amount_paid: 0,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: opts.dueDate,
      bill_to_email: opts.customerEmail,
      notes: opts.notes,
      items: [
        {
          name: opts.description,
          quantity: 1,
          unit_price: opts.exclusive,
          line_total: opts.exclusive,
          account_code: '4400',
        },
      ],
      metadata: { advisor_fee: true, membership: true, crm_invoice_number: opts.invoiceNumber },
    })
    .select('*')
    .maybeSingle();
  if (error || !data) return null;
  const { recognizeInvoiceIfNeeded } = await import('@/lib/accounting/invoice-gl');
  await recognizeInvoiceIfNeeded({
    profileId: opts.companyId,
    invoice: data as Record<string, unknown>,
  });
  return Number(data.id);
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
    .select('id, total_amount, amount_paid, status, currency, customer_id, invoice_number, metadata')
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
  try {
    const meta =
      inv.metadata && typeof inv.metadata === 'object'
        ? (inv.metadata as Record<string, unknown>)
        : {};
    let financeId = Number(meta.finance_invoice_id || 0);
    if (!financeId && inv.invoice_number) {
      const { data: twin } = await supabase
        .from('invoices')
        .select('*')
        .eq('profile_id', opts.companyId)
        .eq('invoice_number', String(inv.invoice_number))
        .maybeSingle();
      if (twin?.id) financeId = Number(twin.id);
      if (twin) {
        const { settleInvoicePayment } = await import(
          '@/lib/accounting/invoice-gl'
        );
        await settleInvoicePayment({
          profileId: opts.companyId,
          invoice: twin as Record<string, unknown>,
          paymentId: Date.now(),
          amount,
          paidAt: now,
          createdBy: opts.actorUserId || null,
        });
      }
    } else if (financeId) {
      const { data: twin } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', financeId)
        .eq('profile_id', opts.companyId)
        .maybeSingle();
      if (twin) {
        const { settleInvoicePayment } = await import(
          '@/lib/accounting/invoice-gl'
        );
        await settleInvoicePayment({
          profileId: opts.companyId,
          invoice: twin as Record<string, unknown>,
          paymentId: Date.now(),
          amount,
          paidAt: now,
          createdBy: opts.actorUserId || null,
        });
      }
    }
  } catch (e) {
    console.warn('[member-account] GL settle', e);
  }
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
