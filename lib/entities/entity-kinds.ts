/**
 * Organisation kinds on SupplierAdvisor.
 *
 * Signup lanes (order matters for UX):
 *   1) B2B — businesses trading on the network
 *   2) B2C — consumers buying on the marketplace
 *   3) B2G — government programme offices (last)
 */

import type { ModulePresetId } from '@/lib/business/company-modules';

export const ENTITY_KINDS = [
  'business',
  'supplier',
  'association',
  'school',
  'nsnp_isp',
  'hospital',
  'consumer_org',
  'consumer',
  'government_education',
  'government_health',
  'municipal_government',
  'provincial_government',
  'national_government',
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
  /** Signup grouping (legacy field; UI uses entityGroups lanes) */
  group: 'trade' | 'education' | 'health' | 'other' | 'consumer' | 'government';
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
  // ── B2B ────────────────────────────────────────────────────────────
  {
    id: 'business',
    business_type: 'business',
    org_type: 'business',
    label: 'Company / business',
    shortLabel: 'Company',
    description:
      'B2B company — manufacturer, distributor, wholesaler or retailer. Default for most people joining SupplierAdvisor.',
    group: 'trade',
    homePath: '/dashboard',
    modulePreset: 'trading',
    provision: 'none',
    badge: 'B2B',
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-200',
  },
  {
    id: 'supplier',
    business_type: 'supplier',
    org_type: 'supplier',
    label: 'Supplier (farm / raw materials)',
    shortLabel: 'Supplier',
    description:
      'B2B primary producer or raw-materials supplier selling into the trade network.',
    group: 'trade',
    homePath: '/dashboard',
    modulePreset: 'trading',
    provision: 'none',
    badge: 'B2B',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  },
  {
    id: 'association',
    business_type: 'association',
    org_type: 'association',
    label: 'Association / co-op',
    shortLabel: 'Association',
    description: 'B2B industry body, co-operative or member group.',
    group: 'other',
    homePath: '/dashboard',
    modulePreset: 'starter',
    provision: 'none',
    badge: 'B2B',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  {
    id: 'school',
    business_type: 'school',
    org_type: 'school',
    label: 'School',
    shortLabel: 'School',
    description:
      'School workspace: join DBE/PEU, order approved foods from SPs, kitchen, serve day, claims.',
    group: 'education',
    homePath: '/dashboard/schools',
    modulePreset: 'school_nsnp',
    provision: 'school',
    badge: 'B2B · School',
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-200',
  },
  {
    id: 'nsnp_isp',
    business_type: 'nsnp_isp',
    org_type: 'nsnp_isp',
    label: 'Service Provider (SP)',
    shortLabel: 'SP',
    description:
      'Programme service provider: supply schools with approved products; buy from wholesalers on the trade network.',
    group: 'education',
    homePath: '/dashboard/schools/isp',
    modulePreset: 'nsnp_isp',
    provision: 'isp',
    badge: 'B2B · SP',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-200',
  },
  {
    id: 'hospital',
    business_type: 'hospital',
    org_type: 'hospital',
    label: 'Hospital / clinic',
    shortLabel: 'Clinic / hospital',
    description: 'Health facility workspace on a health food programme.',
    group: 'health',
    homePath: '/dashboard/health',
    modulePreset: 'school_nsnp',
    provision: 'facility_health',
    badge: 'B2B · Facility',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  {
    id: 'consumer_org',
    business_type: 'consumer_org',
    org_type: 'consumer_org',
    label: 'Impact / NGO',
    shortLabel: 'NGO',
    description: 'Non-profit or regenerative organisation on the network.',
    group: 'other',
    homePath: '/dashboard',
    modulePreset: 'starter',
    provision: 'none',
    badge: 'B2B · Impact',
    badgeClass: 'bg-lime-100 text-lime-900 border-lime-200',
  },
  // ── B2C ────────────────────────────────────────────────────────────
  {
    id: 'consumer',
    business_type: 'consumer',
    org_type: 'consumer',
    label: 'Consumer (marketplace)',
    shortLabel: 'Consumer',
    description:
      'B2C — shop the marketplace as a buyer. Discover verified brands and buy products.',
    group: 'consumer',
    homePath: '/marketplace',
    modulePreset: 'starter',
    provision: 'none',
    badge: 'B2C',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200',
  },
  // ── B2G last ───────────────────────────────────────────────────────
  {
    id: 'government_education',
    business_type: 'government_education',
    org_type: 'government_education',
    label: 'Department of Education (DBE / PEU)',
    shortLabel: 'DBE / PEU',
    description:
      'B2G government education office: approve SPs and schools, catalogue, PEU visits, claims.',
    group: 'government',
    homePath: '/dashboard/schools',
    modulePreset: 'dbe_agency',
    provision: 'agency_education',
    badge: 'B2G',
    badgeClass: 'bg-violet-100 text-violet-900 border-violet-200',
  },
  {
    id: 'government_health',
    business_type: 'government_health',
    org_type: 'government_health',
    label: 'Department of Health',
    shortLabel: 'DoH',
    description:
      'B2G government health office: approve facilities and SPs for the health food programme.',
    group: 'government',
    homePath: '/dashboard/health',
    modulePreset: 'dbe_agency',
    provision: 'agency_health',
    badge: 'B2G',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-200',
  },
  // ── Public sector entity types (Core OS packaging 2026-08) ──────────
  {
    id: 'municipal_government',
    business_type: 'municipal_government',
    org_type: 'municipal_government',
    label: 'Municipal / Local Government',
    shortLabel: 'Municipal',
    description:
      'Local government — self-serve with public procurement and multi-entity tools.',
    group: 'government',
    homePath: '/dashboard',
    modulePreset: 'trading',
    provision: 'none',
    badge: 'B2G · Local',
    badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-200',
  },
  {
    id: 'provincial_government',
    business_type: 'provincial_government',
    org_type: 'provincial_government',
    label: 'Provincial Government',
    shortLabel: 'Provincial',
    description:
      'Provincial department — pack selection; specialist completes full setup.',
    group: 'government',
    homePath: '/dashboard',
    modulePreset: 'dbe_agency',
    provision: 'agency_education',
    badge: 'B2G · Province',
    badgeClass: 'bg-violet-100 text-violet-900 border-violet-200',
  },
  {
    id: 'national_government',
    business_type: 'national_government',
    org_type: 'national_government',
    label: 'National Government',
    shortLabel: 'National',
    description:
      'National department — pack selection; specialist completes full setup.',
    group: 'government',
    homePath: '/dashboard',
    modulePreset: 'dbe_agency',
    provision: 'agency_education',
    badge: 'B2G · National',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-200',
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
  if (t === 'doh' || t === 'health' || t === 'government_health') {
    return BY_ID.get('government_health')!;
  }
  if (t === 'clinic' || t === 'health_facility') {
    return BY_ID.get('hospital')!;
  }
  if (
    t === 'consumer' ||
    t === 'b2c' ||
    t === 'marketplace_buyer' ||
    t === 'shopper'
  ) {
    return BY_ID.get('consumer')!;
  }
  // Core OS packaging entity types
  if (t === 'private_company' || t === 'private' || t === 'company') {
    return BY_ID.get('business')!;
  }
  if (t === 'municipal' || t === 'local_government' || t === 'municipality') {
    return BY_ID.get('municipal_government')!;
  }
  if (t === 'provincial' || t === 'province') {
    return BY_ID.get('provincial_government')!;
  }
  if (t === 'national' || t === 'national_gov') {
    return BY_ID.get('national_government')!;
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
 * Signup / invite picker — strict order:
 * 1) B2B businesses
 * 2) B2C consumer marketplace
 * 3) B2G government agencies (last)
 */
export function entityGroups(): Array<{
  id: string;
  title: string;
  blurb: string;
  lane: 'b2b' | 'b2c' | 'b2g';
  entities: EntityDefinition[];
}> {
  const byId = (id: EntityKind) => BY_ID.get(id)!;
  return [
    {
      id: 'b2b',
      lane: 'b2b',
      title: 'Businesses (B2B)',
      blurb:
        'Companies, suppliers, schools, SPs and other organisations that buy and sell on the network. Most invitations start here.',
      entities: [
        byId('business'),
        byId('supplier'),
        byId('association'),
        byId('school'),
        byId('nsnp_isp'),
        byId('hospital'),
        byId('consumer_org'),
      ],
    },
    {
      id: 'b2c',
      lane: 'b2c',
      title: 'Consumer (B2C)',
      blurb:
        'Join as a consumer to buy on the marketplace — discover verified brands and shop products.',
      entities: [byId('consumer')],
    },
    {
      id: 'b2g',
      lane: 'b2g',
      title: 'Government agencies (B2G)',
      blurb:
        'Only for official government programme offices. Not for private companies.',
      entities: [byId('government_education'), byId('government_health')],
    },
  ];
}
