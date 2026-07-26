/**
 * Programme role under the Schools module:
 *   department (DBE/DoH) · school (facility) · sp (service provider)
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type ProgrammeRole = 'department' | 'school' | 'sp';

export type ProgrammeRoleInfo = {
  role: ProgrammeRole;
  /** Nav group label */
  group: 'DBE/DoH' | 'School' | 'SP';
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

  if (
    t.includes('government') ||
    t === 'dbe' ||
    t === 'peu' ||
    t === 'doh' ||
    t === 'department_of_health' ||
    t === 'government_education' ||
    t === 'government_health'
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
    t === 'hospital' ||
    t === 'clinic' ||
    t.includes('school') ||
    t.includes('hospital') ||
    t.includes('clinic') ||
    t.includes('ecd')
  ) {
    return 'school';
  }
  return null;
}

export function infoForProgrammeRole(role: ProgrammeRole): ProgrammeRoleInfo {
  if (role === 'department') {
    return {
      role: 'department',
      group: 'DBE/DoH',
      label: 'Department (DBE / DoH)',
      homePath: '/dashboard/schools/agency',
    };
  }
  if (role === 'sp') {
    return {
      role: 'sp',
      group: 'SP',
      label: 'Service Provider',
      homePath: '/dashboard/schools/deliveries',
    };
  }
  return {
    role: 'school',
    group: 'School',
    label: 'School / facility',
    homePath: '/dashboard/schools',
  };
}

/**
 * Resolve which Schools-module navigation the company should see.
 * Prefers domain tables (agency / SP / school profile), then org_type.
 */
export async function resolveProgrammeRole(
  supabase: SupabaseClient,
  companyId: number
): Promise<ProgrammeRoleInfo> {
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

  // Domain tables win (most specific)
  if (agency && agency.status !== 'inactive') {
    return infoForProgrammeRole('department');
  }
  if (isp) {
    return infoForProgrammeRole('sp');
  }
  if (school) {
    return infoForProgrammeRole('school');
  }

  const fromOrg = programmeRoleFromOrgType(
    prof?.org_type != null ? String(prof.org_type) : null,
    prof?.business_type != null ? String(prof.business_type) : null
  );
  if (fromOrg) return infoForProgrammeRole(fromOrg);

  // Default: school-facing programme (facility join flow)
  return infoForProgrammeRole('school');
}

/** Which nav groups a role may see (only their own tool). */
export function navGroupsForRole(role: ProgrammeRole): string[] {
  if (role === 'department') return ['DBE/DoH', 'DBE'];
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
