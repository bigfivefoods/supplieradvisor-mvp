/**
 * Separate organisation kinds on SupplierAdvisor.
 *
 * Programme model:
 * - Government education (DBE/PEU) owns catalogue & oversees schools
 * - Schools buy NSNP food from ISPs (under DBE association)
 * - ISPs supply schools and buy from normal wholesalers/businesses
 * - Government health + hospitals/clinics mirror the same pattern later
 * - Business/supplier = normal B2B trade (wholesalers etc.)
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
  provision: 'none' | 'school' | 'agency_education' | 'agency_health' | 'isp';
  badge: string;
  badgeClass: string;
};

export const ENTITY_DEFINITIONS: readonly EntityDefinition[] = [
  {
    id: 'business',
    business_type: 'business',
    org_type: 'business',
    label: 'Business / wholesaler',
    shortLabel: 'Business',
    description:
      'Manufacturer, distributor, wholesaler or retailer — sell to ISPs and other companies on the network.',
    group: 'trade',
    homePath: '/dashboard',
    modulePreset: 'trading',
    provision: 'none',
    badge: 'Trade',
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
    id: 'government_education',
    business_type: 'government_education',
    org_type: 'government_education',
    label: 'Department of Education (DBE / PEU)',
    shortLabel: 'DBE / PEU',
    description:
      'National, provincial or district education authority — approve schools, own approved foods list, PEU visits, claims & nutrition.',
    group: 'education',
    homePath: '/dashboard/schools',
    modulePreset: 'dbe_agency',
    provision: 'agency_education',
    badge: 'Gov · Education',
    badgeClass: 'bg-violet-100 text-violet-900 border-violet-200',
  },
  {
    id: 'school',
    business_type: 'school',
    org_type: 'school',
    label: 'School',
    shortLabel: 'School',
    description:
      'Public or independent school — join DBE/PEU, order from ISPs, kitchen, serve day, nutrition & claims.',
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
    label: 'NSNP Independent Service Provider (ISP)',
    shortLabel: 'ISP',
    description:
      'Deliver approved foods to schools. Buy from wholesalers on SupplierAdvisor; dispatch POD & invoices to schools.',
    group: 'education',
    homePath: '/dashboard/schools/isp',
    modulePreset: 'nsnp_isp',
    provision: 'isp',
    badge: 'ISP',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-200',
  },
  {
    id: 'government_health',
    business_type: 'government_health',
    org_type: 'government_health',
    label: 'Department of Health',
    shortLabel: 'DoH',
    description:
      'National or provincial health authority — oversee hospitals & clinics (same association model as education).',
    group: 'health',
    homePath: '/dashboard',
    modulePreset: 'starter',
    provision: 'agency_health',
    badge: 'Gov · Health',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-200',
  },
  {
    id: 'hospital',
    business_type: 'hospital',
    org_type: 'hospital',
    label: 'Hospital / clinic',
    shortLabel: 'Hospital',
    description:
      'Health facility under Department of Health — procurement & programme association (expanding).',
    group: 'health',
    homePath: '/dashboard',
    modulePreset: 'starter',
    provision: 'none',
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

export function entityGroups(): Array<{
  id: string;
  title: string;
  blurb: string;
  entities: EntityDefinition[];
}> {
  return [
    {
      id: 'education',
      title: 'Education programme (NSNP)',
      blurb:
        'Separate logins: DBE/PEU oversees · Schools order & feed · ISPs deliver from approved lists.',
      entities: ENTITY_DEFINITIONS.filter((e) => e.group === 'education'),
    },
    {
      id: 'health',
      title: 'Health programme',
      blurb:
        'Department of Health and hospitals/clinics — same multi-entity model as education.',
      entities: ENTITY_DEFINITIONS.filter((e) => e.group === 'health'),
    },
    {
      id: 'trade',
      title: 'Trade network',
      blurb:
        'Wholesalers, manufacturers and suppliers that ISPs (and others) buy from.',
      entities: ENTITY_DEFINITIONS.filter((e) => e.group === 'trade'),
    },
    {
      id: 'other',
      title: 'Other organisations',
      blurb: 'Associations, NGOs and impact organisations.',
      entities: ENTITY_DEFINITIONS.filter((e) => e.group === 'other'),
    },
  ];
}
