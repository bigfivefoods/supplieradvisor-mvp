/**
 * SP eligibility for school trade: must be associated + approved by the school's agency.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Agency company ids the school is actively associated with.
 */
export async function schoolActiveAgencyIds(
  supabase: SupabaseClient,
  schoolProfileId: number
): Promise<number[]> {
  const { data } = await supabase
    .from('school_agency_links')
    .select('agency_profile_id')
    .eq('school_profile_id', schoolProfileId)
    .eq('status', 'active')
    .limit(50);
  return (data || [])
    .map((r) => Number(r.agency_profile_id))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * SP profile_ids approved (active link) under any of the given agencies.
 */
export async function ispsApprovedUnderAgencies(
  supabase: SupabaseClient,
  agencyProfileIds: number[]
): Promise<number[]> {
  if (!agencyProfileIds.length) return [];
  const { data } = await supabase
    .from('nsnp_isp_agency_links')
    .select('isp_profile_id')
    .in('agency_profile_id', agencyProfileIds)
    .eq('status', 'active')
    .limit(500);
  return [
    ...new Set(
      (data || [])
        .map((r) => Number(r.isp_profile_id))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
}

/**
 * True if SP has an active association with at least one of the school's agencies.
 */
export async function ispMaySupplySchool(
  supabase: SupabaseClient,
  schoolProfileId: number,
  ispProfileId: number
): Promise<{ ok: boolean; reason?: string }> {
  const agencies = await schoolActiveAgencyIds(supabase, schoolProfileId);
  if (!agencies.length) {
    return {
      ok: false,
      reason:
        'School must join and be approved by a DBE/PEU/DoH agency before ordering from SPs.',
    };
  }

  const { data: link } = await supabase
    .from('nsnp_isp_agency_links')
    .select('id, status, agency_profile_id')
    .eq('isp_profile_id', ispProfileId)
    .in('agency_profile_id', agencies)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (!link) {
    // Fallback: legacy global compliant + approved_by one of school agencies
    const { data: isp } = await supabase
      .from('nsnp_isp_profiles')
      .select('compliance_status, approved_by_agency_profile_id')
      .eq('profile_id', ispProfileId)
      .maybeSingle();
    if (
      isp &&
      String(isp.compliance_status) === 'compliant' &&
      isp.approved_by_agency_profile_id &&
      agencies.includes(Number(isp.approved_by_agency_profile_id))
    ) {
      return { ok: true };
    }
    return {
      ok: false,
      reason:
        'SP must request to join your department (DBE/PEU/DoH) and be approved before schools can trade with them.',
    };
  }

  return { ok: true };
}
