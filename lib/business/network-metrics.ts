/**
 * Network density + invite quality metrics for growth loops.
 */

import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getPartnerCount, INVITE_PARTNERS_GOAL } from '@/lib/onboarding/checklist';

export type NetworkDensityMetrics = {
  companyId: number;
  partnerCount: number;
  partnerGoal: number;
  densityScore: number; // 0–100
  connectionsAccepted: number;
  connectionsPending: number;
  suppliersBook: number;
  customersBook: number;
  invitesSent: number;
  invitesOpened: number;
  invitesAccepted: number;
  openRate: number | null;
  acceptRate: number | null;
  qualityScore: number; // 0–100
  openToTrade: boolean | null;
  firstTradeDone: boolean;
  recommendations: string[];
  at: string;
};

function rate(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

export async function loadNetworkDensityMetrics(
  companyId: number
): Promise<NetworkDensityMetrics> {
  const supabase = getSupabaseServer();
  const partnerCount = await getPartnerCount(companyId);

  const [
    connAcc,
    connPend,
    suppliers,
    customers,
    invites,
    profileRes,
    tradeInv,
    tradePo,
  ] = await Promise.all([
    supabase
      .from('business_connections')
      .select('id', { count: 'exact', head: true })
      .or(
        `requester_profile_id.eq.${companyId},requestee_profile_id.eq.${companyId}`
      )
      .eq('status', 'accepted'),
    supabase
      .from('business_connections')
      .select('id', { count: 'exact', head: true })
      .or(
        `requester_profile_id.eq.${companyId},requestee_profile_id.eq.${companyId}`
      )
      .in('status', ['pending', 'requested']),
    supabase
      .from('suppliers')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId),
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId),
    supabase
      .from('activity_log')
      .select('id, action, metadata, created_at')
      .eq('profile_id', companyId)
      .in('action', [
        'directory.invite_sent',
        'directory.invite_resent',
        'network.invite_sent',
        'network.invite_opened',
        'network.invite_accepted',
        'network.invite_seq_3',
        'network.invite_seq_7',
      ])
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('profiles')
      .select('metadata, open_to_trade')
      .eq('id', companyId)
      .maybeSingle(),
    supabase
      .from('customer_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId),
    supabase
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_profile_id', companyId),
  ]);

  const connectionsAccepted = connAcc.count ?? 0;
  const connectionsPending = connPend.count ?? 0;
  const suppliersBook = suppliers.count ?? 0;
  const customersBook = customers.count ?? 0;

  let invitesSent = 0;
  let invitesOpened = 0;
  let invitesAccepted = 0;
  const emails = new Set<string>();
  for (const row of invites.data || []) {
    const a = String(row.action || '');
    const meta =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {};
    const em = meta.email ? String(meta.email).toLowerCase() : '';
    if (em) emails.add(em);
    if (
      a.includes('invite_sent') ||
      a === 'directory.invite_resent' ||
      a === 'network.invite_sent'
    ) {
      invitesSent += 1;
    }
    if (a.includes('invite_opened')) invitesOpened += 1;
    if (a.includes('invite_accepted')) invitesAccepted += 1;
  }

  // Density: progress vs partner goal + accepted connections weight
  const densityScore = Math.min(
    100,
    Math.round(
      (Math.min(partnerCount, INVITE_PARTNERS_GOAL) / INVITE_PARTNERS_GOAL) * 55 +
        Math.min(connectionsAccepted, 10) * 3 +
        Math.min(suppliersBook + customersBook, 20) * 1
    )
  );

  const openRate = rate(invitesOpened, invitesSent);
  const acceptRate = rate(invitesAccepted, Math.max(invitesSent, 1));

  // Quality: accept rate + unique emails + less spammy volume
  let qualityScore = 40;
  if (acceptRate != null) qualityScore += Math.min(40, acceptRate * 0.5);
  if (openRate != null) qualityScore += Math.min(15, openRate * 0.15);
  if (emails.size >= 3) qualityScore += 5;
  if (invitesSent > 0 && invitesAccepted === 0 && invitesSent >= 5) {
    qualityScore -= 15;
  }
  qualityScore = Math.max(0, Math.min(100, Math.round(qualityScore)));

  let openToTrade: boolean | null = null;
  const prof = profileRes.data as Record<string, unknown> | null;
  if (prof) {
    if (typeof prof.open_to_trade === 'boolean') {
      openToTrade = prof.open_to_trade;
    } else if (prof.metadata && typeof prof.metadata === 'object') {
      const m = prof.metadata as Record<string, unknown>;
      if (typeof m.open_to_trade === 'boolean') openToTrade = m.open_to_trade;
      const s = m.settings;
      if (
        openToTrade == null &&
        s &&
        typeof s === 'object' &&
        typeof (s as { open_to_trade?: boolean }).open_to_trade === 'boolean'
      ) {
        openToTrade = (s as { open_to_trade: boolean }).open_to_trade;
      }
    }
  }

  const firstTradeDone =
    (tradeInv.count || 0) + (tradePo.count || 0) > 0;

  const recommendations: string[] = [];
  if (partnerCount < INVITE_PARTNERS_GOAL) {
    recommendations.push(
      `Invite ${INVITE_PARTNERS_GOAL - partnerCount} more trading partners (goal ${INVITE_PARTNERS_GOAL}).`
    );
  }
  if (invitesSent === 0) {
    recommendations.push('Send your first network invite from Network invites.');
  } else if ((acceptRate ?? 0) < 10 && invitesSent >= 3) {
    recommendations.push(
      'Invite accept rate is low — personalize emails and follow up after 3 and 7 days.'
    );
  }
  if (connectionsPending > 0) {
    recommendations.push(
      `Review ${connectionsPending} pending connection(s) in Network.`
    );
  }
  if (!firstTradeDone && partnerCount > 0) {
    recommendations.push(
      'Partners exist but no trade yet — open First trade (30 min path).'
    );
  }
  if (openToTrade === false) {
    recommendations.push(
      'Turn on “Open to trade” so directory buyers can find you.'
    );
  }
  if (!recommendations.length) {
    recommendations.push('Network looks healthy — keep inviting quality partners.');
  }

  return {
    companyId,
    partnerCount,
    partnerGoal: INVITE_PARTNERS_GOAL,
    densityScore,
    connectionsAccepted,
    connectionsPending,
    suppliersBook,
    customersBook,
    invitesSent,
    invitesOpened,
    invitesAccepted,
    openRate,
    acceptRate,
    qualityScore,
    openToTrade,
    firstTradeDone,
    recommendations,
    at: new Date().toISOString(),
  };
}
