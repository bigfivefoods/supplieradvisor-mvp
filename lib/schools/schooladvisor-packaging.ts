/**
 * SchoolAdvisor® packaging — all school / DBE / NSNP companies live on the
 * Public Sector (government) process: sector, entity tier, and programme packs.
 */
import {
  packagingFromSelection,
  packagingMetadataBlob,
  readPackagingFromMetadata,
  type PackagingSelection,
} from '@/lib/product/architecture';
import type { SupabaseClient } from '@supabase/supabase-js';

export const SCHOOLADVISOR_BRAND = 'SchoolAdvisor®';
export const SCHOOLADVISOR_MODULE_LABEL = 'SchoolAdvisor';
export const SCHOOLADVISOR_SECTOR = 'public_sector' as const;
export const SCHOOLADVISOR_PACK = 'public_procurement' as const;

/** Profile signals that this company is part of the SchoolAdvisor programme */
export function isSchoolAdvisorCompany(opts: {
  business_type?: string | null;
  org_type?: string | null;
  entity_kind?: string | null;
  has_school_profile?: boolean;
  has_education_agency?: boolean;
  has_nsnp_isp?: boolean;
  packaging?: PackagingSelection | null;
}): boolean {
  if (opts.has_school_profile || opts.has_education_agency || opts.has_nsnp_isp) {
    return true;
  }
  const t = `${opts.business_type || ''} ${opts.org_type || ''} ${opts.entity_kind || ''}`
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (
    t.includes('school') ||
    t.includes('ecd') ||
    t === 'government_education' ||
    t.includes('provincial_nsnp') ||
    t === 'dbe' ||
    t === 'peu' ||
    t === 'nsnp_isp' ||
    t.includes('service_provider') ||
    (t.includes('government') && t.includes('education'))
  ) {
    return true;
  }
  const ent = String(opts.packaging?.entityTypeId || '');
  const sec = String(opts.packaging?.sectorId || '');
  if (ent === 'school' && sec === 'public_sector') return true;
  if (
    (ent === 'provincial' || ent === 'national') &&
    opts.packaging?.packIds?.includes(SCHOOLADVISOR_PACK)
  ) {
    // only if schools module is in play — caller may refine
    return opts.packaging?.moduleIds?.includes('schools') === true;
  }
  return false;
}

export type SchoolAdvisorRole = 'school' | 'department' | 'sp';

export function schoolAdvisorRoleFromTypes(
  businessType?: string | null,
  orgType?: string | null
): SchoolAdvisorRole {
  const t = `${orgType || ''} ${businessType || ''}`
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (
    t.includes('government') ||
    t === 'dbe' ||
    t === 'peu' ||
    t === 'government_education' ||
    t === 'provincial_nsnp' ||
    t === 'national_government' ||
    t === 'provincial_government'
  ) {
    return 'department';
  }
  if (
    t === 'nsnp_isp' ||
    t === 'isp' ||
    t === 'sp' ||
    t.includes('service_provider')
  ) {
    return 'sp';
  }
  return 'school';
}

export function entityTypeForSchoolAdvisorRole(
  role: SchoolAdvisorRole
): 'school' | 'provincial' | 'private_company' {
  if (role === 'department') return 'provincial';
  if (role === 'sp') return 'private_company'; // SPs supply programme but pack still public
  return 'school';
}

/**
 * Force packaging onto the government / public_sector SchoolAdvisor pathway.
 */
export function coerceSchoolAdvisorPackaging(
  current: PackagingSelection | null | undefined,
  role: SchoolAdvisorRole = 'school'
): PackagingSelection {
  const entityTypeId =
    role === 'department'
      ? current?.entityTypeId === 'national'
        ? 'national'
        : 'provincial'
      : role === 'sp'
        ? current?.entityTypeId && current.entityTypeId !== 'private_company'
          ? current.entityTypeId
          : 'private_company'
        : 'school';

  const packIds = [
    ...new Set([
      ...(current?.packIds || []),
      SCHOOLADVISOR_PACK,
    ]),
  ];
  const moduleIds = [
    ...new Set([...(current?.moduleIds || []), 'schools']),
  ];

  return packagingFromSelection({
    entityTypeId,
    sectorId: SCHOOLADVISOR_SECTOR,
    packIds,
    moduleIds,
    industryId:
      role === 'department'
        ? 'public_provincial'
        : role === 'sp'
          ? current?.industryId || 'public_local'
          : 'public_local',
    businessTypeId:
      role === 'department'
        ? 'provincial_education'
        : role === 'sp'
          ? 'nsnp_sp'
          : 'public_school',
  });
}

