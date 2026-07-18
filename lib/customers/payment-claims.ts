/**
 * Buyer payment claims → seller confirm → AR ledger.
 */

import { getSupabaseServer } from '@/lib/supabase/server-client';
import { recordArPayment, sumLedgerPaid } from '@/lib/customers/ar-ledger';
import { convertAmount } from '@/lib/fx/types';

export type PaymentClaim = {
  id: number;
  seller_profile_id: number;
  buyer_profile_id: number;
  invoice_id: number;
  amount: number;
  currency: string;
  reference?: string | null;
  proof_url?: string | null;
  notes?: string | null;
  status: string;
  claimed_at?: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  ledger_payment_id?: number | null;
  created_by?: string | null;
  // joined soft fields
  invoice_number?: string | null;
  customer_name?: string | null;
  balance?: number | null;
};

export function isMissingClaimsTable(msg: string | undefined | null): boolean {
  return /relation|does not exist|schema cache|customer_payment_claims/i.test(
    msg || ''
  );
}

export async function createPaymentClaim(opts: {
  sellerProfileId: number;
  buyerProfileId: number;
  invoiceId: number;
  amount: number;
  currency?: string;
  reference?: string | null;
  proofUrl?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<
  | { ok: true; claim: PaymentClaim; tableMissing?: boolean }
  | { ok: false; error: string; status?: number; tableMissing?: boolean }
> {
  const supabase = getSupabaseServer();
  const amount = Number(opts.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'amount must be positive', status: 400 };
  }

  // Load invoice owned by seller
  const { data: inv, error: invErr } = await supabase
    .from('customer_invoices')
    .select(
      'id, profile_id, total_amount, amount_paid, status, currency, invoice_number, customer_name, visibility, shared_with_buyer'
    )
    .eq('id', opts.invoiceId)
    .eq('profile_id', opts.sellerProfileId)
    .maybeSingle();
  if (invErr || !inv) {
    return { ok: false, error: invErr?.message || 'Invoice not found', status: 404 };
  }
  const st = String(inv.status || '').toLowerCase();
  if (['paid', 'void', 'cancelled', 'draft'].includes(st)) {
    return {
      ok: false,
      error: `Invoice is ${st} — cannot claim payment`,
      status: 400,
    };
  }
  const balance = Math.max(
    0,
    Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)
  );
  if (amount > balance * 1.01 + 0.01) {
    return {
      ok: false,
      error: `Amount exceeds open balance (${balance})`,
      status: 400,
    };
  }

  // Block duplicate open claim
  try {
    const { data: existing } = await supabase
      .from('customer_payment_claims')
      .select('id')
      .eq('invoice_id', opts.invoiceId)
      .eq('buyer_profile_id', opts.buyerProfileId)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      return {
        ok: false,
        error: 'A pending payment claim already exists for this invoice',
        status: 409,
      };
    }
  } catch {
    /* soft */
  }

  const row = {
    seller_profile_id: opts.sellerProfileId,
    buyer_profile_id: opts.buyerProfileId,
    invoice_id: opts.invoiceId,
    amount,
    currency: String(opts.currency || inv.currency || 'ZAR'),
    reference: opts.reference || null,
    proof_url: opts.proofUrl || null,
    notes: opts.notes || null,
    status: 'pending',
    claimed_at: new Date().toISOString(),
    created_by: opts.createdBy || null,
  };

  const { data, error } = await supabase
    .from('customer_payment_claims')
    .insert(row)
    .select('*')
    .maybeSingle();

  if (error) {
    if (isMissingClaimsTable(error.message)) {
      // Soft fallback: activity_log only
      try {
        await supabase.from('activity_log').insert({
          profile_id: opts.sellerProfileId,
          actor_user_id: opts.createdBy || 'buyer',
          action: 'ar.payment_claim_pending',
          entity_type: 'customer_invoices',
          entity_id: String(opts.invoiceId),
          summary: `Buyer claimed payment of ${amount} ${row.currency}${
            opts.reference ? ` ref ${opts.reference}` : ''
          }`,
          metadata: {
            buyerProfileId: opts.buyerProfileId,
            amount,
            currency: row.currency,
            reference: opts.reference,
            proof_url: opts.proofUrl,
          },
        });
      } catch {
        /* soft */
      }
      return {
        ok: true,
        claim: {
          id: 0,
          ...row,
        } as PaymentClaim,
        tableMissing: true,
      };
    }
    return { ok: false, error: error.message, status: 500 };
  }

  try {
    await supabase.from('activity_log').insert({
      profile_id: opts.sellerProfileId,
      actor_user_id: opts.createdBy || 'buyer',
      action: 'ar.payment_claim_pending',
      entity_type: 'customer_payment_claims',
      entity_id: String(data!.id),
      summary: `Buyer claimed ${amount} ${row.currency} on inv ${
        inv.invoice_number || inv.id
      }`,
      metadata: {
        claimId: data!.id,
        invoiceId: opts.invoiceId,
        buyerProfileId: opts.buyerProfileId,
        amount,
        reference: opts.reference,
      },
    });
  } catch {
    /* soft */
  }

  // Soft email seller
  void import('@/lib/notifications/email-alerts')
    .then(({ notifyPaymentClaimToSeller }) =>
      notifyPaymentClaimToSeller({
        sellerProfileId: opts.sellerProfileId,
        buyerProfileId: opts.buyerProfileId,
        invoiceId: opts.invoiceId,
        invoiceNumber: inv.invoice_number
          ? String(inv.invoice_number)
          : null,
        amount,
        currency: row.currency,
        reference: opts.reference,
        proofUrl: opts.proofUrl,
      })
    )
    .catch(() => undefined);

  return {
    ok: true,
    claim: data as PaymentClaim,
  };
}

