/**
 * Open-to-trade discovery ranking: verified + density signals + OTIFEF/trust.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';

export type RankedCompany = {
  id: number;
  trading_name: string | null;
  legal_name: string | null;
  industry: string | null;
  city: string | null;
  country: string | null;
  verification_status: string | null;
  trust_score: number | null;
  otifef_average: number | null;
  rankScore: number;
  reasons: string[];
};

export async function loadOpenToTradeRanking(opts?: {
  industry?: string | null;
  city?: string | null;
  limit?: number;
  /** Viewer company — boost mutual / accepted connections */
  viewerCompanyId?: number | null;
}): Promise<RankedCompany[]> {
  const supabase = getSupabaseServer();
  let q = supabase
    .from('profiles')
    .select(
      'id, trading_name, legal_name, industry, city, country, verification_status, trust_score, otifef_average, is_discoverable, metadata, settings, updated_at'
    )
    .not('trading_name', 'is', null)
    .order('trust_score', { ascending: false })
    .limit(120);

  if (opts?.industry) q = q.ilike('industry', opts.industry);
  if (opts?.city) q = q.ilike('city', opts.city);

  const { data, error } = await q;
  if (error || !data) return [];

  // Mutual / accepted edges for viewer
  const connectedIds = new Set<number>();
  const viewerId = Number(opts?.viewerCompanyId || 0);
  if (viewerId > 0) {
    try {
      const { data: edges } = await supabase
        .from('business_connections')
        .select('requester_profile_id, requestee_profile_id, status')
        .or(
          `requester_profile_id.eq.${viewerId},requestee_profile_id.eq.${viewerId}`
        )
        .eq('status', 'accepted')
        .limit(200);
      for (const e of edges || []) {
        const a = Number(e.requester_profile_id);
        const b = Number(e.requestee_profile_id);
        if (a === viewerId && b > 0) connectedIds.add(b);
        if (b === viewerId && a > 0) connectedIds.add(a);
      }
    } catch {
      /* soft */
    }
  }

  const ranked: RankedCompany[] = [];
  for (const raw of data) {
    const r = raw as Record<string, unknown>;
    if (r.is_discoverable === false || r.is_discoverable === 'false') continue;

    // open_to_trade preference when present
    let openToTrade = true;
    const meta =
      r.metadata && typeof r.metadata === 'object'
        ? (r.metadata as Record<string, unknown>)
        : {};
    if (typeof meta.open_to_trade === 'boolean') openToTrade = meta.open_to_trade;
    const settings =
      r.settings && typeof r.settings === 'object'
        ? (r.settings as Record<string, unknown>)
        : {};
    if (typeof settings.open_to_trade === 'boolean') {
      openToTrade = settings.open_to_trade;
    }
    if (!openToTrade) continue;

    const verified =
      String(r.verification_status || '').toLowerCase() === 'verified';
    const trust = r.trust_score != null ? Number(r.trust_score) : 0;
    const otifef = r.otifef_average != null ? Number(r.otifef_average) : 0;
    const reasons: string[] = [];
    let rankScore = 20;
    if (verified) {
      rankScore += 35;
      reasons.push('CIPC verified');
    }
    if (trust > 0) {
      rankScore += Math.min(30, trust * 0.3);
      reasons.push(`trust ${Math.round(trust)}`);
    }
    if (otifef > 0) {
      rankScore += Math.min(20, otifef * 0.2);
      reasons.push(`OTIFEF ${Math.round(otifef)}`);
    }
    if (r.city) rankScore += 3;
    if (r.industry) rankScore += 2;
    // Recency boost if profile updated in last 90 days
    const updated = r.updated_at ? Date.parse(String(r.updated_at)) : 0;
    if (updated && Date.now() - updated < 90 * 86400000) {
      rankScore += 5;
      reasons.push('recently active');
    }
    // Catalogue / open-to-trade flags in metadata
    const hasCatalogue =
      meta.catalogue_count != null
        ? Number(meta.catalogue_count) > 0
        : Boolean(meta.has_catalogue || meta.catalogue_ready);
    if (hasCatalogue) {
      rankScore += 8;
      reasons.push('catalogue ready');
    }
    if (meta.open_to_trade === true || settings.open_to_trade === true) {
      rankScore += 6;
      reasons.push('open to trade');
    }
    // Industry / city match vs filter already applied; soft boost for complete profile
    if (r.city && r.industry && r.country) {
      rankScore += 4;
      reasons.push('complete location');
    }
    const peerId = Number(r.id);
    if (viewerId > 0 && peerId === viewerId) continue;
    if (connectedIds.has(peerId)) {
      rankScore += 12;
      reasons.push('already connected');
    }

    ranked.push({
      id: Number(r.id),
      trading_name: r.trading_name != null ? String(r.trading_name) : null,
      legal_name: r.legal_name != null ? String(r.legal_name) : null,
      industry: r.industry != null ? String(r.industry) : null,
      city: r.city != null ? String(r.city) : null,
      country: r.country != null ? String(r.country) : null,
      verification_status:
        r.verification_status != null ? String(r.verification_status) : null,
      trust_score: trust || null,
      otifef_average: otifef || null,
      rankScore: Math.round(rankScore),
      reasons,
    });
  }

  ranked.sort((a, b) => b.rankScore - a.rankScore);
  return ranked.slice(0, opts?.limit || 40);
}