/** Metadata fields for new school workspaces (registry / agency create). */
export function schoolAdvisorWorkspaceMetadata(
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  const selection = coerceSchoolAdvisorPackaging(null, 'school');
  return {
    entity_kind: 'school',
    programme: 'schooladvisor',
    advisor_brand: SCHOOLADVISOR_BRAND,
    enabled_modules: {
      schools: true,
      home: true,
      guide: true,
      network: true,
      inventory: true,
      suppliers: true,
    },
    ...packagingMetadataBlob(selection),
    ...extra,
  };
}

/**
 * Merge SchoolAdvisor packaging into existing profile metadata (non-destructive).
 */
export function applySchoolAdvisorPackagingToMetadata(
  meta: Record<string, unknown>,
  role: SchoolAdvisorRole
): Record<string, unknown> {
  const current = readPackagingFromMetadata(meta);
  const next = coerceSchoolAdvisorPackaging(current, role);
  const blob = packagingMetadataBlob(next);
  const enabled = {
    ...((meta.enabled_modules as Record<string, boolean>) || {}),
    schools: true,
    home: true,
    guide: true,
  };
  return {
    ...meta,
    ...blob,
    entity_kind:
      role === 'school'
        ? 'school'
        : role === 'department'
          ? 'education_agency'
          : meta.entity_kind || 'nsnp_isp',
    programme: 'schooladvisor',
    advisor_brand: SCHOOLADVISOR_BRAND,
    enabled_modules: enabled,
  };
}

/**
 * Bulk-normalize every SchoolAdvisor company onto public_sector packaging.
 * Call with service-role supabase (cron / ops).
 */
export async function migrateAllSchoolAdvisorPackaging(
  supabase: SupabaseClient
): Promise<{
  schools: number;
  agencies: number;
  isps: number;
  typed: number;
  updated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let updated = 0;
  const now = new Date().toISOString();

  const schoolIds = new Set<number>();
  const agencyIds = new Set<number>();
  const ispIds = new Set<number>();

  const { data: schoolRows } = await supabase
    .from('school_profiles')
    .select('profile_id')
    .not('profile_id', 'is', null)
    .limit(5000);
  for (const r of schoolRows || []) {
    if (r.profile_id) schoolIds.add(Number(r.profile_id));
  }

  const { data: agencyRows } = await supabase
    .from('nsnp_agency_profiles')
    .select('profile_id, agency_type')
    .limit(2000);
  for (const r of agencyRows || []) {
    if (r.profile_id) agencyIds.add(Number(r.profile_id));
  }

  const { data: ispRows } = await supabase
    .from('nsnp_isp_profiles')
    .select('profile_id')
    .limit(5000);
  for (const r of ispRows || []) {
    if (r.profile_id) ispIds.add(Number(r.profile_id));
  }

  // Profiles typed as school / education government without domain rows
  const { data: typedRows } = await supabase
    .from('profiles')
    .select('id, business_type, org_type, metadata')
    .or(
      'business_type.eq.school,org_type.eq.school,business_type.eq.government_education,org_type.eq.government_education,business_type.eq.nsnp_isp,org_type.eq.nsnp_isp'
    )
    .limit(5000);

  const typed = typedRows?.length || 0;
  for (const r of typedRows || []) {
    const id = Number(r.id);
    const role = schoolAdvisorRoleFromTypes(
      r.business_type != null ? String(r.business_type) : null,
      r.org_type != null ? String(r.org_type) : null
    );
    if (role === 'school') schoolIds.add(id);
    else if (role === 'department') agencyIds.add(id);
    else ispIds.add(id);
  }

  async function patchIds(ids: Set<number>, role: SchoolAdvisorRole) {
    for (const id of ids) {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, metadata, business_type, org_type')
          .eq('id', id)
          .maybeSingle();
        if (!prof) continue;
        const meta0 =
          prof.metadata && typeof prof.metadata === 'object'
            ? { ...(prof.metadata as Record<string, unknown>) }
            : {};
        const nextMeta = applySchoolAdvisorPackagingToMetadata(meta0, role);
        const patch: Record<string, unknown> = {
          metadata: nextMeta,
          updated_at: now,
        };
        // Keep business_type aligned for schools / agencies / SPs
        if (role === 'school') {
          if (!prof.business_type || !String(prof.business_type).includes('school')) {
            patch.business_type = 'school';
            patch.org_type = 'school';
          }
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
        const { error } = await supabase
          .from('profiles')
          .update(patch)
          .eq('id', id);
        if (error) {
          errors.push(`id ${id}: ${error.message}`);
        } else {
          updated += 1;
        }
      } catch (e: unknown) {
        errors.push(
          `id ${id}: ${e instanceof Error ? e.message : 'update failed'}`
        );
      }
    }
  }

  await patchIds(schoolIds, 'school');
  await patchIds(agencyIds, 'department');
  await patchIds(ispIds, 'sp');

  return {
    schools: schoolIds.size,
    agencies: agencyIds.size,
    isps: ispIds.size,
    typed,
    updated,
    errors: errors.slice(0, 50),
  };
}
