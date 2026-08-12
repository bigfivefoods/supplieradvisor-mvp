/**
 * Claim submit gate: block when linked SPs are on probation or OTIFEF is critically low.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadIspSlaScorecard } from '@/lib/schools/isp-sla-scorecard';
import { recomputeSpTier } from '@/lib/schools/sp-tier';

/** Minimum OTIFEF % (0–100) for full claim submit when scorecard has data */
export const CLAIM_MIN_OTIFEF_PCT = 60;

export type ClaimSlaGateResult = {
  blocked: boolean;
  reason: string | null;
  sp_count: number;
  probation_count: number;
  worst_otifef_pct: number | null;
  isps: Array<{
    id: number;
    name: string;
    probation: boolean;
    otifef_pct: number | null;
    badge: string;
  }>;
};

export async function evaluateClaimSlaGate(
  supabase: SupabaseClient,
  companyId: number,
  opts: { from: string; to: string; schoolProfileId: number }
): Promise<ClaimSlaGateResult> {
  const empty: ClaimSlaGateResult = {
    blocked: false,
    reason: null,
    sp_count: 0,
    probation_count: 0,
    worst_otifef_pct: null,
    isps: [],
  };

  try {
    // Linked SPs for this school
    const { data: links } = await supabase
      .from('school_isp_links')
      .select('isp_profile_id, status, preferred')
      .eq('school_profile_id', opts.schoolProfileId)
      .limit(40);
    const ispIds = [
      ...new Set(
        (links || [])
          .filter((l) => !['left', 'rejected'].includes(String(l.status || '')))
          .map((l) => Number(l.isp_profile_id))
          .filter(Boolean)
      ),
    ];
    if (!ispIds.length) return empty;

    // Tier recompute (best effort)
    const tiers: Array<{
      id: number;
      probation: boolean;
      preferred: boolean;
      reason: string;
    }> = [];
    for (const id of ispIds.slice(0, 12)) {
      const t = await recomputeSpTier(supabase, id);
      if (t) {
        tiers.push({
          id,
          probation: t.probation,
          preferred: t.preferred,
          reason: t.reason,
        });
      }
    }

    const scorecard = await loadIspSlaScorecard(supabase, companyId, {
      from: opts.from,
      to: opts.to,
      persist: false,
    });

    const isps = (scorecard.isps || [])
      .filter((r) => ispIds.includes(Number(r.isp_profile_id)))
      .map((r) => {
        const tier = tiers.find((t) => t.id === Number(r.isp_profile_id));
        return {
          id: Number(r.isp_profile_id),
          name: r.name,
          probation: tier?.probation === true || r.badge === 'probation',
          otifef_pct: r.otifef_pct,
          badge: r.badge || (tier?.preferred ? 'preferred' : 'standard'),
        };
      });

    // Include tier-only SPs with no deliveries in period
    for (const t of tiers) {
      if (!isps.some((i) => i.id === t.id)) {
        isps.push({
          id: t.id,
          name: `SP #${t.id}`,
          probation: t.probation,
          otifef_pct: null,
          badge: t.preferred ? 'preferred' : t.probation ? 'probation' : 'standard',
        });
      }
    }

    const probation = isps.filter((i) => i.probation);
    const otifVals = isps
      .map((i) => i.otifef_pct)
      .filter((n): n is number => n != null && Number.isFinite(n));
    const worst =
      otifVals.length > 0 ? Math.min(...otifVals) : null;

    if (probation.length > 0) {
      const names = probation
        .slice(0, 3)
        .map((p) => p.name)
        .join(', ');
      return {
        blocked: true,
        reason: `SP on probation (${names}${probation.length > 3 ? '…' : ''}) — improve deliveries / catalogue compliance before claim submit`,
        sp_count: isps.length,
        probation_count: probation.length,
        worst_otifef_pct: worst,
        isps,
      };
    }

    if (worst != null && worst < CLAIM_MIN_OTIFEF_PCT && otifVals.length > 0) {
      return {
        blocked: true,
        reason: `SP OTIFEF ${worst}% is below ${CLAIM_MIN_OTIFEF_PCT}% for this period — fix late / short / off-catalogue deliveries before full claim submit`,
        sp_count: isps.length,
        probation_count: 0,
        worst_otifef_pct: worst,
        isps,
      };
    }

    return {
      blocked: false,
      reason: null,
      sp_count: isps.length,
      probation_count: 0,
      worst_otifef_pct: worst,
      isps,
    };
  } catch {
    return empty;
  }
}
