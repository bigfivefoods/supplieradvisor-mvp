/**
 * Resolve and load the DBE/agency-owned NSNP approved catalogue.
 * Schools linked (approved) to an agency use that agency's list;
 * otherwise fall back to national/platform items (agency_profile_id IS NULL).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type CatalogueContext = {
  /** Company id of owning agency (DBE), or null for national fallback */
  agencyProfileId: number | null;
  agencyName: string | null;
  agencyType: string | null;
  source: 'agency' | 'national' | 'none';
  canEdit: boolean;
  schoolProfileId?: number | null;
};

export async function getAgencyRegistration(
  supabase: SupabaseClient,
  companyId: number
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from('nsnp_agency_profiles')
    .select('*')
    .eq('profile_id', companyId)
    .eq('status', 'active')
    .maybeSingle();
  return (data as Record<string, unknown>) || null;
}

/**
 * For a school company: primary active agency link wins.
 * For an agency company: themselves.
 * Else national.
 */
export async function resolveCatalogueContext(
  supabase: SupabaseClient,
  companyId: number,
  opts?: { schoolProfileId?: number | null }
): Promise<CatalogueContext> {
  // Am I an agency?
  const myAgency = await getAgencyRegistration(supabase, companyId);
  if (myAgency) {
    return {
      agencyProfileId: companyId,
      agencyName: String(myAgency.agency_name || 'Agency'),
      agencyType: myAgency.agency_type != null ? String(myAgency.agency_type) : null,
      source: 'agency',
      canEdit: true,
      schoolProfileId: null,
    };
  }

  // School path
  let schoolId = opts?.schoolProfileId ?? null;
  if (!schoolId) {
    const { data: school } = await supabase
      .from('school_profiles')
      .select('id, primary_agency_profile_id')
      .eq('profile_id', companyId)
      .maybeSingle();
    if (school) {
      schoolId = Number(school.id);
      // Prefer explicit primary if still linked active
      const primary = school.primary_agency_profile_id
        ? Number(school.primary_agency_profile_id)
        : null;
      if (primary) {
        const { data: link } = await supabase
          .from('school_agency_links')
          .select('status')
          .eq('school_profile_id', schoolId)
          .eq('agency_profile_id', primary)
          .eq('status', 'active')
          .maybeSingle();
        if (link) {
          const { data: ag } = await supabase
            .from('nsnp_agency_profiles')
            .select('agency_name, agency_type')
            .eq('profile_id', primary)
            .maybeSingle();
          return {
            agencyProfileId: primary,
            agencyName: ag?.agency_name ? String(ag.agency_name) : 'DBE',
            agencyType: ag?.agency_type != null ? String(ag.agency_type) : null,
            source: 'agency',
            canEdit: false,
            schoolProfileId: schoolId,
          };
        }
      }
    }
  }

  if (schoolId) {
    const { data: links } = await supabase
      .from('school_agency_links')
      .select('agency_profile_id, status, created_at')
      .eq('school_profile_id', schoolId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1);
    const link = links?.[0];
    if (link?.agency_profile_id) {
      const aid = Number(link.agency_profile_id);
      const { data: ag } = await supabase
        .from('nsnp_agency_profiles')
        .select('agency_name, agency_type')
        .eq('profile_id', aid)
        .maybeSingle();
      return {
        agencyProfileId: aid,
        agencyName: ag?.agency_name ? String(ag.agency_name) : 'DBE',
        agencyType: ag?.agency_type != null ? String(ag.agency_type) : null,
        source: 'agency',
        canEdit: false,
        schoolProfileId: schoolId,
      };
    }
  }

  return {
    agencyProfileId: null,
    agencyName: null,
    agencyType: null,
    source: 'national',
    canEdit: false,
    schoolProfileId: schoolId,
  };
}

export async function loadApprovedProducts(
  supabase: SupabaseClient,
  agencyProfileId: number | null,
  opts?: { activeOnly?: boolean; includeNationalFallback?: boolean }
): Promise<Array<Record<string, unknown>>> {
  const activeOnly = opts?.activeOnly !== false;
  const includeNational = opts?.includeNationalFallback !== false;

  // Prefer agency-owned items; optionally merge national (null) as fallback
  // when agency list is empty or for transitional periods
  let q = supabase.from('nsnp_approved_products').select('*').limit(3000);
  if (agencyProfileId != null) {
    if (includeNational) {
      q = q.or(
        `agency_profile_id.eq.${agencyProfileId},agency_profile_id.is.null`
      );
    } else {
      q = q.eq('agency_profile_id', agencyProfileId);
    }
  } else {
    q = q.is('agency_profile_id', null);
  }
  if (activeOnly) q = q.eq('active', true);

  const { data, error } = await q.order('category').order('name');
  if (error) return [];

  const rows = (data || []) as Array<Record<string, unknown>>;
  // If agency has its own products, prefer those only (strict agency list)
  if (agencyProfileId != null) {
    const owned = rows.filter(
      (r) => Number(r.agency_profile_id) === agencyProfileId
    );
    if (owned.length > 0) return owned;
  }
  return rows;
}

export async function loadApprovedBrands(
  supabase: SupabaseClient,
  agencyProfileId: number | null,
  opts?: { activeOnly?: boolean }
): Promise<Array<Record<string, unknown>>> {
  const activeOnly = opts?.activeOnly !== false;
  let q = supabase.from('nsnp_approved_brands').select('*').limit(1000);
  if (agencyProfileId != null) {
    q = q.or(
      `agency_profile_id.eq.${agencyProfileId},agency_profile_id.is.null`
    );
  } else {
    q = q.is('agency_profile_id', null);
  }
  if (activeOnly) q = q.eq('active', true);
  const { data } = await q.order('name');
  const rows = (data || []) as Array<Record<string, unknown>>;
  if (agencyProfileId != null) {
    const owned = rows.filter(
      (r) => Number(r.agency_profile_id) === agencyProfileId
    );
    if (owned.length > 0) return owned;
  }
  return rows;
}

/** Validate product ids against the resolved catalogue. */
export async function filterApprovedProductIds(
  supabase: SupabaseClient,
  agencyProfileId: number | null,
  productIds: number[]
): Promise<Map<number, Record<string, unknown>>> {
  if (!productIds.length) return new Map();
  const products = await loadApprovedProducts(supabase, agencyProfileId, {
    activeOnly: true,
    includeNationalFallback: true,
  });
  const byId = new Map(
    products.map((p) => [Number(p.id), p] as const)
  );
  const out = new Map<number, Record<string, unknown>>();
  for (const id of productIds) {
    const p = byId.get(id);
    if (p && p.active !== false) out.set(id, p);
  }
  return out;
}
