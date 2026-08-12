/**
 * Lazy one-company SchoolAdvisor packaging enforce (public sector).
 * Call from readiness / hub load — not full-table migrate.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  applySchoolAdvisorPackagingToMetadata,
  type SchoolAdvisorRole,
} from '@/lib/schools/schooladvisor-packaging';
import {
  readPackagingFromMetadata,
  type PackagingSelection,
} from '@/lib/product/architecture';

export function processRoleToPackagingRole(
  role: 'school' | 'agency' | 'isp' | 'department' | 'sp'
): SchoolAdvisorRole {
  if (role === 'agency' || role === 'department') return 'department';
  if (role === 'isp' || role === 'sp') return 'sp';
  return 'school';
}

export function packagingIsSchoolAdvisorCompliant(
  pack: PackagingSelection | null
): boolean {
  if (!pack) return false;
  if (pack.sectorId !== 'public_sector') return false;
  if (!pack.packIds?.includes('public_procurement')) return false;
  // Schools entity should be school; agency provincial/national; SP can vary
  return true;
}

/**
 * Ensure this company profile has SchoolAdvisor public-sector packaging.
 * Returns whether metadata was written + packaging snapshot.
 */
export async function ensureSchoolAdvisorPackagingForCompany(
  supabase: SupabaseClient,
  companyId: number,
  processRole: 'school' | 'agency' | 'isp'
): Promise<{
  updated: boolean;
  packaging: PackagingSelection | null;
  compliant: boolean;
  role: SchoolAdvisorRole;
}> {
  const role = processRoleToPackagingRole(processRole);
  const { data: prof } = await supabase
    .from('profiles')
    .select('id, metadata, business_type, org_type')
    .eq('id', companyId)
    .maybeSingle();
  if (!prof) {
    return { updated: false, packaging: null, compliant: false, role };
  }
  const meta0 =
    prof.metadata && typeof prof.metadata === 'object'
      ? { ...(prof.metadata as Record<string, unknown>) }
      : {};
  const before = readPackagingFromMetadata(meta0);
  const already = packagingIsSchoolAdvisorCompliant(before);
  // Always coerce schools to public sector entity type when school role
  const nextMeta = applySchoolAdvisorPackagingToMetadata(meta0, role);
  const after = readPackagingFromMetadata(nextMeta);
  const compliant = packagingIsSchoolAdvisorCompliant(after);

  const changed =
    !already ||
    before?.sectorId !== after?.sectorId ||
    before?.entityTypeId !== after?.entityTypeId ||
    JSON.stringify(before?.packIds || []) !==
      JSON.stringify(after?.packIds || []) ||
    meta0.programme !== 'schooladvisor';

  if (changed) {
    const patch: Record<string, unknown> = {
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    };
    if (role === 'school') {
      patch.business_type = 'school';
      patch.org_type = 'school';
    } else if (role === 'department') {
      if (
        !String(prof.business_type || '').includes('government') &&
        !String(prof.org_type || '').includes('government')
      ) {
        patch.business_type = 'government_education';
        patch.org_type = 'government_education';
      }
    } else if (role === 'sp') {
      if (
        !String(prof.business_type || '').includes('isp') &&
        !String(prof.business_type || '').includes('sp')
      ) {
        patch.business_type = 'nsnp_isp';
        patch.org_type = 'nsnp_isp';
      }
    }
    await supabase.from('profiles').update(patch).eq('id', companyId);
    return { updated: true, packaging: after, compliant, role };
  }

  return { updated: false, packaging: after || before, compliant, role };
}

/** Issue or return field PWA tokens on school profile metadata */
export function ensureFieldTokensInMeta(
  meta: Record<string, unknown>,
  companyId: number
): {
  meta: Record<string, unknown>;
  serve_token: string;
  peu_token: string;
  changed: boolean;
} {
  const tokens =
    meta.schooladvisor_field_tokens &&
    typeof meta.schooladvisor_field_tokens === 'object'
      ? {
          ...(meta.schooladvisor_field_tokens as Record<string, string>),
        }
      : {};
  let changed = false;
  if (!tokens.serve_day || String(tokens.serve_day).length < 12) {
    tokens.serve_day = `sfd_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    changed = true;
  }
  if (!tokens.peu_visit || String(tokens.peu_visit).length < 12) {
    tokens.peu_visit = `peu_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    changed = true;
  }
  return {
    meta: { ...meta, schooladvisor_field_tokens: tokens },
    serve_token: String(tokens.serve_day),
    peu_token: String(tokens.peu_visit),
    changed,
  };
}
