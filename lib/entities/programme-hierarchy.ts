/**
 * Programme hierarchy for education & health food programmes:
 *
 *   DBE / PEU  ──►  SPs  ──►  Schools
 *   DoH        ──►  SPs  ──►  Clinics & hospitals
 *
 * Agency owns the approved catalogue and must approve both SPs and facilities.
 * Facilities only order from SPs associated under the same agency.
 */

export type ProgrammeFamily = 'education' | 'health';

export type AgencyTypeKey =
  | 'dbe'
  | 'peu'
  | 'provincial_nsnp'
  | 'district'
  | 'department_of_health'
  | 'provincial_health'
  | 'other';

export type FacilityMemberType =
  | 'school'
  | 'hospital'
  | 'clinic'
  | 'ecd'
  | 'shelter'
  | 'other';

export const AGENCY_TYPES: Array<{
  id: AgencyTypeKey;
  label: string;
  family: ProgrammeFamily;
}> = [
  { id: 'dbe', label: 'Department of Basic Education (DBE)', family: 'education' },
  { id: 'peu', label: 'Provincial Education Unit (PEU)', family: 'education' },
  { id: 'provincial_nsnp', label: 'Provincial NSNP office', family: 'education' },
  { id: 'district', label: 'District education office', family: 'education' },
  {
    id: 'department_of_health',
    label: 'Department of Health (DoH)',
    family: 'health',
  },
  {
    id: 'provincial_health',
    label: 'Provincial health department',
    family: 'health',
  },
  { id: 'other', label: 'Other government agency', family: 'education' },
];

export const FACILITY_TYPES: Array<{
  id: FacilityMemberType;
  label: string;
  plural: string;
  family: ProgrammeFamily;
}> = [
  { id: 'school', label: 'School', plural: 'Schools', family: 'education' },
  { id: 'ecd', label: 'ECD centre', plural: 'ECD centres', family: 'education' },
  {
    id: 'hospital',
    label: 'Hospital',
    plural: 'Hospitals',
    family: 'health',
  },
  { id: 'clinic', label: 'Clinic', plural: 'Clinics', family: 'health' },
  {
    id: 'shelter',
    label: 'Shelter / care home',
    plural: 'Shelters',
    family: 'health',
  },
  { id: 'other', label: 'Other facility', plural: 'Other facilities', family: 'education' },
];

export function familyForAgencyType(
  agencyType?: string | null
): ProgrammeFamily {
  const t = String(agencyType || 'dbe').toLowerCase();
  if (
    t.includes('health') ||
    t === 'doh' ||
    t === 'department_of_health' ||
    t === 'provincial_health'
  ) {
    return 'health';
  }
  return 'education';
}

export function familyForFacilityType(
  memberType?: string | null
): ProgrammeFamily {
  const t = String(memberType || 'school').toLowerCase();
  if (['hospital', 'clinic', 'shelter', 'health_facility'].includes(t)) {
    return 'health';
  }
  return 'education';
}

export function facilityTypesForFamily(
  family: ProgrammeFamily
): Array<(typeof FACILITY_TYPES)[number]> {
  return FACILITY_TYPES.filter((f) => f.family === family || f.id === 'other');
}

export function facilityLabel(
  memberType?: string | null,
  opts?: { plural?: boolean }
): string {
  const t = String(memberType || 'school').toLowerCase();
  const def = FACILITY_TYPES.find((f) => f.id === t);
  if (!def) return opts?.plural ? 'Facilities' : 'Facility';
  return opts?.plural ? def.plural : def.label;
}

export function agencyLabel(agencyType?: string | null): string {
  const t = String(agencyType || 'dbe').toLowerCase();
  const def = AGENCY_TYPES.find((a) => a.id === t);
  if (def) return def.label;
  if (t.includes('health') || t === 'doh') return 'Department of Health';
  return 'Department of Basic Education';
}

/**
 * Facility may only join an agency in the same programme family
 * (schools → DBE/PEU; clinics/hospitals → DoH).
 */
export function facilityMayJoinAgency(
  memberType: string | null | undefined,
  agencyType: string | null | undefined
): { ok: boolean; reason?: string } {
  const ff = familyForFacilityType(memberType);
  const af = familyForAgencyType(agencyType);
  if (ff !== af) {
    return {
      ok: false,
      reason:
        ff === 'education'
          ? 'Schools join DBE / PEU (education), not Department of Health.'
          : 'Clinics and hospitals join Department of Health, not DBE/PEU.',
    };
  }
  return { ok: true };
}

/**
 * Hierarchy copy for UI / reports.
 */
export function programmeHierarchyBlurb(agencyType?: string | null): {
  family: ProgrammeFamily;
  agencyTitle: string;
  facilityPlural: string;
  facilitySingular: string;
  chain: string[];
  description: string;
} {
  const family = familyForAgencyType(agencyType);
  if (family === 'health') {
    return {
      family,
      agencyTitle: agencyLabel(agencyType || 'department_of_health'),
      facilityPlural: 'Clinics & hospitals',
      facilitySingular: 'Clinic / hospital',
      chain: ['DoH', 'SPs', 'Clinics & hospitals'],
      description:
        'Department of Health owns the approved list and must approve SPs and health facilities. SPs supply only clinics and hospitals under this department.',
    };
  }
  return {
    family,
    agencyTitle: agencyLabel(agencyType || 'dbe'),
    facilityPlural: 'Schools',
    facilitySingular: 'School',
    chain: ['DBE / PEU', 'SPs', 'Schools'],
    description:
      'DBE/PEU owns the approved foods list and must approve SPs and schools. SPs supply only schools under this department.',
  };
}

/** Default member_type for an entity kind at provision time */
export function defaultMemberTypeForEntity(
  entityId: string
): FacilityMemberType | null {
  if (entityId === 'school') return 'school';
  if (entityId === 'hospital') return 'hospital';
  return null;
}
