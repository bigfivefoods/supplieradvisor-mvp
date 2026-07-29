/**
 * Separate organisation kinds on SupplierAdvisor.
 *
 * Programme hierarchy:
 *
 *   DBE / PEU  →  SPs  →  Schools
 *   DoH        →  SPs  →  Clinics & hospitals
 *
 * Agency owns the approved catalogue and must approve SPs + facilities.
 * Facilities order only from SPs associated under the same agency.
 * SPs buy stock from normal wholesalers/businesses on the trade network.
 */

import type { ModulePresetId } from '@/lib/business/company-modules';

export const ENTITY_KINDS = [
  'business',
  'supplier',
  'government_education',
  'government_health',
  'school',
  'hospital',
  'nsnp_isp',
  'association',
  'consumer_org',
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

export type EntityDefinition = {
  id: EntityKind;
  /** Stored on profiles.business_type */
  business_type: string;
  /** Stored on profiles.org_type */
  org_type: string;
  label: string;
  shortLabel: string;
  description: string;
  /** Signup grouping */
  group: 'trade' | 'education' | 'health' | 'other';
  /** After login / select company */
  homePath: string;
  modulePreset: ModulePresetId;
  /** Soft provision NSNP domain rows on register */
  provision:
    | 'none'
    | 'school'
    | 'facility_health'
    | 'agency_education'
    | 'agency_health'
    | 'isp';
  badge: string;
  badgeClass: string;
};

export const ENTITY_DEFINITIONS: readonly EntityDefinition[] = [
  {
    id: 'business',
    business_type: 'business',
    org_type: 'business',
    label: 'Company / business',
    shortLabel: 'Company',
    description:
      'A normal company — manufacturer, distributor, wholesaler or retailer. Default for most people joining SupplierAdvisor.',
    group: 'trade',
    homePath: '/dashboard',
    modulePreset: 'trading',
    provision: 'none',
    badge: 'Company',
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-200',
  },
  {
    id: 'supplier',
    business_type: 'supplier',
    org_type: 'supplier',
    label: 'Supplier (farm / raw materials)',
    shortLabel: 'Supplier',
    description:
      'Primary producer or raw-materials supplier selling into the trade network.',
    group: 'trade',
    homePath: '/dashboard',
    modulePreset: 'trading',
    provision: 'none',
    badge: 'Supply',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  },
  {
    id: 'school',
    business_type: 'school',
    org_type: 'school',
    label: 'School',
    shortLabel: 'School',
    description:
      'NSNP school: join DBE/PEU, order approved foods from linked SPs, kitchen, serve day, claims.',
    group: 'education',
    homePath: '/dashboard/schools',
    modulePreset: 'school_nsnp',
    provision: 'school',
    badge: 'School',
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-200',
  },
  {
    id: 'nsnp_isp',
    business_type: 'nsnp_isp',
    org_type: 'nsnp_isp',
    label: 'Service Provider (SP)',
    shortLabel: 'SP',
    description:
      'NSNP service provider: join DBE/PEU, supply schools with approved products. Buy stock from wholesalers on the trade network.',
    group: 'education',
    homePath: '/dashboard/schools/isp',
    modulePreset: 'nsnp_isp',
    provision: 'isp',
    badge: 'SP',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-200',
  },
  {
    id: 'hospital',
    business_type: 'hospital',
    org_type: 'hospital',
    label: 'Hospital / clinic',
    shortLabel: 'Clinic / hospital',
    description:
      'Health facility workspace (separate Health module flows where configured).',
    group: 'health',
    homePath: '/dashboard/health',
    modulePreset: 'school_nsnp',
    provision: 'facility_health',
    badge: 'Health facility',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  {
    id: 'association',
    business_type: 'association',
    org_type: 'association',
    label: 'Association / co-op',
    shortLabel: 'Association',
    description: 'Industry body, co-operative or member group.',
    group: 'other',
    homePath: '/dashboard',
    modulePreset: 'starter',
    provision: 'none',
    badge: 'Association',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  {
    id: 'consumer_org',
    business_type: 'consumer_org',
    org_type: 'consumer_org',
    label: 'Impact / NGO',
    shortLabel: 'NGO',
    description: 'Non-profit or regenerative initiative.',
    group: 'other',
    homePath: '/dashboard',
    modulePreset: 'starter',
    provision: 'none',
    badge: 'Impact',
    badgeClass: 'bg-lime-100 text-lime-900 border-lime-200',
  },
  // Government last — only for official programme offices
  {
    id: 'government_education',
    business_type: 'government_education',
    org_type: 'government_education',
    label: 'Department of Education (DBE / PEU)',
    shortLabel: 'DBE / PEU',
    description:
      'Government education office: approve SPs and schools, publish the approved foods list, PEU visits, claims & nutrition.',
    group: 'education',
    homePath: '/dashboard/schools',
    modulePreset: 'dbe_agency',
    provision: 'agency_education',
    badge: 'Gov · Education',
    badgeClass: 'bg-violet-100 text-violet-900 border-violet-200',
  },
  {
    id: 'government_health',
    business_type: 'government_health',
    org_type: 'government_health',
    label: 'Department of Health',
    shortLabel: 'DoH',
    description:
      'Government health office (Health module): approve facilities and SPs for the health food programme.',
    group: 'health',
    homePath: '/dashboard/health',
    modulePreset: 'dbe_agency',
    provision: 'agency_health',
    badge: 'Gov · Health',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-200',
  },
] as const;

const BY_ID = new Map(ENTITY_DEFINITIONS.map((e) => [e.id, e]));
const BY_BUSINESS = new Map(
  ENTITY_DEFINITIONS.map((e) => [e.business_type, e])
);
const BY_ORG = new Map(ENTITY_DEFINITIONS.map((e) => [e.org_type, e]));

/** Map legacy + new type strings to entity definition */
export function resolveEntityKind(
  raw?: string | null
): EntityDefinition {
  const t = String(raw || 'business')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (BY_ID.has(t as EntityKind)) return BY_ID.get(t as EntityKind)!;
  if (BY_BUSINESS.has(t)) return BY_BUSINESS.get(t)!;
  if (BY_ORG.has(t)) return BY_ORG.get(t)!;

  // Legacy aliases
  if (t === 'government' || t === 'gov' || t === 'dbe' || t === 'peu') {
    return BY_ID.get('government_education')!;
  }
  if (t === 'isp' || t === 'service_provider') {
    return BY_ID.get('nsnp_isp')!;
  }
  if (t === 'education' || t === 'school_nsnp') {
    return BY_ID.get('school')!;
  }
  if (t === 'doh' || t === 'health') {
    return BY_ID.get('government_health')!;
  }
  if (t === 'clinic' || t === 'health_facility') {
    return BY_ID.get('hospital')!;
  }

  return BY_ID.get('business')!;
}

export function homePathForEntity(
  businessType?: string | null,
  orgType?: string | null
): string {
  if (orgType) {
    const byOrg = BY_ORG.get(String(orgType).toLowerCase());
    if (byOrg) return byOrg.homePath;
  }
  return resolveEntityKind(businessType || orgType).homePath;
}

/**
 * Signup / invite picker order:
 * 1) Normal company & trade (default)
 * 2) Schools programme operators (school, SP)
 * 3) Health facilities
 * 4) Other orgs
 * 5) Government agencies last
 */
export function entityGroups(): Array<{
  id: string;
  title: string;
  blurb: string;
  entities: EntityDefinition[];
}> {
  const byId = (id: EntityKind) => BY_ID.get(id)!;
  return [
    {
      id: 'trade',
      title: 'Company & trade network',
      blurb:
        'Start here if you are a normal company. Most invitations register a company that trades on SupplierAdvisor.',
      entities: [byId('business'), byId('supplier')],
    },
    {
      id: 'education',
      title: 'Schools programme',
      blurb:
        'Schools and service providers on the National School Nutrition Programme (under DBE / PEU).',
      entities: [byId('school'), byId('nsnp_isp')],
    },
    {
      id: 'health',
      title: 'Health facilities',
      blurb: 'Clinics and hospitals on a health food programme.',
      entities: [byId('hospital')],
    },
    {
      id: 'other',
      title: 'Other organisations',
      blurb: 'Associations, co-ops, NGOs and impact organisations.',
      entities: [byId('association'), byId('consumer_org')],
    },
    {
      id: 'government',
      title: 'Government agencies',
      blurb:
        'Only for official government programme offices (education or health). Not for private companies.',
      entities: [byId('government_education'), byId('government_health')],
    },
  ];
}
