/**
 * Company-level activation funnel: invite → accept → first invoice → paid → rate.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';

export type ActivationFunnel = {
  companyId: number;
  invitesSent: number;
  invitesOpened: number;
  invitesAccepted: number;
  connectionsAccepted: number;
  firstTradeBootstrap: number;
  firstTradeSent: number;
  invoicesCreated: number;
  invoicesPaidOrPartial: number;
  claimsConfirmed: number;
  ratingsPublished: number;
  stages: Array<{ id: string; label: string; count: number; pct: number | null }>;
  at: string;
};

export async function loadCompanyActivationFunnel(
  companyId: number
): Promise<ActivationFunnel> {
  const supabase = getSupabaseServer();

  const countLog = async (actions: string[]) => {
    const { count } = await supabase
      .from('activity_log')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId)
      .in('action', actions);
    return count ?? 0;
  };

  const invitesSent = await countLog([
    'network.invite_sent',
    'directory.invite_sent',
    'directory.invite_resent',
  ]);
  const invitesOpened = await countLog(['network.invite_opened']);
  const invitesAccepted = await countLog(['network.invite_accepted']);
  const connectionsAccepted = await countLog([
    'network.connection_accepted',
    'network.accept',
    'network.connect',
  ]);
  const firstTradeBootstrap = await countLog([
    'onboarding.first_trade_bootstrap',
  ]);
  const firstTradeSent = await countLog(['onboarding.first_trade_sent']);
  const claimsConfirmed = await countLog(['ar.payment_claim_confirmed']);

  let invoicesCreated = 0;
  let invoicesPaidOrPartial = 0;
  try {
    const { count: c1 } = await supabase
      .from('customer_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId);
    invoicesCreated = c1 ?? 0;
    const { count: c2 } = await supabase
      .from('customer_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId)
      .in('status', ['paid', 'partial']);
    invoicesPaidOrPartial = c2 ?? 0;
  } catch {
    /* soft */
  }

  let ratingsPublished = 0;
  try {
    const { count } = await supabase
      .from('company_ratings')
      .select('id', { count: 'exact', head: true })
      .eq('rater_profile_id', companyId)
      .eq('status', 'published');
    ratingsPublished = count ?? 0;
  } catch {
    /* soft */
  }

  const pct = (n: number, d: number) =>
    d > 0 ? Math.round((n / d) * 1000) / 10 : null;

  const stages = [
    {
      id: 'invite',
      label: 'Invites sent',
      count: invitesSent,
      pct: null as number | null,
    },
    {
      id: 'opened',
      label: 'Invites opened',
      count: invitesOpened,
      pct: pct(invitesOpened, invitesSent),
    },
    {
      id: 'accepted',
      label: 'Invite/connection accepted',
      count: Math.max(invitesAccepted, connectionsAccepted),
      pct: pct(
        Math.max(invitesAccepted, connectionsAccepted),
        Math.max(invitesSent, 1)
      ),
    },
    {
      id: 'invoice',
      label: 'Invoices created',
      count: invoicesCreated,
      pct: pct(invoicesCreated, Math.max(connectionsAccepted, 1)),
    },
    {
      id: 'sent',
      label: 'First-trade sent',
      count: firstTradeSent || firstTradeBootstrap,
      pct: pct(
        firstTradeSent || firstTradeBootstrap,
        Math.max(invoicesCreated, 1)
      ),
    },
    {
      id: 'paid',
      label: 'Paid / partial',
      count: invoicesPaidOrPartial + claimsConfirmed,
      pct: pct(
        invoicesPaidOrPartial + claimsConfirmed,
        Math.max(invoicesCreated, 1)
      ),
    },
    {
      id: 'rate',
      label: 'Ratings published',
      count: ratingsPublished,
      pct: pct(ratingsPublished, Math.max(invoicesPaidOrPartial, 1)),
    },
  ];

  return {
    companyId,
    invitesSent,
    invitesOpened,
    invitesAccepted,
    connectionsAccepted,
    firstTradeBootstrap,
    firstTradeSent,
    invoicesCreated,
    invoicesPaidOrPartial,
    claimsConfirmed,
    ratingsPublished,
    stages,
    at: new Date().toISOString(),
  };
}
