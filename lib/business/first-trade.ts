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
  };
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
  try {
    const { count } = await supabase
      .from('customer_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId)
      .in('status', ['paid', 'partial']);
    hasPaid = (count || 0) > 0;
  } catch {
    hasPaid = false;
  }

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
      href: '/dashboard/customers/invoices?new=1',
      cta: 'New invoice',
      done: hasDoc,
      minutes: 10,
    },
    {
      id: 'send',
      title: 'Send the document',
      body: 'Email or WhatsApp PDF so the buyer sees it outside the platform.',
      href: '/dashboard/customers/invoices',
      cta: 'Open invoices',
      done: hasSent,
      minutes: 5,
    },
    {
      id: 'collect_or_rate',
      title: 'Mark paid or rate partner',
      body: 'Close the money loop or leave a peer star after delivery.',
      href: '/dashboard/customers/ar',
      cta: 'AR & collections',
      done: hasPaid,
      minutes: 10,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const progressPercent = Math.round((doneCount / steps.length) * 100);
  const nextStep = steps.find((s) => !s.done) || null;

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
    },
    bootstrapReady: !hasCustomer || !hasDoc,
    at: new Date().toISOString(),
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
