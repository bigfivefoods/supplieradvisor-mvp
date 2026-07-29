/**
 * Preferred / probation SP rules from delivery + GRN outcomes.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type SpTier = 'preferred' | 'standard' | 'probation';

export type SpTierResult = {
  tier: SpTier;
  score: number;
  late_count: number;
  off_catalogue_count: number;
  clean_count: number;
  deliveries_scored: number;
  preferred: boolean;
  probation: boolean;
  compliance_status: string;
  reason: string;
};

const LATE_PROBATION = 3;
const OFF_CAT_PROBATION = 2;
const PREFERRED_MIN_CLEAN = 5;
const PREFERRED_MAX_LATE = 0;
const PREFERRED_MAX_OFF = 0;

/**
 * Recompute SP tier from last ~90 days of deliveries / GRNs for this ISP.
 */
export async function recomputeSpTier(
  supabase: SupabaseClient,
  ispProfileId: number
): Promise<SpTierResult | null> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const sinceStr = since.toISOString().slice(0, 10);

    const { data: dels } = await supabase
      .from('school_nsnp_deliveries')
      .select('id, status, expected_date, otif, metadata, received_at')
      .eq('isp_profile_id', ispProfileId)
      .gte('created_at', since.toISOString())
      .limit(200);

    const { data: grns } = await supabase
      .from('school_kitchen_receipts')
      .select('id, compliance_ok, received_at, isp_profile_id')
      .eq('isp_profile_id', ispProfileId)
      .gte('received_at', sinceStr)
      .limit(200);

    let late = 0;
    let clean = 0;
    let off = 0;
    const list = dels || [];
    for (const d of list) {
      const exp = d.expected_date ? String(d.expected_date).slice(0, 10) : null;
      const recv = d.received_at
        ? String(d.received_at).slice(0, 10)
        : null;
      if (d.otif === false) late += 1;
      else if (exp && recv && recv > exp) late += 1;
      else if (
        exp &&
        !recv &&
        exp < new Date().toISOString().slice(0, 10) &&
        !['received', 'cancelled'].includes(String(d.status))
      ) {
        late += 1;
      }
    }
    for (const g of grns || []) {
      if (g.compliance_ok === false) off += 1;
      else clean += 1;
    }

    const scored = Math.max(list.length, (grns || []).length);
    let tier: SpTier = 'standard';
    let reason = 'Standard standing';
    if (late >= LATE_PROBATION || off >= OFF_CAT_PROBATION) {
      tier = 'probation';
      reason =
        late >= LATE_PROBATION
          ? `${late} late deliveries in 90 days → probation`
          : `${off} off-catalogue GRNs in 90 days → probation`;
    } else if (
      clean >= PREFERRED_MIN_CLEAN &&
      late <= PREFERRED_MAX_LATE &&
      off <= PREFERRED_MAX_OFF &&
      scored >= PREFERRED_MIN_CLEAN
    ) {
      tier = 'preferred';
      reason = `${clean} clean GRNs, no late/off-catalogue → preferred`;
    }

    // Score 0–100
    const base = 70;
    const score = Math.max(
      0,
      Math.min(
        100,
        Math.round(base + clean * 3 - late * 8 - off * 12)
      )
    );

    const compliance_status =
      tier === 'preferred'
        ? 'preferred'
        : tier === 'probation'
          ? 'probation'
          : 'active';

    const patch: Record<string, unknown> = {
      compliance_status,
      delivery_otifef_pct: score,
      updated_at: new Date().toISOString(),
    };
    // Soft columns if present
    try {
      await supabase
        .from('nsnp_isp_profiles')
        .update({
          ...patch,
          preferred: tier === 'preferred',
          metadata: {
            tier,
            tier_reason: reason,
            tier_late: late,
            tier_off_catalogue: off,
            tier_clean: clean,
            tier_scored_at: new Date().toISOString(),
          },
        })
        .eq('profile_id', ispProfileId);
    } catch {
      await supabase
        .from('nsnp_isp_profiles')
        .update(patch)
        .eq('profile_id', ispProfileId);
    }

    // Soft: mark school_isp_links preferred flag for this SP
    try {
      await supabase
        .from('school_isp_links')
        .update({
          preferred: tier === 'preferred',
          updated_at: new Date().toISOString(),
        })
        .eq('isp_profile_id', ispProfileId)
        .eq('status', 'active');
    } catch {
      /* soft */
    }

    return {
      tier,
      score,
      late_count: late,
      off_catalogue_count: off,
      clean_count: clean,
      deliveries_scored: scored,
      preferred: tier === 'preferred',
      probation: tier === 'probation',
      compliance_status,
      reason,
    };
  } catch {
    return null;
  }
}