export async function listClaimsForSeller(
  sellerProfileId: number,
  opts?: { status?: string; limit?: number }
): Promise<{ claims: PaymentClaim[]; tableMissing: boolean }> {
  try {
    const supabase = getSupabaseServer();
    let q = supabase
      .from('customer_payment_claims')
      .select('*')
      .eq('seller_profile_id', sellerProfileId)
      .order('claimed_at', { ascending: false })
      .limit(opts?.limit || 50);
    if (opts?.status) q = q.eq('status', opts.status);
    const { data, error } = await q;
    if (error) {
      return {
        claims: [],
        tableMissing: isMissingClaimsTable(error.message),
      };
    }
    const claims = (data || []) as PaymentClaim[];
    // Enrich with invoice numbers
    const invIds = [...new Set(claims.map((c) => c.invoice_id))];
    if (invIds.length) {
      const { data: invs } = await supabase
        .from('customer_invoices')
        .select('id, invoice_number, customer_name, total_amount, amount_paid, currency')
        .eq('profile_id', sellerProfileId)
        .in('id', invIds);
      const map = new Map(
        (invs || []).map((i) => [Number(i.id), i as Record<string, unknown>])
      );
      for (const c of claims) {
        const inv = map.get(c.invoice_id);
        if (inv) {
          c.invoice_number = inv.invoice_number
            ? String(inv.invoice_number)
            : null;
          c.customer_name = inv.customer_name
            ? String(inv.customer_name)
            : null;
          c.balance = Math.max(
            0,
            Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)
          );
        }
      }
    }
    return { claims, tableMissing: false };
  } catch {
    return { claims: [], tableMissing: true };
  }
}

export async function resolvePaymentClaim(opts: {
  claimId: number;
  sellerProfileId: number;
  action: 'confirm' | 'reject';
  actorUserId: string;
  amountOverride?: number;
}): Promise<
  | {
      ok: true;
      claim: PaymentClaim;
      invoice?: Record<string, unknown> | null;
      ledgerId?: number | null;
    }
  | { ok: false; error: string; status?: number }
