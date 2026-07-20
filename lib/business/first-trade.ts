/**
 * 30-minute first-trade golden path orchestration.
 * Steps: customer → document → send → (optional) collect/rate.
 */

import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getPartnerCount } from '@/lib/onboarding/checklist';

export const FIRST_TRADE_TARGET_MINUTES = 30;

export type FirstTradeStepId =
  | 'customer'
  | 'document'
  | 'send'
  | 'collect_or_rate';

export type FirstTradeStep = {
  id: FirstTradeStepId;
  title: string;
  body: string;
  href: string;
  cta: string;
  done: boolean;
  minutes: number;
};

export type FirstTradePlan = {
  companyId: number;
  targetMinutes: number;
  steps: FirstTradeStep[];
  progressPercent: number;
  nextStep: FirstTradeStep | null;
  complete: boolean;
  signals: {
    customerCount: number;
    partnerCount: number;
    quoteCount: number;
    invoiceCount: number;
    sentInvoiceCount: number;
    poCount: number;
    paidInvoiceCount: number;
    rated: boolean;
  };
  /** Latest draft or open starter invoice for one-click send */
  activeInvoiceId: number | null;
  activeInvoiceNumber: string | null;
  activeInvoiceStatus: string | null;
  /** One-line coaching for UI */
  finishHint: string | null;
  bootstrapReady: boolean;
  at: string;
};

