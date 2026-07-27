/**
 * Health programme roles (standalone DoH module):
 *   department (DoH) · facility (clinic / hospital) · sp (service provider)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  familyForAgencyType,
  familyForFacilityType,
} from '@/lib/entities/programme-hierarchy';

export type HealthProgrammeRole = 'department' | 'facility' | 'sp';

export type HealthProgrammeRoleInfo = {
  role: HealthProgrammeRole;
  group: 'DoH' | 'Facility' | 'SP';
  label: string;
  homePath: string;
};

export function healthRoleFromOrgType(
  orgType?: string | null,
  businessType?: string | null
): HealthProgrammeRole | null {
  const t = String(orgType || businessType || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (
    t === 'doh' ||
    t === 'department_of_health' ||
    t === 'government_health' ||
    t === 'provincial_health' ||
    (t.includes('health') && t.includes('government'))
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
  if (
    t === 'hospital' ||
    t === 'clinic' ||
    t.includes('hospital') ||
    t.includes('clinic')
  ) {
    return 'facility';
  }
  return null;
}

export function infoForHealthRole(
  role: HealthProgrammeRole
): HealthProgrammeRoleInfo {
  if (role === 'department') {
    return {
      role: 'department',
      group: 'DoH',
      label: 'Department of Health',
      homePath: '/dashboard/health/agency',
    };
  }
  if (role === 'sp') {
    return {
      role: 'sp',
      group: 'SP',
      label: 'Service Provider (health)',
      homePath: '/dashboard/health/join',
    };
  }
  return {
    role: 'facility',
    group: 'Facility',
    label: 'Clinic / hospital',
    homePath: '/dashboard/health',
  };
}

/**
 * Resolve Health-module role for a company.
 * Only health-family agencies/facilities qualify as department/facility here.
 */
export async function resolveHealthProgrammeRole(
  supabase: SupabaseClient,
  companyId: number
): Promise<HealthProgrammeRoleInfo> {
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

  if (
    agency &&
    agency.status !== 'inactive' &&
    familyForAgencyType(String(agency.agency_type || '')) === 'health'
  ) {
    return infoForHealthRole('department');
  }

  if (
    school &&
    familyForFacilityType(
      school.member_type != null ? String(school.member_type) : 'hospital'
    ) === 'health'
  ) {
    return infoForHealthRole('facility');
  }

  if (isp) {
    // SPs may work both programmes — health module shows SP tools when enabled
    return infoForHealthRole('sp');
  }

  const fromOrg = healthRoleFromOrgType(
    prof?.org_type != null ? String(prof.org_type) : null,
    prof?.business_type != null ? String(prof.business_type) : null
  );
  if (fromOrg) return infoForHealthRole(fromOrg);

  return infoForHealthRole('facility');
}

export function navGroupsForHealthRole(role: HealthProgrammeRole): string[] {
  if (role === 'department') return ['DoH'];
  if (role === 'sp') return ['SP'];
  return ['Facility'];
}

export function healthStepVisibleForRole(
  stepGroup: string | null | undefined,
  role: HealthProgrammeRole
): boolean {
  if (!stepGroup) return true;
  return navGroupsForHealthRole(role).includes(stepGroup);
}
