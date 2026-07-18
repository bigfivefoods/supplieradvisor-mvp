/**
 * Company-level "inevitable path" next action for post-login / home.
 * Prefer settle/money when claims or overdue AR exist.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  computeHubNextAction,
  type TradeNextAction,
} from '@/lib/connections/next-action';
import { listClaimsForSeller } from '@/lib/customers/payment-claims';

export async function loadInevitableNextAction(
  companyId: number
): Promise<TradeNextAction & { signals: Record<string, number | boolean> }> {
  const supabase = getSupabaseServer();
  const today = new Date().toISOString().slice(0, 10);

  const [
    profileRes,
    pendingConn,
    overdueInv,
    draftInv,
    inboundPo,
    ratingPrompts,
    claims,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('verification_status, verification_payment_ref, metadata')
      .eq('id', companyId)
      .maybeSingle(),
    supabase
      .from('business_connections')
      .select('id', { count: 'exact', head: true })
      .eq('requestee_profile_id', companyId)
      .eq('status', 'pending'),
    supabase
      .from('customer_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId)
      .eq('status', 'overdue'),
    supabase
      .from('customer_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId)
      .eq('status', 'draft'),
    supabase
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true })
      .eq('seller_profile_id', companyId)
      .in('status', ['sent', 'accepted', 'funded']),
    supabase
      .from('rating_prompts')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId)
      .eq('status', 'pending'),
    listClaimsForSeller(companyId, { status: 'pending', limit: 50 }),
  ]);

  let brokenPromises = 0;
  try {
    const { data: invs } = await supabase
      .from('customer_invoices')
      .select('id, promise_to_pay_date, total_amount, amount_paid, status')
      .eq('profile_id', companyId)
      .in('status', ['sent', 'partial', 'overdue', 'viewed'])
      .not('promise_to_pay_date', 'is', null)
      .limit(100);
    for (const inv of invs || []) {
      const ptp = String(inv.promise_to_pay_date || '').slice(0, 10);
      const bal =
        Number(inv.total_amount || 0) - Number(inv.amount_paid || 0);
      if (ptp && ptp < today && bal > 0.01) brokenPromises += 1;
    }
  } catch {
    brokenPromises = 0;
  }

  const prof = profileRes.data as Record<string, unknown> | null;
  const st = String(prof?.verification_status || '').toLowerCase();
  const payRef = String(prof?.verification_payment_ref || '').trim();
  const meta =
    prof?.metadata && typeof prof.metadata === 'object'
      ? (prof.metadata as Record<string, unknown>)
      : {};
  const v =
    meta.verification && typeof meta.verification === 'object'
      ? (meta.verification as Record<string, unknown>)
      : {};
  const paidNotVerified =
    st !== 'verified' &&
    Boolean(payRef || v.paystack_reference || v.paystackReference);

  const slaHours = Number(process.env.CLAIM_SLA_HOURS || 24);
  let slaClaims = 0;
  for (const c of claims.claims) {
    const claimed = c.claimed_at ? Date.parse(String(c.claimed_at)) : NaN;
    if (
      Number.isFinite(claimed) &&
      (Date.now() - claimed) / 3600000 >= slaHours
    ) {
      slaClaims += 1;
    }
  }

  const action = computeHubNextAction({
    role: 'main',
    pendingConnections: pendingConn.count ?? 0,
    overdueInvoices: overdueInv.count ?? 0,
    draftInvoices: draftInv.count ?? 0,
    openInboundPos: inboundPo.count ?? 0,
    invoiceableInboundPos: 0,
    pendingPaymentClaims: claims.claims.length,
    slaClaims,
    ratingsDue: ratingPrompts.count ?? 0,
    brokenPromises,
    verificationStatus: st,
    paidNotVerified,
  });

  return {
    ...action,
    signals: {
      pendingClaims: claims.claims.length,
      slaClaims,
      overdueInvoices: overdueInv.count ?? 0,
      ratingsDue: ratingPrompts.count ?? 0,
      brokenPromises,
      pendingConnections: pendingConn.count ?? 0,
      paidNotVerified,
    },
  };
}
