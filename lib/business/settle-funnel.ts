/**
 * Settle funnel metrics for a company (activity_log + soft table counts).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';

export type SettleFunnelSnapshot = {
  companyId: number;
  invoicesSent30d: number;
  claimsPending: number;
  claimsConfirmed30d: number;
  claimsRejected30d: number;
  ledgerPayments30d: number;
  ratingsAfterSettle30d: number;
  openAr: number;
  overdueInvoices: number;
  stages: Array<{ id: string; label: string; count: number }>;
  at: string;
};

export async function loadSettleFunnel(
  companyId: number
): Promise<SettleFunnelSnapshot> {
  const supabase = getSupabaseServer();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();

  async function countLog(actions: string[]): Promise<number> {
    try {
      const { count } = await supabase
        .from('activity_log')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId)
        .in('action', actions)
        .gte('created_at', since);
      return count ?? 0;
    } catch {
      return 0;
    }
  }

  const invoicesSent30d = await countLog([
    'invoice.sent',
    'onboarding.first_trade_sent',
    'customer.invoice_sent',
  ]);
  const claimsConfirmed30d = await countLog(['ar.payment_claim_confirmed']);
  const claimsRejected30d = await countLog(['ar.payment_claim_rejected']);
  const ratingsAfterSettle30d = await countLog([
    'rating.published',
    'company_rating.created',
  ]);

  let claimsPending = 0;
  try {
    const { count } = await supabase
      .from('customer_payment_claims')
      .select('id', { count: 'exact', head: true })
      .eq('seller_profile_id', companyId)
      .eq('status', 'pending');
    claimsPending = count ?? 0;
  } catch {
    claimsPending = 0;
  }

  let ledgerPayments30d = 0;
  try {
    const { count } = await supabase
      .from('customer_invoice_payments')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId)
      .gte('paid_at', since);
    ledgerPayments30d = count ?? 0;
  } catch {
    ledgerPayments30d = 0;
  }

  let openAr = 0;
  let overdueInvoices = 0;
  try {
    const { loadSellerMoneyHub } = await import('@/lib/customers/money-hub');
    const hub = await loadSellerMoneyHub(companyId);
    openAr = hub.openAr;
    overdueInvoices = hub.overdueCount;
  } catch {
    /* soft */
  }

  const stages = [
    { id: 'sent', label: 'Invoices sent (30d)', count: invoicesSent30d },
    { id: 'claims_pending', label: 'Claims pending', count: claimsPending },
    {
      id: 'claims_confirmed',
      label: 'Claims confirmed (30d)',
      count: claimsConfirmed30d,
    },
    {
      id: 'ledger',
      label: 'Ledger payments (30d)',
      count: ledgerPayments30d,
    },
    {
      id: 'rated',
      label: 'Ratings (30d)',
      count: ratingsAfterSettle30d,
    },
  ];

  return {
    companyId,
    invoicesSent30d,
    claimsPending,
    claimsConfirmed30d,
    claimsRejected30d,
    ledgerPayments30d,
    ratingsAfterSettle30d,
    openAr,
    overdueInvoices,
    stages,
    at: new Date().toISOString(),
  };
}
