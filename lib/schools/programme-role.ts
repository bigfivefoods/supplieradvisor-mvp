/**
 * Programme role under SchoolAdvisor® (public sector / NSNP only):
 *   department (DBE / PEU) · school · sp (service provider)
 *
 * SchoolAdvisor is the government-process education programme — never private OS packaging.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { familyForAgencyType } from '@/lib/entities/programme-hierarchy';

export type ProgrammeRole = 'department' | 'school' | 'sp';

export type ProgrammeRoleInfo = {
  role: ProgrammeRole;
  /** Nav group label */
  group: 'DBE' | 'School' | 'SP';
  label: string;
  /** Module hub path for this role */
  homePath: string;
};

export function programmeRoleFromOrgType(
  orgType?: string | null,
  businessType?: string | null
): ProgrammeRole | null {
  const t = String(orgType || businessType || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  // Non-education government types are not Schools departments
  if (
    t === 'doh' ||
    t === 'department_of_health' ||
    t === 'government_health' ||
    t === 'provincial_health'
  ) {
    return null;
  }

  if (
    t.includes('government') ||
    t === 'dbe' ||
    t === 'peu' ||
    t === 'government_education' ||
    t === 'provincial_nsnp'
  ) {
    return 'department';
  }
  if (
    t === 'nsnp_isp' ||
    t === 'isp' ||
    t === 'sp' ||
    t.includes('service_provider') ||
    t === 'service provider (sp)'
  ) {
    return 'sp';
  }
  if (
    t === 'school' ||
    t.includes('school') ||
    t.includes('ecd')
  ) {
    return 'school';
  }
  // Non-school facility org types are not Schools nav
  if (t === 'hospital' || t === 'clinic' || t.includes('hospital') || t.includes('clinic')) {
    return null;
  }
  return null;
}

export function infoForProgrammeRole(role: ProgrammeRole): ProgrammeRoleInfo {
  if (role === 'department') {
    return {
      role: 'department',
      group: 'DBE',
      label: 'SchoolAdvisor · Department (DBE / PEU)',
      homePath: '/dashboard/schools',
    };
  }
  if (role === 'sp') {
    return {
      role: 'sp',
      group: 'SP',
      label: 'SchoolAdvisor · Service Provider',
      homePath: '/dashboard/schools/isp',
    };
  }
  return {
    role: 'school',
    group: 'School',
    label: 'SchoolAdvisor · School',
    homePath: '/dashboard/schools',
  };
}

/**
 * Resolve which Schools-module navigation the company should see.
 * Prefers domain tables (education agency / SP / school profile), then org_type.
 * Non-education agencies do NOT resolve as Schools department.
 */
export async function resolveProgrammeRole(
  supabase: SupabaseClient,
  companyId: number
): Promise<ProgrammeRoleInfo> {
  const { nsnpCacheGet, nsnpCacheSet, NSNP_TTL } = await import(
    '@/lib/schools/nsnp-cache'
  );
  const ck = `nsnp:role:${companyId}`;
  const hit = nsnpCacheGet<ProgrammeRoleInfo>(ck);
  if (hit) return hit;

  const [{ data: agency }, { data: isp }, { data: school }, { data: prof }] =
    await Promise.all([
      supabase
        .from('nsnp_agency_profiles')
        .select('profile_id, agency_type, status')
        .eq('profile_id', companyId)
        .maybeSingle(),
      supabase
        .from('nsnp_isp_profiles')
        .select('profile_id')
        .eq('profile_id', companyId)
        .maybeSingle(),
      supabase
        .from('school_profiles')
        .select('id, member_type')
        .eq('profile_id', companyId)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('org_type, business_type')
        .eq('id', companyId)
        .maybeSingle(),
    ]);

  // Education agencies only for Schools department role
  const finish = (info: ProgrammeRoleInfo) =>
    nsnpCacheSet(ck, info, NSNP_TTL.role);

  if (
    agency &&
    agency.status !== 'inactive' &&
    familyForAgencyType(String(agency.agency_type || 'dbe')) === 'education'
  ) {
    return finish(infoForProgrammeRole('department'));
  }

  if (isp) {
    return finish(infoForProgrammeRole('sp'));
  }

  // School profiles only
  if (school) {
    const mt = String(school.member_type || 'school').toLowerCase();
    if (!['hospital', 'clinic', 'shelter'].includes(mt)) {
      return finish(infoForProgrammeRole('school'));
    }
  }

  const fromOrg = programmeRoleFromOrgType(
    prof?.org_type != null ? String(prof.org_type) : null,
    prof?.business_type != null ? String(prof.business_type) : null
  );
  if (fromOrg) return finish(infoForProgrammeRole(fromOrg));

  // Default: school-facing programme
  return finish(infoForProgrammeRole('school'));
}

/** Which nav groups a role may see (only their own tool). */
export function navGroupsForRole(role: ProgrammeRole): string[] {
  if (role === 'department') return ['DBE', 'DBE/PEU']; // keep legacy group match during transition
  if (role === 'sp') return ['SP'];
  return ['School'];
}

export function stepVisibleForRole(
  stepGroup: string | null | undefined,
  role: ProgrammeRole
): boolean {
  if (!stepGroup) return true;
  const allowed = navGroupsForRole(role);
  return allowed.includes(stepGroup);
}
