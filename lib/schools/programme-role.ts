/**
 * Programme role under the Schools module (education / NSNP only):
 *   department (DBE / PEU) · school · sp (service provider)
 *
 * Department of Health is a separate module: /dashboard/health
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

  // Health departments belong in the Health module — not Schools department
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
  // Hospitals/clinics are Health module facilities
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
      label: 'Department (DBE / PEU)',
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
    label: 'School',
    homePath: '/dashboard/schools',
  };
}

/**
 * Resolve which Schools-module navigation the company should see.
 * Prefers domain tables (education agency / SP / school profile), then org_type.
 * Health (DoH) agencies do NOT resolve as Schools department.
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

  // Education agencies only for Schools department role
  if (
    agency &&
    agency.status !== 'inactive' &&
    familyForAgencyType(String(agency.agency_type || 'dbe')) === 'education'
  ) {
    return infoForProgrammeRole('department');
  }

  if (isp) {
    return infoForProgrammeRole('sp');
  }

  // School facilities only (not hospital/clinic)
  if (school) {
    const mt = String(school.member_type || 'school').toLowerCase();
    if (['hospital', 'clinic', 'shelter'].includes(mt)) {
      // Health facility — default school nav would be wrong; still allow SP/school fallback
      // Prefer not treating as school department
    } else {
      return infoForProgrammeRole('school');
    }
  }

  const fromOrg = programmeRoleFromOrgType(
    prof?.org_type != null ? String(prof.org_type) : null,
    prof?.business_type != null ? String(prof.business_type) : null
  );
  if (fromOrg) return infoForProgrammeRole(fromOrg);

  // Default: school-facing programme
  return infoForProgrammeRole('school');
}

/** Which nav groups a role may see (only their own tool). */
export function navGroupsForRole(role: ProgrammeRole): string[] {
  if (role === 'department') return ['DBE', 'DBE/DoH']; // keep legacy group match during transition
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