> {
  const supabase = getSupabaseServer();
  const { data: claim, error } = await supabase
    .from('customer_payment_claims')
    .select('*')
    .eq('id', opts.claimId)
    .eq('seller_profile_id', opts.sellerProfileId)
    .maybeSingle();
  if (error) {
    if (isMissingClaimsTable(error.message)) {
      return {
        ok: false,
        error: 'Payment claims table missing — run 20260717_payment_claims_and_ledger_fx.sql',
        status: 503,
      };
    }
    return { ok: false, error: error.message, status: 500 };
  }
  if (!claim) return { ok: false, error: 'Claim not found', status: 404 };
  if (String(claim.status) !== 'pending') {
    return {
      ok: false,
      error: `Claim already ${claim.status}`,
      status: 400,
    };
  }

  const now = new Date().toISOString();

  if (opts.action === 'reject') {
    const { data: updated, error: uErr } = await supabase
      .from('customer_payment_claims')
      .update({
        status: 'rejected',
        resolved_at: now,
        resolved_by: opts.actorUserId,
      })
      .eq('id', opts.claimId)
      .select('*')
      .maybeSingle();
    if (uErr) return { ok: false, error: uErr.message, status: 500 };
    try {
      await supabase.from('activity_log').insert({
        profile_id: opts.sellerProfileId,
        actor_user_id: opts.actorUserId,
        action: 'ar.payment_claim_rejected',
        entity_type: 'customer_payment_claims',
        entity_id: String(opts.claimId),
        summary: `Rejected payment claim #${opts.claimId}`,
      });
    } catch {
      /* soft */
    }
    void import('@/lib/notifications/email-alerts')
      .then(async ({ notifyPaymentClaimResolvedToBuyer }) => {
        let sellerName: string | null = null;
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('trading_name, legal_name')
            .eq('id', opts.sellerProfileId)
            .maybeSingle();
          sellerName = (prof?.trading_name ||
            prof?.legal_name ||
            null) as string | null;
        } catch {
          /* soft */
        }
        await notifyPaymentClaimResolvedToBuyer({
          buyerProfileId: Number(claim.buyer_profile_id),
          sellerProfileId: opts.sellerProfileId,
          sellerName,
          invoiceId: Number(claim.invoice_id),
          amount: Number(claim.amount),
          currency: claim.currency,
          outcome: 'rejected',
        });
      })
      .catch(() => undefined);
    return { ok: true, claim: updated as PaymentClaim };
  }

  // Confirm → ledger + invoice rollup
  const amount = Number(opts.amountOverride ?? claim.amount);
  const { data: inv } = await supabase
    .from('customer_invoices')
    .select('*')
    .eq('id', claim.invoice_id)
    .eq('profile_id', opts.sellerProfileId)
    .maybeSingle();
  if (!inv) return { ok: false, error: 'Invoice not found', status: 404 };

  // FX into company base when possible
  let amountBase: number | null = null;
  let baseCurrency: string | null = null;
  let fxRate: number | null = null;
  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('primary_currency')
      .eq('id', opts.sellerProfileId)
      .maybeSingle();
    baseCurrency = String(prof?.primary_currency || 'ZAR').toUpperCase();
    const payCcy = String(claim.currency || inv.currency || 'ZAR').toUpperCase();
    if (baseCurrency === payCcy) {
      amountBase = amount;
      fxRate = 1;
    } else {
      const fx = await loadUsdRates();
      if (fx) {
        const converted = convertAmount(amount, payCcy, baseCurrency, fx);
        if (converted != null) {
          amountBase = Math.round(converted * 100) / 100;
          const one = convertAmount(1, payCcy, baseCurrency, fx);
          fxRate = one != null ? Math.round(one * 1e8) / 1e8 : null;
        }
      }
    }
  } catch {
    /* soft */
  }

  const ledger = await recordArPayment({
    profile_id: opts.sellerProfileId,
    invoice_id: Number(claim.invoice_id),
    customer_id: inv.customer_id ? Number(inv.customer_id) : null,
    amount,
    currency: String(claim.currency || inv.currency || 'ZAR'),
    paid_at: now,
    method: 'buyer_claim',
    reference: claim.reference || null,
    proof_url: claim.proof_url || null,
    notes: claim.notes
      ? `Buyer claim #${claim.id}: ${claim.notes}`
      : `Buyer claim #${claim.id} confirmed`,
    created_by: opts.actorUserId,
    amount_base: amountBase,
    base_currency: baseCurrency,
    fx_rate: fxRate,
    fx_as_of: now.slice(0, 10),
  });

  if (!ledger.ok) {
    return { ok: false, error: ledger.error, status: 500 };
  }

  // Rollup amount_paid
  let nextPaid = Number(inv.amount_paid || 0) + amount;
  const sum = await sumLedgerPaid(opts.sellerProfileId, Number(claim.invoice_id));
  if (sum.total != null && !sum.tableMissing) nextPaid = sum.total;
  const total = Number(inv.total_amount || 0);
  const eps = Math.max(0.01, total * 0.001);
  const fullyPaid = total <= 0 ? nextPaid > 0 : nextPaid >= total - eps;
  const nextStatus = fullyPaid
    ? 'paid'
    : nextPaid > 0
      ? 'partial'
      : String(inv.status || 'sent');

  const updatePayload: Record<string, unknown> = {
    amount_paid: nextPaid,
    status: nextStatus,
    paid_at: fullyPaid ? now : inv.paid_at || null,
    updated_at: now,
  };
  if (claim.reference) updatePayload.payment_reference = claim.reference;
  if (fullyPaid) updatePayload.promise_to_pay_date = null;

  let { data: updatedInv, error: invUpdErr } = await supabase
    .from('customer_invoices')
    .update(updatePayload)
    .eq('id', claim.invoice_id)
    .select('*')
    .maybeSingle();
  if (
    invUpdErr &&
    /payment_reference|promise_to_pay|column|schema cache/i.test(
      invUpdErr.message || ''
    )
  ) {
    delete updatePayload.payment_reference;
    delete updatePayload.promise_to_pay_date;
    const retry = await supabase
      .from('customer_invoices')
      .update(updatePayload)
      .eq('id', claim.invoice_id)
      .select('*')
      .maybeSingle();
    updatedInv = retry.data;
    invUpdErr = retry.error;
  }
  if (invUpdErr) {
    return { ok: false, error: invUpdErr.message, status: 500 };
  }

  const ledgerId = ledger.entry?.id ?? null;
  const { data: updatedClaim, error: cErr } = await supabase
    .from('customer_payment_claims')
    .update({
      status: 'confirmed',
      resolved_at: now,
      resolved_by: opts.actorUserId,
      ledger_payment_id: ledgerId,
      amount,
    })
    .eq('id', opts.claimId)
    .select('*')
    .maybeSingle();
  if (cErr) return { ok: false, error: cErr.message, status: 500 };

  try {
    await supabase.from('activity_log').insert({
      profile_id: opts.sellerProfileId,
      actor_user_id: opts.actorUserId,
      action: 'ar.payment_claim_confirmed',
      entity_type: 'customer_payment_claims',
      entity_id: String(opts.claimId),
      summary: `Confirmed buyer payment ${amount} → ledger on inv ${
        inv.invoice_number || inv.id
      }`,
      metadata: {
        claimId: opts.claimId,
        ledgerId,
        amount,
        nextStatus,
        amount_base: amountBase,
        base_currency: baseCurrency,
        fx_rate: fxRate,
      },
    });
  } catch {
    /* soft */
  }

  void import('@/lib/notifications/email-alerts')
    .then(async ({ notifyPaymentClaimResolvedToBuyer }) => {
      let sellerName: string | null = null;
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('trading_name, legal_name')
          .eq('id', opts.sellerProfileId)
          .maybeSingle();
        sellerName =
          (prof?.trading_name || prof?.legal_name || null) as string | null;
      } catch {
        /* soft */
      }
      await notifyPaymentClaimResolvedToBuyer({
        buyerProfileId: Number(claim.buyer_profile_id),
        sellerProfileId: opts.sellerProfileId,
        sellerName,
        invoiceId: Number(claim.invoice_id),
        invoiceNumber: inv.invoice_number
          ? String(inv.invoice_number)
          : null,
        amount,
        currency: String(claim.currency || inv.currency || 'ZAR'),
        outcome: 'confirmed',
      });
    })
    .catch(() => undefined);

  // Soft: create rating prompts both ways after settle
  try {
    if (claim.buyer_profile_id) {
      const { promptAfterInvoicePaid } = await import(
        '@/lib/ratings/create-prompt'
      );
      await promptAfterInvoicePaid({
        sellerProfileId: opts.sellerProfileId,
        customerLinkedProfileId: Number(claim.buyer_profile_id),
        customerName: inv.customer_name
          ? String(inv.customer_name)
          : null,
        invoiceId: Number(claim.invoice_id),
        userId: opts.actorUserId,
      });
    }
  } catch {
    /* soft */
  }

  // Trust moves on settle
  try {
    const { bumpTrustOnSettle } = await import(
      '@/lib/customers/trust-from-settle'
    );
    await bumpTrustOnSettle({
      sellerProfileId: opts.sellerProfileId,
      buyerProfileId: claim.buyer_profile_id
        ? Number(claim.buyer_profile_id)
        : null,
      delta: 1.5,
      reason: `claim #${opts.claimId} confirmed`,
    });
  } catch {
    /* soft */
  }

  return {
    ok: true,
    claim: updatedClaim as PaymentClaim,
    invoice: updatedInv as Record<string, unknown>,
    ledgerId,
  };
}

async function loadUsdRates(): Promise<Record<string, number> | null> {
  try {
    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL ||
      'https://www.supplieradvisor.com';
    const url = base.startsWith('http')
      ? `${base}/api/fx/rates?base=USD`
      : `https://${base}/api/fx/rates?base=USD`;
    // Prefer frankfurter directly to avoid self-HTTP in serverless cold path
    const res = await fetch(
      'https://api.frankfurter.dev/v1/latest?base=USD',
      { next: { revalidate: 900 } }
    );
    if (!res.ok) {
      // static fallback
      return {
        USD: 1,
        ZAR: 18.5,
        EUR: 0.92,
        GBP: 0.79,
        KES: 129,
        NAD: 18.5,
        BWP: 13.6,
        NGN: 1550,
        AED: 3.67,
        CNY: 7.25,
      };
    }
    const data = (await res.json()) as { rates?: Record<string, number> };
    const rates: Record<string, number> = { USD: 1 };
    for (const [k, v] of Object.entries(data.rates || {})) {
      rates[k.toUpperCase()] = Number(v);
    }
    void url;
    return rates;
  } catch {
    return {
      USD: 1,
      ZAR: 18.5,
      EUR: 0.92,
      GBP: 0.79,
    };
  }
}