export async function loadFirstTradePlan(
  companyId: number
): Promise<FirstTradePlan> {
  const supabase = getSupabaseServer();
  const [
    customers,
    quotes,
    invoices,
    sentInv,
    pos,
    partnerCount,
  ] = await Promise.all([
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId),
    supabase
      .from('customer_quotes')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId),
    supabase
      .from('customer_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId),
    supabase
      .from('customer_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId)
      .in('status', ['sent', 'viewed', 'partial', 'paid', 'overdue']),
    supabase
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true })
      .or(`buyer_profile_id.eq.${companyId},seller_profile_id.eq.${companyId}`),
    getPartnerCount(companyId),
  ]);

  const customerCount = customers.count ?? 0;
  const quoteCount = quotes.count ?? 0;
  const invoiceCount = invoices.count ?? 0;
  const sentInvoiceCount = sentInv.count ?? 0;
  const poCount = pos.count ?? 0;
  const hasDoc = quoteCount + invoiceCount + poCount > 0;
  const hasCustomer = customerCount > 0 || partnerCount > 0;
  const hasSent = sentInvoiceCount > 0;
  // collect/rate: any paid invoice or any rating later — mark done when paid exists
  let hasPaid = false;
  let paidInvoiceCount = 0;
  try {
    const { count } = await supabase
      .from('customer_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId)
      .in('status', ['paid', 'partial']);
    paidInvoiceCount = count || 0;
    hasPaid = paidInvoiceCount > 0;
  } catch {
    hasPaid = false;
  }

  let rated = false;
  try {
    const { count } = await supabase
      .from('company_ratings')
      .select('id', { count: 'exact', head: true })
      .eq('rater_profile_id', companyId)
      .eq('status', 'published');
    rated = (count || 0) > 0;
  } catch {
    rated = false;
  }

  // Active invoice for one-click send / collect
  let activeInvoiceId: number | null = null;
  let activeInvoiceNumber: string | null = null;
  let activeInvoiceStatus: string | null = null;
  try {
    const { data: draft } = await supabase
      .from('customer_invoices')
      .select('id, invoice_number, status')
      .eq('profile_id', companyId)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (draft?.id) {
      activeInvoiceId = Number(draft.id);
      activeInvoiceNumber = draft.invoice_number
        ? String(draft.invoice_number)
        : null;
      activeInvoiceStatus = 'draft';
    } else {
      const { data: open } = await supabase
        .from('customer_invoices')
        .select('id, invoice_number, status')
        .eq('profile_id', companyId)
        .in('status', ['sent', 'viewed', 'partial', 'overdue'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (open?.id) {
        activeInvoiceId = Number(open.id);
        activeInvoiceNumber = open.invoice_number
          ? String(open.invoice_number)
          : null;
        activeInvoiceStatus = String(open.status || '');
      }
    }
  } catch {
    /* soft */
  }

  const collectDone = hasPaid || rated;

  const steps: FirstTradeStep[] = [
    {
      id: 'customer',
      title: 'Add a customer (or partner)',
      body: 'One buyer in your book — name + email is enough to bill.',
      href: '/dashboard/customers',
      cta: 'Add customer',
      done: hasCustomer,
      minutes: 5,
    },
    {
      id: 'document',
      title: 'Create quote, PO, or invoice',
      body: 'Draft a commercial document for that customer.',
      href: activeInvoiceId
        ? `/dashboard/customers/invoices?id=${activeInvoiceId}`
        : '/dashboard/customers/invoices?new=1',
      cta: 'New invoice',
      done: hasDoc,
      minutes: 10,
    },
    {
      id: 'send',
      title: 'Send the document',
      body: 'Mark sent and email/WhatsApp PDF so the buyer sees it.',
      href: activeInvoiceId
        ? `/dashboard/customers/invoices?id=${activeInvoiceId}`
        : '/dashboard/customers/invoices',
      cta: 'Open invoices',
      done: hasSent,
      minutes: 5,
    },
    {
      id: 'collect_or_rate',
      title: 'Collect payment or rate partner',
      body: 'Confirm buyer claims on Money hub (or mark paid), then rate — trust loop closes.',
      href: hasPaid
        ? '/dashboard?ratePrompt=open'
        : '/dashboard/customers/money',
      cta: hasPaid ? 'Rate partner' : 'Open Money hub',
      done: collectDone,
      minutes: 10,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const progressPercent = Math.round((doneCount / steps.length) * 100);
  const nextStep = steps.find((s) => !s.done) || null;

  let finishHint: string | null = null;
  if (!hasCustomer) finishHint = 'Add a customer, or use Start for me.';
  else if (!hasDoc) finishHint = 'Create a draft invoice, or use Start for me.';
  else if (!hasSent)
    finishHint = activeInvoiceId
      ? 'Send your draft invoice (one click below).'
      : 'Open invoices and send a document.';
  else if (!hasPaid)
    finishHint =
      'Open Money hub — confirm a buyer claim or mark paid to close settle.';
  else if (!rated)
    finishHint =
      'Rate your partner, then invite the next company — trust + density.';
  else finishHint = 'First trade loop complete — invite the next partner.';

  return {
    companyId,
    targetMinutes: FIRST_TRADE_TARGET_MINUTES,
    steps,
    progressPercent,
    nextStep,
    complete: doneCount === steps.length,
    signals: {
      customerCount,
      partnerCount,
      quoteCount,
      invoiceCount,
      sentInvoiceCount,
      poCount,
      paidInvoiceCount,
      rated,
    },
    activeInvoiceId,
    activeInvoiceNumber,
    activeInvoiceStatus,
    finishHint,
    bootstrapReady: !hasCustomer || !hasDoc,
    at: new Date().toISOString(),
  };
}

/**
 * Mark draft invoice as sent (share path). Soft email if Resend + contact.
 */
export async function sendFirstTradeInvoice(opts: {
  companyId: number;
  actorUserId: string;
  invoiceId?: number | null;
}): Promise<{
  ok: boolean;
  invoiceId: number | null;
  emailed: boolean;
  message: string;
  error?: string;
}> {
  const supabase = getSupabaseServer();
  let invoiceId = opts.invoiceId ? Number(opts.invoiceId) : null;
  if (!invoiceId) {
    const plan = await loadFirstTradePlan(opts.companyId);
    invoiceId = plan.activeInvoiceId;
  }
  if (!invoiceId) {
    return {
      ok: false,
      invoiceId: null,
      emailed: false,
      message: 'No draft invoice — run Start for me first',
      error: 'no_invoice',
    };
  }

  const { data: inv, error } = await supabase
    .from('customer_invoices')
    .select(
      'id, status, invoice_number, contact_email, customer_name, total_amount, currency, visibility, shared_with_buyer'
    )
    .eq('id', invoiceId)
    .eq('profile_id', opts.companyId)
    .maybeSingle();
  if (error || !inv) {
    return {
      ok: false,
      invoiceId,
      emailed: false,
      message: error?.message || 'Invoice not found',
      error: 'not_found',
    };
  }

  const now = new Date().toISOString();
  const st = String(inv.status || '').toLowerCase();
  const nextStatus = ['draft', ''].includes(st) ? 'sent' : st;
  const updatePayload: Record<string, unknown> = {
    status: nextStatus,
    updated_at: now,
    visibility: 'shared',
    shared_with_buyer: true,
  };
  let { error: uErr } = await supabase
    .from('customer_invoices')
    .update(updatePayload)
    .eq('id', invoiceId);
  if (uErr && /visibility|shared_with_buyer|column|schema cache/i.test(uErr.message || '')) {
    const retry = await supabase
      .from('customer_invoices')
      .update({ status: nextStatus, updated_at: now })
      .eq('id', invoiceId);
    uErr = retry.error;
  }
  if (uErr) {
    return {
      ok: false,
      invoiceId,
      emailed: false,
      message: uErr.message,
      error: 'update_failed',
    };
  }

  // Share reliability checklist (visibility + buyer notify when linked)
  try {
    const { ensureInvoiceSharedForBuyer } = await import(
      '@/lib/customers/share-checklist'
    );
    await ensureInvoiceSharedForBuyer({
      companyId: opts.companyId,
      invoiceId,
      actorUserId: opts.actorUserId,
    });
  } catch {
    /* soft */
  }

  let emailed = false;
  const to = String(inv.contact_email || '').trim();
  if (to.includes('@') && process.env.RESEND_API_KEY) {
    try {
      const { getResend, getResendFrom } = await import('@/lib/resend');
      const resend = getResend();
      const num = inv.invoice_number || `#${invoiceId}`;
      await resend.emails.send({
        from: getResendFrom(),
        to: [to],
        subject: `Invoice ${num} from SupplierAdvisor`,
        html: `<p>Hello${inv.customer_name ? ` ${inv.customer_name}` : ''},</p>
          <p>Invoice <strong>${num}</strong> is ready
          (${inv.currency || 'ZAR'} ${Number(inv.total_amount || 0).toLocaleString()}).</p>
          <p>View shared documents in your SupplierAdvisor buyer workspace when connected.</p>`,
      });
      emailed = true;
    } catch {
      emailed = false;
    }
  }

  try {
    await supabase.from('activity_log').insert({
      profile_id: opts.companyId,
      actor_user_id: opts.actorUserId,
      action: 'onboarding.first_trade_sent',
      entity_type: 'customer_invoices',
      entity_id: String(invoiceId),
      summary: `First-trade send: inv ${inv.invoice_number || invoiceId}${
        emailed ? ' · emailed' : ''
      }`,
    });
  } catch {
    /* soft */
  }

  try {
    const { markOnboardingSteps } = await import('@/lib/onboarding/checklist');
    await markOnboardingSteps(opts.companyId, 'first_trade');
  } catch {
    /* soft */
  }

  return {
    ok: true,
    invoiceId,
    emailed,
    message: emailed
      ? 'Invoice marked sent and emailed to contact'
      : to.includes('@')
        ? 'Invoice marked sent (email soft-failed — open Invoices to resend)'
        : 'Invoice marked sent — add contact email to auto-email next time',
  };
}

/**
 * One-click bootstrap: ensure a sample customer + draft invoice exist.
 * Idempotent for the “First trade starter” customer name.
 */
export async function bootstrapFirstTrade(opts: {
  companyId: number;
  actorUserId: string;
  customerName?: string;
  customerEmail?: string;
  amount?: number;
  currency?: string;
}): Promise<{
  customerId: number | null;
  invoiceId: number | null;
  createdCustomer: boolean;
  createdInvoice: boolean;
  message: string;
}> {
  const supabase = getSupabaseServer();
  const name = (opts.customerName || 'First trade customer').trim().slice(0, 120);
  const email = (opts.customerEmail || '').trim().toLowerCase() || null;
  const amount = Number(opts.amount ?? 1000);
  const currency = (opts.currency || 'ZAR').toUpperCase().slice(0, 8);

  let customerId: number | null = null;
  let createdCustomer = false;

  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', opts.companyId)
    .ilike('name', name)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    customerId = Number(existing.id);
  } else {
    const { data: created, error } = await supabase
      .from('customers')
      .insert({
        profile_id: opts.companyId,
        name,
        email,
        status: 'active',
        created_by: opts.actorUserId,
      })
      .select('id')
      .maybeSingle();
    if (error) {
      // try alternate column set
      const retry = await supabase
        .from('customers')
        .insert({
          profile_id: opts.companyId,
          name,
          email,
        })
        .select('id')
        .maybeSingle();
      if (retry.error || !retry.data) {
        return {
          customerId: null,
          invoiceId: null,
          createdCustomer: false,
          createdInvoice: false,
          message: error.message || retry.error?.message || 'Customer create failed',
        };
      }
      customerId = Number(retry.data.id);
      createdCustomer = true;
    } else {
      customerId = Number(created!.id);
      createdCustomer = true;
    }
  }

  // Existing draft starter invoice?
  const { data: existingInv } = await supabase
    .from('customer_invoices')
    .select('id')
    .eq('profile_id', opts.companyId)
    .eq('status', 'draft')
    .ilike('customer_name', name)
    .limit(1)
    .maybeSingle();

  if (existingInv?.id) {
    return {
      customerId,
      invoiceId: Number(existingInv.id),
      createdCustomer,
      createdInvoice: false,
      message: 'Draft invoice already ready — open and send.',
    };
  }

  const now = new Date();
  const invNumber = `FT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(opts.companyId).slice(-4)}`;
  const taxRate = 15;
  const subtotal = amount;
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  const payload: Record<string, unknown> = {
    profile_id: opts.companyId,
    customer_id: customerId,
    invoice_number: invNumber,
    status: 'draft',
    currency,
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total_amount: total,
    amount_paid: 0,
    issue_date: now.toISOString().slice(0, 10),
    due_date: new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10),
    customer_name: name,
    contact_email: email,
    notes: 'Starter draft from 30-min first-trade path — edit items then send.',
    items: [
      {
        description: 'Starter line item (edit me)',
        quantity: 1,
        unit_price: subtotal,
        amount: subtotal,
      },
    ],
    created_by: opts.actorUserId,
  };

  const { data: inv, error: invErr } = await supabase
    .from('customer_invoices')
    .insert(payload)
    .select('id')
    .maybeSingle();

  if (invErr || !inv) {
    return {
      customerId,
      invoiceId: null,
      createdCustomer,
      createdInvoice: false,
      message: invErr?.message || 'Invoice create failed',
    };
  }

  try {
    await supabase.from('activity_log').insert({
      profile_id: opts.companyId,
      actor_user_id: opts.actorUserId,
      action: 'onboarding.first_trade_bootstrap',
      entity_type: 'customer_invoices',
      entity_id: String(inv.id),
      summary: `First-trade bootstrap: customer + draft invoice ${invNumber}`,
      metadata: { customerId, invoiceId: inv.id },
    });
  } catch {
    /* soft */
  }

  return {
    customerId,
    invoiceId: Number(inv.id),
    createdCustomer,
    createdInvoice: true,
    message: 'Customer + draft invoice ready — review and send.',
  };
}
