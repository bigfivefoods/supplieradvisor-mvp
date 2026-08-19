/**
 * Core OS → Sector → Industry Pack → Modules → Bespoke
 * Single source of truth for packaging (brief 2026-08-09).
 */
import { addAdvisorPackUnlocks } from '@/lib/product/advisor-core-unlocks';

/**
 * South African national government departments (Cabinet / gov.za aligned).
 * Product surfaces: Education → Schools hub; Health → Health hub;
 * others use Core public-sector tools (network, intelligence, procurement).
 * Source shape: official national departments list (GNU-era portfolio names).
 */
export const SA_NATIONAL_DEPARTMENTS = [
  {
    id: 'doe_basic',
    abbr: 'DoE / DBE',
    name: 'Department of Education (DoE) — Basic Education',
    focus:
      'National education policy, NSNP standards, catalogue and multi-province school nutrition oversight.',
    moduleIds: ['schools', 'intelligence', 'network'] as const,
    featured: true,
  },
  {
    id: 'dhet',
    abbr: 'DHET',
    name: 'Department of Higher Education and Training',
    focus: 'Universities, TVET, skills and post-school education.',
    moduleIds: ['intelligence', 'network'] as const,
    featured: true,
  },
  {
    id: 'doh',
    abbr: 'DoH',
    name: 'Department of Health',
    focus:
      'National health programme — clinics, hospitals, approved foods & nutrition pathways.',
    moduleIds: ['health', 'intelligence', 'network'] as const,
    featured: true,
  },
  {
    id: 'agriculture',
    abbr: 'DoA',
    name: 'Department of Agriculture',
    focus: 'Primary production, food security and agricultural markets.',
    moduleIds: ['suppliers', 'network', 'sustainability'] as const,
  },
  {
    id: 'land_rural',
    abbr: 'DALRRD',
    name: 'Department of Land Reform and Rural Development',
    focus: 'Land reform, rural development and spatial justice.',
    moduleIds: ['network', 'intelligence'] as const,
  },
  {
    id: 'dcdt',
    abbr: 'DCDT',
    name: 'Department of Communications and Digital Technologies',
    focus: 'ICT policy, digital infrastructure and communications.',
    moduleIds: ['intelligence', 'network'] as const,
  },
  {
    id: 'cogta',
    abbr: 'CoGTA',
    name: 'Department of Cooperative Governance and Traditional Affairs',
    focus: 'Municipal oversight, disaster management and traditional affairs.',
    moduleIds: ['network', 'intelligence', 'quality'] as const,
  },
  {
    id: 'correctional',
    abbr: 'DCS',
    name: 'Department of Correctional Services',
    focus: 'Correctional facilities and rehabilitation programmes.',
    moduleIds: ['operations', 'network'] as const,
  },
  {
    id: 'defence',
    abbr: 'DoD',
    name: 'Department of Defence and Military Veterans',
    focus: 'Defence, military veterans and related supply chains.',
    moduleIds: ['operations', 'network', 'quality'] as const,
  },
  {
    id: 'labour',
    abbr: 'DEL',
    name: 'Department of Employment and Labour',
    focus: 'Labour market, inspections and employment services.',
    moduleIds: ['people', 'network'] as const,
  },
  {
    id: 'energy',
    abbr: 'DMRE-E',
    name: 'Department of Electricity and Energy',
    focus: 'Electricity, energy policy and security of supply.',
    moduleIds: ['operations', 'intelligence'] as const,
  },
  {
    id: 'dffe',
    abbr: 'DFFE',
    name: 'Department of Forestry, Fisheries and the Environment',
    focus: 'Environment, climate, forestry and fisheries.',
    moduleIds: ['sustainability', 'intelligence'] as const,
  },
  {
    id: 'dha',
    abbr: 'DHA',
    name: 'Department of Home Affairs',
    focus: 'Civic services, immigration and identity systems.',
    moduleIds: ['network', 'intelligence'] as const,
  },
  {
    id: 'human_settlements',
    abbr: 'DHS',
    name: 'Department of Human Settlements',
    focus: 'Housing, human settlements and spatial development.',
    moduleIds: ['projects', 'network'] as const,
  },
  {
    id: 'dirco',
    abbr: 'DIRCO',
    name: 'Department of International Relations and Cooperation',
    focus: 'Foreign policy, missions and international cooperation.',
    moduleIds: ['network', 'intelligence'] as const,
  },
  {
    id: 'justice',
    abbr: 'DoJ&CD',
    name: 'Department of Justice and Constitutional Development',
    focus: 'Courts, constitutional development and legal services.',
    moduleIds: ['network', 'quality'] as const,
  },
  {
    id: 'mineral_petroleum',
    abbr: 'DMPR',
    name: 'Department of Mineral and Petroleum Resources',
    focus: 'Mining, petroleum resources and related regulation.',
    moduleIds: ['suppliers', 'sustainability', 'intelligence'] as const,
  },
  {
    id: 'dpme',
    abbr: 'DPME',
    name: 'Department of Planning, Monitoring and Evaluation',
    focus: 'Government planning, monitoring and evaluation.',
    moduleIds: ['intelligence', 'projects'] as const,
  },
  {
    id: 'police',
    abbr: 'SAPS / CSPS',
    name: 'Department of Police (incl. Civilian Secretariat)',
    focus: 'Policing policy, civilian oversight and safety.',
    moduleIds: ['network', 'intelligence'] as const,
  },
  {
    id: 'dpsa',
    abbr: 'DPSA',
    name: 'Department of Public Service and Administration',
    focus: 'Public service norms, HR and administration.',
    moduleIds: ['people', 'network'] as const,
  },
  {
    id: 'dpwi',
    abbr: 'DPWI',
    name: 'Department of Public Works and Infrastructure',
    focus: 'Public works, infrastructure and facilities management.',
    moduleIds: ['projects', 'operations', 'network'] as const,
  },
  {
    id: 'dsti',
    abbr: 'DSTI',
    name: 'Department of Science, Technology and Innovation',
    focus: 'Science, research, technology and innovation systems.',
    moduleIds: ['intelligence', 'network'] as const,
  },
  {
    id: 'dsd',
    abbr: 'DSD',
    name: 'Department of Social Development',
    focus: 'Social grants policy interface, welfare and community development.',
    moduleIds: ['network', 'intelligence'] as const,
  },
  {
    id: 'dsac',
    abbr: 'DSAC',
    name: 'Department of Sport, Arts and Culture',
    focus: 'Sport, arts, culture and heritage.',
    moduleIds: ['network', 'projects'] as const,
  },
  {
    id: 'tourism',
    abbr: 'Tourism',
    name: 'Department of Tourism',
    focus: 'Tourism growth, destination marketing support and sector supply.',
    moduleIds: ['network', 'suppliers'] as const,
  },
  {
    id: 'dtic',
    abbr: 'the dtic',
    name: 'Department of Trade, Industry and Competition',
    focus: 'Industrial policy, trade, competition and enterprise development.',
    moduleIds: ['suppliers', 'customers', 'intelligence'] as const,
  },
  {
    id: 'transport',
    abbr: 'DoT',
    name: 'Department of Transport',
    focus: 'Transport policy, logistics corridors and modal regulation.',
    moduleIds: ['distribution', 'operations', 'network'] as const,
  },
  {
    id: 'water',
    abbr: 'DWS',
    name: 'Department of Water and Sanitation',
    focus: 'Water resources, sanitation and infrastructure programmes.',
    moduleIds: ['operations', 'projects', 'sustainability'] as const,
  },
  {
    id: 'dwypd',
    abbr: 'DWYPD',
    name: 'Department of Women, Youth and Persons with Disabilities',
    focus: 'Women, youth and disability rights and empowerment programmes.',
    moduleIds: ['network', 'people'] as const,
  },
  {
    id: 'small_business',
    abbr: 'DSBD',
    name: 'Department of Small Business Development',
    focus: 'SMME support, informal economy and enterprise development.',
    moduleIds: ['suppliers', 'customers', 'network'] as const,
  },
  {
    id: 'treasury',
    abbr: 'NT',
    name: 'National Treasury',
    focus: 'Public finance, budget, procurement policy and PFMA oversight.',
    moduleIds: ['accounting', 'intelligence', 'network'] as const,
    featured: true,
  },
  {
    id: 'presidency',
    abbr: 'Presidency',
    name: 'The Presidency',
    focus: 'Presidency coordination, Cabinet support and national priorities.',
    moduleIds: ['intelligence', 'network'] as const,
  },
  {
    id: 'gcis',
    abbr: 'GCIS',
    name: 'Government Communication and Information System',
    focus: 'Government communications and public information.',
    moduleIds: ['network', 'intelligence'] as const,
  },
] as const;

export type SaNationalDepartmentId =
  (typeof SA_NATIONAL_DEPARTMENTS)[number]['id'];

export function getSaNationalDepartment(id: string | null | undefined) {
  return SA_NATIONAL_DEPARTMENTS.find((d) => d.id === id) || null;
}

/** Featured national programmes (DoE, DoH, Treasury, control) + full catalogue reference */
function nationalProgrammesFromDepartments() {
  const control = {
    id: 'national_policy',
    name: 'National programme control',
    description:
      'Multi-entity group structure, intelligence, and public procurement pathways for any national department.',
    moduleIds: ['intelligence', 'network'] as const,
    chips: ['Multi-entity', 'Intelligence', 'Public procurement'],
  };
  const fromDepts = SA_NATIONAL_DEPARTMENTS.filter(
    (d) => 'featured' in d && d.featured
  ).map((d) => ({
    id: `national_${d.id}`,
    name: d.name,
    description: d.focus,
    moduleIds: d.moduleIds,
    chips: [d.abbr, 'National department'] as string[],
  }));
  return [control, ...fromDepts] as const;
}

/**
 * Public Sector spheres (SA-aligned).
 * National → Provincial → Municipal → Local (schools / facilities).
 */
export const PUBLIC_SECTOR_TIERS = [
  {
    id: 'national',
    label: 'National',
    description:
      'South African national government departments — DoE, DoH, Treasury and full Cabinet portfolio list. Policy, catalogue standards, multi-entity oversight.',
    /** OS entity type this tier maps to */
    entityTypeId: 'national' as const,
    programmes: nationalProgrammesFromDepartments(),
    /** Full national department catalogue (all SA national departments) */
    nationalDepartments: SA_NATIONAL_DEPARTMENTS,
  },
  {
    id: 'provincial',
    label: 'Provincial',
    description:
      'Provincial departments and PEUs — programme approval, visits, claims, multi-school oversight.',
    entityTypeId: 'provincial' as const,
    programmes: [
      {
        id: 'provincial_dbe',
        name: 'DBE / Provincial Education (NSNP)',
        description:
          'Provincial Education / PEU tools under national DoE policy — approve schools, catalogue, visits, claims, multi-school nutrition. Not a school kitchen.',
        moduleIds: ['schools'] as const,
        chips: ['DBE', 'PEU', 'NSNP agency', 'Catalogue', 'Claims'],
      },
      {
        id: 'provincial_health',
        name: 'Provincial Health',
        description:
          'Provincial health programme oversight for facilities on DoH pathways.',
        moduleIds: ['health'] as const,
        chips: ['DoH provincial', 'Facilities'],
      },
    ],
    nationalDepartments: null,
  },
  {
    id: 'municipal',
    label: 'Municipal',
    description:
      'Municipal / metro government — public procurement, compliance, and local supply chains.',
    entityTypeId: 'municipal' as const,
    programmes: [
      {
        id: 'municipal_procure',
        name: 'Municipal procurement & compliance',
        description:
          'Public procurement, quality/SHEQ trails, and supplier networks for the municipality.',
        moduleIds: ['suppliers', 'quality', 'sheq', 'network'] as const,
        chips: ['Procurement', 'Compliance', 'Suppliers'],
      },
    ],
    nationalDepartments: null,
  },
  {
    id: 'local',
    label: 'Local',
    description:
      'Local service sites — schools (NSNP kitchens), clinics and facilities that order and serve.',
    entityTypeId: 'school' as const,
    programmes: [
      {
        id: 'local_schools',
        name: 'SchoolAdvisor® (NSNP kitchen)',
        description:
          'SchoolAdvisor® kitchen workspace — learners, approved brands, SPs, feeding calendar, serve day, prizes. Local NSNP site under public-sector government process (not private company packaging).',
        moduleIds: ['schools'] as const,
        chips: ['SchoolAdvisor', 'Kitchen', 'Serve day', 'NSNP local'],
      },
      {
        id: 'local_health',
        name: 'Clinic / hospital facility',
        description:
          'Health facility kitchen and ordering on DoH approved foods.',
        moduleIds: ['health'] as const,
        chips: ['Clinic', 'Hospital', 'Facility'],
      },
    ],
    nationalDepartments: null,
  },
] as const;

export type PublicSectorTierId = (typeof PUBLIC_SECTOR_TIERS)[number]['id'];

/** Onboarding entity type (step 1) */
export const OS_ENTITY_TYPES = [
  {
    id: 'private_company',
    label: 'Private Company',
    shortLabel: 'Private',
    description: 'Manufacturer, distributor, wholesaler, retailer, or services firm.',
    /** profiles.business_type */
    businessType: 'business',
    setupPath: 'self_serve' as const,
    publicSector: false,
    publicSectorTier: null as PublicSectorTierId | null,
  },
  {
    id: 'national',
    label: 'National',
    shortLabel: 'National',
    description:
      'National government department or agency — policy, multi-entity, specialist setup.',
    businessType: 'national_government',
    setupPath: 'contact_required' as const,
    publicSector: true,
    publicSectorTier: 'national' as PublicSectorTierId,
  },
  {
    id: 'provincial',
    label: 'Provincial',
    shortLabel: 'Provincial',
    description:
      'Provincial department (incl. DBE / PEU) — programme control; specialist setup.',
    businessType: 'provincial_government',
    setupPath: 'contact_required' as const,
    publicSector: true,
    publicSectorTier: 'provincial' as PublicSectorTierId,
  },
  {
    id: 'municipal',
    label: 'Municipal',
    shortLabel: 'Municipal',
    description:
      'Municipal / metro government — public procurement and local supply chains.',
    businessType: 'municipal_government',
    setupPath: 'self_serve' as const,
    publicSector: true,
    publicSectorTier: 'municipal' as PublicSectorTierId,
  },
  {
    id: 'school',
    label: 'Local — SchoolAdvisor school',
    shortLabel: 'School',
    description:
      'SchoolAdvisor® local kitchen & NSNP site — always Public Sector (government process), not private OS packaging.',
    businessType: 'school',
    setupPath: 'self_serve' as const,
    publicSector: true,
    publicSectorTier: 'local' as PublicSectorTierId,
  },
] as const;

export type OsEntityTypeId = (typeof OS_ENTITY_TYPES)[number]['id'];
export type SetupPath = 'self_serve' | 'contact_required';

export function getPublicSectorTier(id: string | null | undefined) {
  return PUBLIC_SECTOR_TIERS.find((t) => t.id === id) || null;
}

/** Map entity type → public sector tier id */
export function publicSectorTierForEntity(
  entityTypeId: string | null | undefined
): PublicSectorTierId | null {
  const e = OS_ENTITY_TYPES.find((x) => x.id === entityTypeId);
  return e?.publicSectorTier ?? null;
}

export const OS_SECTORS = [
  {
    id: 'primary',
    label: 'Primary',
    description: 'Agriculture, mining, fishing, forestry, extractives.',
  },
  {
    id: 'secondary',
    label: 'Secondary',
    description: 'Manufacturing, processing, construction, utilities.',
  },
  {
    id: 'tertiary',
    label: 'Tertiary / Services',
    description: 'Trade, logistics, professional services, hospitality.',
  },
  {
    id: 'quaternary',
    label: 'Quaternary',
    description: 'Knowledge, tech, R&D, education services, professional IQ.',
  },
  {
    id: 'public_sector',
    label: 'Public Sector',
    description:
      'Government and publicly funded programmes — National, Provincial, Municipal, and Local.',
  },
] as const;

export type OsSectorId = (typeof OS_SECTORS)[number]['id'];

/** Core OS monthly ZAR */
export const CORE_OS_MONTHLY_ZAR = 299;
/** Each Industry Pack monthly ZAR */
export const INDUSTRY_PACK_MONTHLY_ZAR = 199;

export type IndustryModuleDef = {
  id: string;
  name: string;
  description: string;
  /** App module ids unlocked (sidebar MODULE_NAV ids) */
  unlocks: string[];
};

export type IndustryPackDef = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  monthlyZar: number;
  priority: 1 | 2;
  /** Sectors where this pack is strongly recommended */
  recommendSectors: OsSectorId[];
  /** Entity types where this pack is strongly recommended */
  recommendEntities: OsEntityTypeId[];
  modules: IndustryModuleDef[];
  /** Feature flags / Industry Tools hub keys */
  industryToolsHrefs: Array<{ name: string; href: string; desc?: string }>;
};

/** Priority 1 Industry Packs */
export const INDUSTRY_PACKS: readonly IndustryPackDef[] = [
  {
    id: 'agri_regen',
    name: 'Agri & Regenerative',
    shortName: 'Agri',
    description:
      'Primary production, regenerative practices, farm-to-buyer traceability, and supplier networks.',
    monthlyZar: INDUSTRY_PACK_MONTHLY_ZAR,
    priority: 1,
    recommendSectors: ['primary'],
    recommendEntities: ['private_company'],
    modules: [
      {
        id: 'agri_fieldgraph',
        name: 'CropAdvisor® production OS',
        description:
          'Multi-crop fields, estimates, harvest plan, inputs, fleet, labour, regen.',
        unlocks: ['fieldgraph', 'suppliers', 'inventory'],
      },
      {
        id: 'agri_farm_book',
        name: 'Farm & grower book',
        description: 'Grower profiles, seasons, and farm supplier book.',
        unlocks: ['suppliers', 'network', 'fieldgraph'],
      },
      {
        id: 'agri_trace',
        name: 'Lot & origin trace',
        description: 'Lots, origin, and batch handoff into inventory.',
        unlocks: ['inventory', 'sustainability', 'fieldgraph'],
      },
      {
        id: 'agri_regen_metrics',
        name: 'Regen metrics',
        description: 'Soil, water, and impact metrics for buyers.',
        unlocks: ['sustainability', 'intelligence', 'fieldgraph'],
      },
    ],
    industryToolsHrefs: [
      { name: 'CropAdvisor®', href: '/dashboard/fieldgraph', desc: 'Primary production OS' },
      { name: 'Fields', href: '/dashboard/fieldgraph/fields', desc: 'Field book' },
      { name: 'Harvest plan', href: '/dashboard/fieldgraph/harvest', desc: 'Cut sequence' },
      { name: 'Supplier book', href: '/dashboard/suppliers/network', desc: 'Growers & farms' },
      { name: 'Source growers', href: '/dashboard/suppliers/discover', desc: 'Find primary suppliers' },
      { name: 'Lots & stock', href: '/dashboard/inventory/lots', desc: 'Origin batches' },
      { name: 'Inventory', href: '/dashboard/inventory/stock', desc: 'On-hand' },
      { name: 'Impact / ESG', href: '/dashboard/sustainability', desc: 'Regen metrics' },
      { name: 'Intelligence', href: '/dashboard/intelligence', desc: 'Pulse & scores' },
    ],
  },
  {
    id: 'quarry_aggregates',
    name: 'Quarrying & Aggregates',
    shortName: 'Quarry',
    description:
      'Primary extractives: pits, reserves, production, crushing, weighbridge dispatch, fleet, QA and permits.',
    monthlyZar: INDUSTRY_PACK_MONTHLY_ZAR,
    priority: 1,
    recommendSectors: ['primary'],
    recommendEntities: ['private_company'],
    modules: [
      {
        id: 'qg_os',
        name: 'QuarryAdvisor® production OS',
        description:
          'Sites, products, reserves, production plan, plant, dispatch, fleet, labour, QA, compliance.',
        unlocks: ['quarrygraph', 'inventory', 'customers', 'distribution'],
      },
      {
        id: 'qg_dispatch_trade',
        name: 'Dispatch & trade',
        description: 'Weighbridge tickets into customer and logistics flows.',
        unlocks: ['quarrygraph', 'customers', 'distribution', 'network'],
      },
      {
        id: 'qg_sheq_quality',
        name: 'SHEQ & product quality',
        description: 'Lab QA, permits and safety alignment.',
        unlocks: ['quarrygraph', 'quality', 'sheq'],
      },
      {
        id: 'qg_impact',
        name: 'Extractives impact',
        description: 'ESG, water and progressive rehabilitation metrics.',
        unlocks: ['sustainability', 'intelligence', 'quarrygraph'],
      },
    ],
    industryToolsHrefs: [
      { name: 'QuarryAdvisor®', href: '/dashboard/quarrygraph', desc: 'Quarry OS' },
      { name: 'Sites', href: '/dashboard/quarrygraph/sites', desc: 'Pits & faces' },
      { name: 'Production', href: '/dashboard/quarrygraph/production', desc: 'Plan & blasts' },
      { name: 'Dispatch', href: '/dashboard/quarrygraph/dispatch', desc: 'Weighbridge' },
      { name: 'Compliance', href: '/dashboard/quarrygraph/compliance', desc: 'Permits' },
      { name: 'Customers', href: '/dashboard/customers', desc: 'Offtake' },
      { name: 'Inventory', href: '/dashboard/inventory/stock', desc: 'Lots & stock' },
      { name: 'Ship', href: '/dashboard/distribution', desc: 'Haul logistics' },
    ],
  },
  {
    id: 'food_bev_mfg',
    name: 'Food & Beverage Manufacturing',
    shortName: 'Food Mfg',
    description:
      'BOM/MRP, production, quality holds, food safety, and brand-compliant supply.',
    monthlyZar: INDUSTRY_PACK_MONTHLY_ZAR,
    priority: 1,
    recommendSectors: ['secondary'],
    recommendEntities: ['private_company'],
    modules: [
      {
        id: 'fbm_mps_mrp',
        name: 'MPS / MRP',
        description: 'Master schedule and material requirements.',
        unlocks: ['manufacturing', 'inventory'],
      },
      {
        id: 'fbm_qa',
        name: 'Food QA & holds',
        description: 'Inspections, holds, and release.',
        unlocks: ['quality', 'sheq'],
      },
      {
        id: 'fbm_brand',
        name: 'Brand & catalogue',
        description: 'Approved products and customer catalogue fidelity.',
        unlocks: ['customers', 'inventory'],
      },
    ],
    industryToolsHrefs: [
      { name: 'Make hub', href: '/dashboard/manufacturing', desc: 'MPS · MRP · BOM' },
      { name: 'MPS', href: '/dashboard/manufacturing/master-production-schedules', desc: 'Schedule' },
      { name: 'MRP', href: '/dashboard/manufacturing/mrp', desc: 'Material plan' },
      { name: 'BOM', href: '/dashboard/manufacturing/bills-of-materials', desc: 'Recipes' },
      { name: 'Production', href: '/dashboard/manufacturing/production-orders', desc: 'Runs' },
      { name: 'QA holds', href: '/dashboard/quality', desc: 'Inspections' },
      { name: 'SHEQ', href: '/dashboard/sheq', desc: 'Safety & NCR' },
      { name: 'Customer catalogue', href: '/dashboard/customers', desc: 'Brand fidelity' },
      { name: 'Inventory', href: '/dashboard/inventory', desc: 'RM & FG stock' },
    ],
  },
  {
    id: 'logistics_containers',
    name: 'Logistics, Distribution & Containers',
    shortName: 'Logistics',
    description:
      'Inbound/outbound logistics, carriers, container outlets, and distribution control.',
    monthlyZar: INDUSTRY_PACK_MONTHLY_ZAR,
    priority: 1,
    recommendSectors: ['tertiary', 'secondary'],
    recommendEntities: ['private_company', 'municipal'],
    modules: [
      {
        id: 'log_dist',
        name: 'Distribution tower',
        description: 'Inbound, outbound, carriers.',
        unlocks: ['distribution', 'operations'],
      },
      {
        id: 'log_containers',
        name: 'Container outlets',
        description: 'Container network, resellers, impact.',
        unlocks: ['containers'],
      },
      {
        id: 'log_inventory',
        name: 'DC stock',
        description: 'Warehouse stock and transfers.',
        unlocks: ['inventory'],
      },
    ],
    industryToolsHrefs: [
      { name: 'Containers command', href: '/dashboard/containers', desc: 'Full container OS' },
      { name: 'Manage outlets', href: '/dashboard/containers/manage', desc: 'Sites' },
      { name: 'Map', href: '/dashboard/containers/map', desc: 'Network map' },
      { name: 'Container impact', href: '/dashboard/containers/impact', desc: 'Impact' },
      { name: 'Contractors', href: '/dashboard/containers/contractors', desc: 'Build partners' },
      { name: 'Resellers', href: '/dashboard/containers/resellers', desc: 'Channel' },
      { name: 'Ship / distribution', href: '/dashboard/distribution', desc: 'Inbound · outbound' },
      { name: 'Ops outbound', href: '/dashboard/operations/outbound', desc: 'Dispatch' },
      { name: 'DC stock', href: '/dashboard/inventory/stock', desc: 'Warehouse' },
    ],
  },
  {
    id: 'fitness_gym',
    name: 'Fitness & Gym (Services)',
    shortName: 'Fitness',
    description:
      'Tertiary / services industry pack for gyms and studios — GymAdvisor®: coaches, email member invites & portal, memberships, class calendar, feedback, bookings, check-ins; plus equipment & nutrition suppliers.',
    monthlyZar: INDUSTRY_PACK_MONTHLY_ZAR,
    priority: 1,
    /** Services economy — commercial gyms & wellness (not primary production) */
    recommendSectors: ['tertiary'],
    recommendEntities: ['private_company'],
    modules: [
      {
        id: 'fit_os',
        name: 'GymAdvisor® gym services OS',
        description:
          'Coaches, member invites & portal, plans, classes, calendar, feedback, bookings and check-ins.',
        unlocks: ['fitgraph', 'customers', 'people'],
      },
      {
        id: 'fit_suppliers',
        name: 'Equipment & nutrition suppliers',
        description: 'Source and rate gym service suppliers.',
        unlocks: ['suppliers', 'network', 'fitgraph'],
      },
      {
        id: 'fit_ops',
        name: 'Facility ops & inventory',
        description: 'Site ops and consumables inventory for the gym.',
        unlocks: ['operations', 'inventory', 'fitgraph'],
      },
    ],
    industryToolsHrefs: [
      { name: 'GymAdvisor®', href: '/dashboard/fitgraph', desc: 'Gym services OS' },
      { name: 'Coaches', href: '/dashboard/fitgraph/coaches', desc: 'Trainers · portals' },
      { name: 'Clients', href: '/dashboard/fitgraph/clients', desc: 'Members · invites · portal' },
      { name: 'Classes', href: '/dashboard/fitgraph/memberships', desc: 'Edit class · coach · calendar' },
      { name: 'Membership', href: '/dashboard/fitgraph/membership', desc: 'Members booked to classes' },
      { name: 'Calendar', href: '/dashboard/fitgraph/calendar', desc: 'Schedule coaches' },
      { name: 'Website', href: '/dashboard/fitgraph/website', desc: 'Embed calendar' },
      { name: 'Comms', href: '/dashboard/fitgraph/comms', desc: 'Ads · notices to members' },
      { name: 'Bookings', href: '/dashboard/fitgraph/bookings', desc: 'Book & attend' },
      { name: 'Suppliers', href: '/dashboard/suppliers', desc: 'Gym suppliers' },
    ],
  },
  {
    id: 'allied_health_clinic',
    name: 'Physio & Allied Health (Services)',
    shortName: 'Clinic',
    description:
      'Tertiary / services industry pack for physio, OT, biokinetics and allied health — PhysioAdvisor®: practitioners, patient invites & portal, packages, diary, medical chart, scripts, bookings and clinic website.',
    monthlyZar: INDUSTRY_PACK_MONTHLY_ZAR,
    priority: 1,
    recommendSectors: ['tertiary'],
    recommendEntities: ['private_company'],
    modules: [
      {
        id: 'physio_os',
        name: 'PhysioAdvisor® clinic OS',
        description:
          'Practitioners, patient invites & portal, catalogue, rehab packs, diary, medical chart and scripts.',
        unlocks: ['physiograph', 'customers', 'people'],
      },
      {
        id: 'physio_suppliers',
        name: 'Clinic & rehab suppliers',
        description: 'Source equipment, consumables and referral partners.',
        unlocks: ['suppliers', 'network', 'physiograph'],
      },
      {
        id: 'physio_ops',
        name: 'Clinic ops & inventory',
        description: 'Rooms, consumables and site ops for the practice.',
        unlocks: ['operations', 'inventory', 'physiograph'],
      },
    ],
    industryToolsHrefs: [
      { name: 'PhysioAdvisor®', href: '/dashboard/physiograph', desc: 'Clinic OS' },
      {
        name: 'Practitioners',
        href: '/dashboard/physiograph/practitioners',
        desc: 'Physios · OT · biokinetics',
      },
      {
        name: 'Patients',
        href: '/dashboard/physiograph/patients',
        desc: 'Register · invites · chart · scripts',
      },
      {
        name: 'Services',
        href: '/dashboard/physiograph/services',
        desc: 'Catalogue',
      },
      {
        name: 'Calendar',
        href: '/dashboard/physiograph/calendar',
        desc: 'Diary',
      },
      {
        name: 'Rooms',
        href: '/dashboard/physiograph/rooms',
        desc: 'Floor · assets · assign physios',
      },
      {
        name: 'Bookings',
        href: '/dashboard/physiograph/bookings',
        desc: 'Book · attend',
      },
      {
        name: 'Website',
        href: '/dashboard/physiograph/website',
        desc: 'Clinic profile',
      },
      {
        name: 'Comms',
        href: '/dashboard/physiograph/comms',
        desc: 'Ads · notices to patients',
      },
    ],
  },
  {
    id: 'dental',
    name: 'Dental Practice (Services)',
    shortName: 'Dental',
    description:
      'Tertiary / services industry pack for dental practices — DentalAdvisor®: staff, patient invites & portal, care plans, diary, medical chart, scripts, bookings, messages and practice website, plus procurement.',
    monthlyZar: INDUSTRY_PACK_MONTHLY_ZAR,
    priority: 1,
    recommendSectors: ['tertiary', 'quaternary'],
    recommendEntities: ['private_company'],
    modules: [
      {
        id: 'den_os',
        name: 'DentalAdvisor® practice OS',
        description:
          'Staff, patient invites & portal, care plans, diary, medical chart, scripts, bookings and messages.',
        unlocks: ['dentalgraph', 'customers', 'people'],
      },
      {
        id: 'den_procure',
        name: 'Practice procurement',
        description: 'Order from dental suppliers and labs.',
        unlocks: ['suppliers', 'inventory', 'dentalgraph'],
      },
      {
        id: 'den_compliance',
        name: 'Clinical compliance',
        description: 'Docs, quality, and SHEQ light.',
        unlocks: ['quality', 'sheq', 'dentalgraph'],
      },
    ],
    industryToolsHrefs: [
      { name: 'DentalAdvisor®', href: '/dashboard/dentalgraph', desc: 'Practice OS' },
      {
        name: 'Staff',
        href: '/dashboard/dentalgraph/staff',
        desc: 'Dentists · hygienists',
      },
      {
        name: 'Patients',
        href: '/dashboard/dentalgraph/patients',
        desc: 'Register · invites · chart · scripts',
      },
      {
        name: 'Calendar',
        href: '/dashboard/dentalgraph/calendar',
        desc: 'Diary',
      },
      {
        name: 'Rooms',
        href: '/dashboard/dentalgraph/rooms',
        desc: 'Floor · assets · assign clinicians',
      },
      {
        name: 'Bookings',
        href: '/dashboard/dentalgraph/bookings',
        desc: 'Book · attend',
      },
      {
        name: 'Messages',
        href: '/dashboard/dentalgraph/messages',
        desc: 'Team · patients',
      },
      {
        name: 'Website',
        href: '/dashboard/dentalgraph/website',
        desc: 'Practice profile',
      },
      {
        name: 'Comms',
        href: '/dashboard/dentalgraph/comms',
        desc: 'Ads · notices to patients',
      },
      { name: 'Suppliers', href: '/dashboard/suppliers', desc: 'Dental supply' },
    ],
  },
  {
    id: 'medical_practice',
    name: 'Medical Practice (Services)',
    shortName: 'Medical',
    description:
      'Tertiary / services industry pack for GPs, specialists and nurses — MedicalAdvisor®: practitioners, patient invites & portal, consults, care packs, diary, medical chart, scripts, bookings, messages and practice website, plus procurement.',
    monthlyZar: INDUSTRY_PACK_MONTHLY_ZAR,
    priority: 1,
    recommendSectors: ['tertiary', 'quaternary'],
    recommendEntities: ['private_company'],
    modules: [
      {
        id: 'med_os',
        name: 'MedicalAdvisor® practice OS',
        description:
          'Practitioners, patient invites & portal, consults, care packs, diary, medical chart, scripts, bookings and messages.',
        unlocks: ['medicalgraph', 'customers', 'people'],
      },
      {
        id: 'med_procure',
        name: 'Practice procurement',
        description: 'Order from medical suppliers, pharmacies and labs.',
        unlocks: ['suppliers', 'inventory', 'medicalgraph'],
      },
      {
        id: 'med_compliance',
        name: 'Clinical compliance',
        description: 'Docs, quality, and SHEQ light.',
        unlocks: ['quality', 'sheq', 'medicalgraph'],
      },
    ],
    industryToolsHrefs: [
      { name: 'MedicalAdvisor®', href: '/dashboard/medicalgraph', desc: 'Practice OS' },
      {
        name: 'Practitioners',
        href: '/dashboard/medicalgraph/practitioners',
        desc: 'GPs · nurses · specialists',
      },
      {
        name: 'Patients',
        href: '/dashboard/medicalgraph/patients',
        desc: 'Register · invites · chart · scripts',
      },
      {
        name: 'Services',
        href: '/dashboard/medicalgraph/services',
        desc: 'Consults · procedures',
      },
      {
        name: 'Calendar',
        href: '/dashboard/medicalgraph/calendar',
        desc: 'Diary',
      },
      {
        name: 'Rooms',
        href: '/dashboard/medicalgraph/rooms',
        desc: 'Floor · assets · assign advisors',
      },
      {
        name: 'Bookings',
        href: '/dashboard/medicalgraph/bookings',
        desc: 'Book · attend',
      },
      {
        name: 'Messages',
        href: '/dashboard/medicalgraph/messages',
        desc: 'Team · patients',
      },
      {
        name: 'Website',
        href: '/dashboard/medicalgraph/website',
        desc: 'Practice profile',
      },
      {
        name: 'Comms',
        href: '/dashboard/medicalgraph/comms',
        desc: 'Ads · notices to patients',
      },
      { name: 'Suppliers', href: '/dashboard/suppliers', desc: 'Medical supply' },
    ],
  },
  {
    id: 'psychiatry',
    name: 'Psychiatry & Psychology (Services)',
    shortName: 'Psychiatry',
    description:
      'Tertiary / services industry pack for psychiatry and psychology — PsychiatryAdvisor®: clinicians, patient invites & portal, therapy packs, diary, medical chart, scripts, bookings, messages and practice website, plus procurement.',
    monthlyZar: INDUSTRY_PACK_MONTHLY_ZAR,
    priority: 1,
    recommendSectors: ['tertiary', 'quaternary'],
    recommendEntities: ['private_company'],
    modules: [
      {
        id: 'psy_os',
        name: 'PsychiatryAdvisor® practice OS',
        description:
          'Clinicians, patient invites & portal, therapy packs, diary, medical chart, scripts, bookings and messages.',
        unlocks: ['psychiatrygraph', 'customers', 'people'],
      },
      {
        id: 'psy_procure',
        name: 'Practice procurement',
        description: 'Order from clinic suppliers and referral partners.',
        unlocks: ['suppliers', 'inventory', 'psychiatrygraph'],
      },
      {
        id: 'psy_compliance',
        name: 'Clinical compliance',
        description: 'Docs, quality, and SHEQ light.',
        unlocks: ['quality', 'sheq', 'psychiatrygraph'],
      },
    ],
    industryToolsHrefs: [
      {
        name: 'PsychiatryAdvisor®',
        href: '/dashboard/psychiatrygraph',
        desc: 'Practice OS',
      },
      {
        name: 'Practitioners',
        href: '/dashboard/psychiatrygraph/practitioners',
        desc: 'Psychiatrists · psychologists',
      },
      {
        name: 'Patients',
        href: '/dashboard/psychiatrygraph/patients',
        desc: 'Register · invites · chart · scripts',
      },
      {
        name: 'Services',
        href: '/dashboard/psychiatrygraph/services',
        desc: 'Assessments · therapy',
      },
      {
        name: 'Calendar',
        href: '/dashboard/psychiatrygraph/calendar',
        desc: 'Diary',
      },
      {
        name: 'Rooms',
        href: '/dashboard/psychiatrygraph/rooms',
        desc: 'Floor · assets · assign clinicians',
      },
      {
        name: 'Bookings',
        href: '/dashboard/psychiatrygraph/bookings',
        desc: 'Book · attend',
      },
      {
        name: 'Messages',
        href: '/dashboard/psychiatrygraph/messages',
        desc: 'Team · patients',
      },
      {
        name: 'Website',
        href: '/dashboard/psychiatrygraph/website',
        desc: 'Practice profile',
      },
      {
        name: 'Comms',
        href: '/dashboard/psychiatrygraph/comms',
        desc: 'Ads · notices to patients',
      },
      { name: 'Suppliers', href: '/dashboard/suppliers', desc: 'Clinic supply' },
    ],
  },
  {
    id: 'allied_health',
    name: 'Allied Health / Physio & Biokinetics',
    shortName: 'Allied Health',
    description:
      'Legacy alias for physio / allied clinics — prefer Physio & Allied Health (Services) for PhysioAdvisor®. Still unlocks clinic OS + procurement.',
    monthlyZar: INDUSTRY_PACK_MONTHLY_ZAR,
    priority: 1,
    recommendSectors: ['tertiary', 'quaternary'],
    recommendEntities: ['private_company'],
    modules: [
      {
        id: 'ah_os',
        name: 'PhysioAdvisor® clinic OS',
        description:
          'Practitioners, patients, services, packages, diary and bookings.',
        unlocks: ['physiograph', 'customers', 'people'],
      },
      {
        id: 'ah_procure',
        name: 'Clinic procurement',
        description: 'Consumables and equipment.',
        unlocks: ['suppliers', 'inventory', 'physiograph'],
      },
    ],
    industryToolsHrefs: [
      { name: 'PhysioAdvisor®', href: '/dashboard/physiograph', desc: 'Clinic OS' },
      { name: 'Suppliers', href: '/dashboard/suppliers', desc: 'Clinic supply' },
    ],
  },
  {
    id: 'staffing_hire',
    name: 'Hire & Rental Marketplace',
    shortName: 'Hire',
    description:
      'HireAdvisor® — suppliers list gear for hire (plant, vehicles, tools, kids party / jumping castles, events…); people rent B2C on SA Member for free. Categories enforce different requirements. The listing business pays 2.5% on rental GMV. Members pay rental + deposit only.',
    monthlyZar: INDUSTRY_PACK_MONTHLY_ZAR,
    priority: 1,
    recommendSectors: ['tertiary', 'secondary', 'primary'],
    recommendEntities: ['private_company'],
    modules: [
      {
        id: 'hire_os',
        name: 'HireAdvisor® marketplace OS',
        description:
          'Suppliers, catalogue, categories, free B2C customers, bookings, handover, supplier commission ledger.',
        unlocks: ['hiregraph', 'customers', 'suppliers'],
      },
      {
        id: 'hire_network',
        name: 'Supplier & renter network',
        description: 'Connect hire suppliers and related trade partners.',
        unlocks: ['network', 'suppliers', 'hiregraph'],
      },
      {
        id: 'hire_ops',
        name: 'Handover & ops',
        description: 'Outbound/return logistics and ops tower for hire fleets.',
        unlocks: ['operations', 'distribution', 'hiregraph'],
      },
    ],
    industryToolsHrefs: [
      { name: 'HireAdvisor®', href: '/dashboard/hiregraph', desc: 'Hire marketplace' },
      { name: 'Suppliers', href: '/dashboard/hiregraph/suppliers', desc: 'List gear' },
      { name: 'Categories', href: '/dashboard/hiregraph/categories', desc: 'Requirement stacks' },
      { name: 'Catalogue', href: '/dashboard/hiregraph/catalogue', desc: 'Items · rates' },
      { name: 'Customers', href: '/dashboard/hiregraph/customers', desc: 'People renting' },
      { name: 'Bookings', href: '/dashboard/hiregraph/bookings', desc: 'Duration · extend if free' },
      { name: 'Calendar', href: '/dashboard/hiregraph/calendar', desc: 'Hired items · categories' },
      { name: 'Settlements', href: '/dashboard/hiregraph/settlements', desc: '2.5% on the business · members free' },
      { name: 'Handover', href: '/dashboard/hiregraph/handover', desc: 'Out · return' },
      { name: 'Comms', href: '/dashboard/hiregraph/comms', desc: 'Ads · notices to hirers' },
      { name: 'Website', href: '/dashboard/hiregraph/website', desc: 'Catalogue QR · embed' },
    ],
  },
  {
    id: 'retail_shop',
    name: 'Retail till (Services)',
    shortName: 'Retail',
    description:
      'RetailAdvisor® — B2C shop till: catalogue, cash or QR/NFC phone pay, and collect open SA Member bills (gym, clinic, hire) at the counter.',
    monthlyZar: INDUSTRY_PACK_MONTHLY_ZAR,
    priority: 1,
    recommendSectors: ['tertiary'],
    recommendEntities: ['private_company'],
    modules: [
      {
        id: 'retail_os',
        name: 'RetailAdvisor® till OS',
        description:
          'Catalogue, till, sales, walk-in customers, and present-to-pay QR/NFC.',
        unlocks: ['retailgraph', 'customers', 'inventory'],
      },
      {
        id: 'retail_network',
        name: 'Retail network',
        description: 'Connect suppliers and nearby Advisors whose members pay here.',
        unlocks: ['network', 'suppliers', 'retailgraph'],
      },
      {
        id: 'retail_ops',
        name: 'Shop ops & stock',
        description: 'Inventory and ops tower for the store.',
        unlocks: ['operations', 'inventory', 'retailgraph'],
      },
    ],
    industryToolsHrefs: [
      { name: 'RetailAdvisor®', href: '/dashboard/retailgraph', desc: 'Till OS' },
      { name: 'Till', href: '/dashboard/retailgraph/till', desc: 'QR · NFC · cash' },
      { name: 'Catalogue', href: '/dashboard/retailgraph/catalogue', desc: 'SKUs' },
      { name: 'Sales', href: '/dashboard/retailgraph/sales', desc: 'Takings' },
      { name: 'Accounts', href: '/dashboard/retailgraph/accounts', desc: 'Bills' },
      { name: 'Comms', href: '/dashboard/retailgraph/comms', desc: 'Ads · notices' },
      { name: 'Website', href: '/dashboard/retailgraph/website', desc: 'Shop QR · embed' },
    ],
  },
  {
    id: 'impact_esg',
    name: 'Impact, ESG & Traceability',
    shortName: 'Impact',
    description:
      'ESG packs, carbon, impact dashboards, and supply-chain traceability.',
    monthlyZar: INDUSTRY_PACK_MONTHLY_ZAR,
    priority: 1,
    recommendSectors: ['primary', 'secondary', 'tertiary', 'public_sector'],
    recommendEntities: [
      'private_company',
      'school',
      'municipal',
      'provincial',
      'national',
    ],
    modules: [
      {
        id: 'esg_pack',
        name: 'ESG pack',
        description: 'ESG reporting workspace.',
        unlocks: ['sustainability'],
      },
      {
        id: 'esg_intel',
        name: 'Impact intelligence',
        description: 'Pulse and scorecards for impact.',
        unlocks: ['intelligence', 'sustainability'],
      },
      {
        id: 'esg_lots',
        name: 'Trace lots',
        description: 'Inventory lots for chain of custody.',
        unlocks: ['inventory'],
      },
    ],
    industryToolsHrefs: [
      { name: 'Impact hub', href: '/dashboard/sustainability', desc: 'ESG workspace' },
      { name: 'Intelligence', href: '/dashboard/intelligence', desc: 'Pulse & Super-Cube' },
      { name: 'Lots / trace', href: '/dashboard/inventory/lots', desc: 'Chain of custody' },
      { name: 'Supplier OTIFEF', href: '/dashboard/suppliers/performance', desc: 'Score suppliers' },
    ],
  },
  {
    id: 'public_procurement',
    name: 'Public Procurement & Compliance',
    shortName: 'Public Procure',
    description:
      'Public procurement pathways, compliance, multi-entity, and programme control across National → Local.',
    monthlyZar: INDUSTRY_PACK_MONTHLY_ZAR,
    priority: 1,
    recommendSectors: ['public_sector'],
    recommendEntities: ['municipal', 'provincial', 'national', 'school'],
    modules: [
      {
        id: 'pp_nsnp',
        name: 'SchoolAdvisor® (DBE provincial + local schools)',
        description:
          'SchoolAdvisor® hub — DBE/PEU agency views (provincial) and school kitchen (local). Public sector government process only.',
        unlocks: ['schools'],
      },
      {
        id: 'pp_compliance',
        name: 'Procurement compliance',
        description: 'Quality, SHEQ, and audit trails.',
        unlocks: ['quality', 'sheq', 'intelligence'],
      },
      {
        id: 'pp_multi',
        name: 'Multi-entity control',
        description: 'Group and subsidiary oversight (national / provincial).',
        unlocks: ['my-business', 'network'],
      },
    ],
    industryToolsHrefs: [
      { name: 'SchoolAdvisor® hub', href: '/dashboard/schools', desc: 'DBE + local NSNP OS' },
      { name: 'Approved foods', href: '/dashboard/schools/approved-list', desc: 'Catalogue' },
      { name: 'Kitchen', href: '/dashboard/schools/kitchen', desc: 'Local school stock' },
      { name: 'Orders / SP', href: '/dashboard/schools/orders', desc: 'School POs' },
      { name: 'Serve day', href: '/dashboard/schools/serve-day', desc: 'Local feeding' },
      { name: 'Group entities', href: '/dashboard/my-business/group', desc: 'Multi-entity' },
      { name: 'Quality', href: '/dashboard/quality', desc: 'Compliance' },
    ],
  },
] as const;

export type IndustryPackId = (typeof INDUSTRY_PACKS)[number]['id'];

export function getOsEntityType(id: string | null | undefined) {
  return OS_ENTITY_TYPES.find((e) => e.id === id) || null;
}

export function getOsSector(id: string | null | undefined) {
  return OS_SECTORS.find((s) => s.id === id) || null;
}

export function getIndustryPack(id: string | null | undefined) {
  return INDUSTRY_PACKS.find((p) => p.id === id) || null;
}

export function defaultSectorForEntity(
  entityId: OsEntityTypeId | string
): OsSectorId {
  const e = getOsEntityType(entityId);
  if (e?.publicSector) return 'public_sector';
  return 'secondary';
}

/** Smart pack recommendations from entity + sector */
export function recommendPackIds(
  entityId: OsEntityTypeId | string | null,
  sectorId: OsSectorId | string | null
): IndustryPackId[] {
  const scored = INDUSTRY_PACKS.map((p) => {
    let score = 0;
    if (entityId && p.recommendEntities.includes(entityId as OsEntityTypeId))
      score += 3;
    if (sectorId && p.recommendSectors.includes(sectorId as OsSectorId))
      score += 2;
    return { id: p.id, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const ids = scored.map((s) => s.id);
  // Always surface impact for public sector
  if (
    sectorId === 'public_sector' &&
    !ids.includes('impact_esg')
  ) {
    ids.push('impact_esg');
  }
  if (
    sectorId === 'public_sector' &&
    !ids.includes('public_procurement')
  ) {
    ids.unshift('public_procurement');
  }
  return ids;
}

export function monthlyPriceZar(packIds: string[]): {
  core: number;
  packs: number;
  total: number;
  packCount: number;
} {
  const unique = [...new Set(packIds.filter((id) => getIndustryPack(id)))];
  const packs = unique.length * INDUSTRY_PACK_MONTHLY_ZAR;
  return {
    core: CORE_OS_MONTHLY_ZAR,
    packs,
    total: CORE_OS_MONTHLY_ZAR + packs,
    packCount: unique.length,
  };
}

/** All app module ids unlocked by selected packs + selected pack-modules */
export function unlockAppModulesFromPacks(
  packIds: string[],
  moduleIds: string[]
): string[] {
  const unlock = new Set<string>([
    'home',
    'my-business',
    'guide',
    'network',
    'suppliers',
    'customers',
    'operations',
    'inventory',
    'quality',
    'accounting',
    'intelligence',
  ]);
  for (const pid of packIds) {
    const pack = getIndustryPack(pid);
    if (!pack) continue;
    for (const m of pack.modules) {
      // If user picked modules, only those; else all modules in pack
      if (moduleIds.length > 0 && !moduleIds.includes(m.id)) continue;
      for (const u of m.unlocks) unlock.add(u);
    }
  }
  return [...unlock];
}

/**
 * Build EnabledModulesMap from packs.
 * Core OS modules stay on; packs ADD vertical modules.
 * Never disables a hub that was already unlocked by Core defaults.
 */
export function enabledModulesMapFromPacks(
  packIds: string[],
  moduleIds: string[],
  allModuleIds: string[],
  opts?: { basePresetEnable?: string[] }
): Record<string, boolean> {
  const unlocked = new Set(unlockAppModulesFromPacks(packIds, moduleIds));
  // Base trading / entity preset modules always stay available
  for (const id of opts?.basePresetEnable || []) {
    unlocked.add(id);
  }
  // School / public procurement packs always include schools programme module
  if (
    packIds.includes('public_procurement') ||
    moduleIds.includes('pp_nsnp')
  ) {
    unlocked.add('schools');
  }
  // Logistics pack → full containers hub (all container features)
  if (packIds.includes('logistics_containers')) {
    unlocked.add('containers');
    unlocked.add('distribution');
    unlocked.add('operations');
  }
  // Food mfg → full make + quality
  if (packIds.includes('food_bev_mfg')) {
    unlocked.add('manufacturing');
    unlocked.add('quality');
    unlocked.add('sheq');
    unlocked.add('inventory');
  }
  // Agri → CropAdvisor + suppliers + inventory + impact
  if (packIds.includes('agri_regen')) {
    unlocked.add('fieldgraph');
    unlocked.add('suppliers');
    unlocked.add('inventory');
    unlocked.add('sustainability');
  }
  // Quarrying & aggregates → QuarryAdvisor + trade + logistics
  if (packIds.includes('quarry_aggregates')) {
    unlocked.add('quarrygraph');
    unlocked.add('inventory');
    unlocked.add('customers');
    unlocked.add('distribution');
    unlocked.add('quality');
    unlocked.add('sheq');
    unlocked.add('sustainability');
  }
  // Fitness & gym → GymAdvisor
  if (packIds.includes('fitness_gym')) {
    unlocked.add('fitgraph');
    unlocked.add('suppliers');
    unlocked.add('customers');
    unlocked.add('operations');
    unlocked.add('inventory');
  }
  // Physio / allied health clinic → PhysioAdvisor
  if (
    packIds.includes('allied_health_clinic') ||
    packIds.includes('allied_health')
  ) {
    unlocked.add('physiograph');
    unlocked.add('suppliers');
    unlocked.add('customers');
    unlocked.add('operations');
    unlocked.add('inventory');
    unlocked.add('people');
  }
  // Dental practice → DentalAdvisor
  if (packIds.includes('dental')) {
    unlocked.add('dentalgraph');
    unlocked.add('suppliers');
    unlocked.add('customers');
    unlocked.add('operations');
    unlocked.add('inventory');
    unlocked.add('people');
    unlocked.add('quality');
  }
  // Medical practice → MedicalAdvisor (accept legacy pack id `medical`)
  if (packIds.includes('medical_practice') || packIds.includes('medical')) {
    unlocked.add('medicalgraph');
    unlocked.add('suppliers');
    unlocked.add('customers');
    unlocked.add('operations');
    unlocked.add('inventory');
    unlocked.add('people');
    unlocked.add('quality');
  }
  // Psychiatry & psychology → PsychiatryAdvisor
  if (packIds.includes('psychiatry')) {
    unlocked.add('psychiatrygraph');
    unlocked.add('suppliers');
    unlocked.add('customers');
    unlocked.add('operations');
    unlocked.add('inventory');
    unlocked.add('people');
    unlocked.add('quality');
  }
  // Hire & rental marketplace → HireAdvisor (supplier take-rate · B2C free)
  if (packIds.includes('staffing_hire')) {
    unlocked.add('hiregraph');
    unlocked.add('suppliers');
    unlocked.add('customers');
    unlocked.add('network');
    unlocked.add('operations');
    unlocked.add('distribution');
  }
  if (packIds.includes('retail_shop')) {
    unlocked.add('retailgraph');
    unlocked.add('customers');
    unlocked.add('inventory');
    unlocked.add('network');
    unlocked.add('operations');
  }
  // Impact pack
  if (packIds.includes('impact_esg')) {
    unlocked.add('sustainability');
    unlocked.add('intelligence');
  }

  addAdvisorPackUnlocks(unlocked, packIds);

  const map: Record<string, boolean> = {};
  for (const id of allModuleIds) {
    if (id === 'home' || id === 'my-business' || id === 'guide') {
      map[id] = true;
      continue;
    }
    map[id] = unlocked.has(id);
  }
  return map;
}

export type PackagingSelection = {
  entityTypeId: OsEntityTypeId | string;
  sectorId: OsSectorId | string;
  /**
   * Catalogue industry ids (multi). Primary is industryIds[0] / industryId.
   * Companies may operate in more than one industry within a sector.
   */
  industryIds?: string[];
  /** @deprecated prefer industryIds — kept as first selected for older clients */
  industryId?: string | null;
  /** Catalogue business type ids (multi, optional) */
  businessTypeIds?: string[];
  /** @deprecated prefer businessTypeIds */
  businessTypeId?: string | null;
  packIds: string[];
  moduleIds: string[];
  setupPath: SetupPath;
  setupStatus: 'active' | 'contact_required' | 'pending_specialist';
};

function normalizeIdList(
  primary?: string | null,
  list?: string[] | null
): string[] {
  const out: string[] = [];
  for (const id of list || []) {
    const s = String(id || '').trim();
    if (s && !out.includes(s)) out.push(s);
  }
  if (primary) {
    const s = String(primary).trim();
    if (s && !out.includes(s)) out.unshift(s);
  }
  return out;
}

export function packagingFromSelection(opts: {
  entityTypeId: string;
  sectorId: string;
  packIds: string[];
  moduleIds?: string[];
  industryId?: string | null;
  industryIds?: string[] | null;
  businessTypeId?: string | null;
  businessTypeIds?: string[] | null;
}): PackagingSelection {
  const entity = getOsEntityType(opts.entityTypeId);
  const setupPath = entity?.setupPath || 'self_serve';
  const industryIds = normalizeIdList(opts.industryId, opts.industryIds);
  const businessTypeIds = normalizeIdList(
    opts.businessTypeId,
    opts.businessTypeIds
  );
  // SchoolAdvisor / public-sector school entities always stay on government process
  let sectorId = opts.sectorId;
  let packIds = [...new Set(opts.packIds)];
  let moduleIds = [...new Set(opts.moduleIds || [])];
  const isSchoolEntity =
    opts.entityTypeId === 'school' ||
    businessTypeIds.some((b) => /school|public_school|special_school/i.test(b));
  if (isSchoolEntity || entity?.publicSector) {
    if (isSchoolEntity || opts.entityTypeId === 'provincial' || opts.entityTypeId === 'national') {
      sectorId = 'public_sector';
    }
  }
  if (isSchoolEntity) {
    sectorId = 'public_sector';
    if (!packIds.includes('public_procurement')) {
      packIds = [...packIds, 'public_procurement'];
    }
    if (!moduleIds.includes('schools')) {
      moduleIds = [...moduleIds, 'schools'];
    }
  }
  return {
    entityTypeId: opts.entityTypeId,
    sectorId,
    industryIds,
    industryId: industryIds[0] || null,
    businessTypeIds,
    businessTypeId: businessTypeIds[0] || null,
    packIds,
    moduleIds,
    setupPath,
    setupStatus:
      setupPath === 'contact_required' ? 'contact_required' : 'active',
  };
}

/** Metadata blob stored on profiles.metadata */
export function packagingMetadataBlob(
  selection: PackagingSelection
): Record<string, unknown> {
  const price = monthlyPriceZar(selection.packIds);
  const industryIds = normalizeIdList(
    selection.industryId,
    selection.industryIds
  );
  const businessTypeIds = normalizeIdList(
    selection.businessTypeId,
    selection.businessTypeIds
  );
  return {
    os_architecture: 'core_sector_pack_module',
    os_entity_type: selection.entityTypeId,
    os_sector: selection.sectorId,
    os_industry: industryIds[0] || null,
    os_industries: industryIds,
    os_business_type_id: businessTypeIds[0] || null,
    os_business_type_ids: businessTypeIds,
    industry_packs: selection.packIds,
    industry_modules: selection.moduleIds,
    setup_path: selection.setupPath,
    setup_status: selection.setupStatus,
    packaging_price_zar: price,
    packaging_configured_at: new Date().toISOString(),
  };
}

export function readPackagingFromMetadata(
  meta: Record<string, unknown> | null | undefined
): PackagingSelection | null {
  if (!meta || typeof meta !== 'object') return null;
  const entityTypeId = meta.os_entity_type != null ? String(meta.os_entity_type) : '';
  const sectorId = meta.os_sector != null ? String(meta.os_sector) : '';
  const packIds = Array.isArray(meta.industry_packs)
    ? meta.industry_packs.map(String)
    : [];
  if (!entityTypeId && !sectorId && packIds.length === 0) return null;
  const moduleIds = Array.isArray(meta.industry_modules)
    ? meta.industry_modules.map(String)
    : [];
  const industryIds = normalizeIdList(
    meta.os_industry != null ? String(meta.os_industry) : null,
    Array.isArray(meta.os_industries) ? meta.os_industries.map(String) : null
  );
  const businessTypeIds = normalizeIdList(
    meta.os_business_type_id != null ? String(meta.os_business_type_id) : null,
    Array.isArray(meta.os_business_type_ids)
      ? meta.os_business_type_ids.map(String)
      : null
  );
  const setupStatus = String(meta.setup_status || 'active') as PackagingSelection['setupStatus'];
  // Coerce legacy school packaging off private sectors onto public_sector
  let ent = entityTypeId || 'private_company';
  let sec = sectorId || 'secondary';
  let packs = packIds;
  let mods = moduleIds;
  const looksSchool =
    ent === 'school' ||
    businessTypeIds.some((b) => /school/i.test(b)) ||
    String(meta.entity_kind || '') === 'school' ||
    String(meta.programme || '') === 'schooladvisor' ||
    mods.includes('schools');
  if (ent === 'school' || String(meta.entity_kind || '') === 'school') {
    ent = 'school';
    sec = 'public_sector';
    if (!packs.includes('public_procurement')) {
      packs = [...packs, 'public_procurement'];
    }
    if (!mods.includes('schools')) mods = [...mods, 'schools'];
  } else if (looksSchool && (sec === 'secondary' || sec === 'tertiary' || !sectorId)) {
    // SchoolAdvisor modules enabled under wrong sector → force public sector
    if (mods.includes('schools') && ent === 'school') {
      sec = 'public_sector';
    }
  }
  return {
    entityTypeId: ent,
    sectorId: sec,
    industryIds,
    industryId: industryIds[0] || null,
    businessTypeIds,
    businessTypeId: businessTypeIds[0] || null,
    packIds: packs,
    moduleIds: mods,
    setupPath:
      setupStatus === 'contact_required' || setupStatus === 'pending_specialist'
        ? 'contact_required'
        : 'self_serve',
    setupStatus:
      setupStatus === 'contact_required' ||
      setupStatus === 'pending_specialist' ||
      setupStatus === 'active'
        ? setupStatus
        : 'active',
  };
}

/** Paid pack window + channel from profiles.metadata */
export function readPackBillingFromMetadata(
  meta: Record<string, unknown> | null | undefined
): {
  paidUntil: string | null;
  channel: string | null;
  lastRef: string | null;
} {
  if (!meta || typeof meta !== 'object') {
    return { paidUntil: null, channel: null, lastRef: null };
  }
  return {
    paidUntil:
      meta.industry_packs_paid_until != null
        ? String(meta.industry_packs_paid_until)
        : null,
    channel:
      meta.industry_packs_channel != null
        ? String(meta.industry_packs_channel)
        : null,
    lastRef:
      meta.industry_packs_last_ref != null
        ? String(meta.industry_packs_last_ref)
        : null,
  };
}

/** Primary sector for catalogue grouping (first recommended, else tertiary). */
export function primarySectorForPack(pack: IndustryPackDef): OsSectorId {
  return pack.recommendSectors[0] || 'tertiary';
}

/** Industry packs grouped by primary sector (each pack once). */
export function industryPacksBySector(): Array<{
  sectorId: OsSectorId;
  sectorLabel: string;
  sectorDescription: string;
  packs: IndustryPackDef[];
}> {
  return OS_SECTORS.map((sector) => ({
    sectorId: sector.id,
    sectorLabel: sector.label,
    sectorDescription: sector.description,
    packs: INDUSTRY_PACKS.filter((p) => primarySectorForPack(p) === sector.id),
  })).filter((g) => g.packs.length > 0);
}

/** Unique app MODULE_NAV ids unlocked by a pack. */
export function appModulesUnlockedByPack(pack: IndustryPackDef): string[] {
  const ids = new Set<string>();
  for (const m of pack.modules) {
    for (const u of m.unlocks) ids.add(u);
  }
  // Known pack → hub expansions (match enabledModulesMapFromPacks extras)
  if (pack.id === 'logistics_containers') {
    ids.add('containers');
    ids.add('distribution');
    ids.add('operations');
  }
  if (pack.id === 'food_bev_mfg') {
    ids.add('manufacturing');
    ids.add('quality');
    ids.add('sheq');
    ids.add('inventory');
  }
  if (pack.id === 'agri_regen') {
    ids.add('fieldgraph');
    ids.add('suppliers');
    ids.add('inventory');
    ids.add('sustainability');
  }
  if (pack.id === 'quarry_aggregates') {
    ids.add('quarrygraph');
    ids.add('inventory');
    ids.add('customers');
    ids.add('distribution');
    ids.add('quality');
    ids.add('sheq');
    ids.add('sustainability');
  }
  if (pack.id === 'retail_shop') {
    ids.add('retailgraph');
    ids.add('customers');
    ids.add('inventory');
    ids.add('operations');
  }
  if (pack.id === 'fitness_gym') {
    ids.add('fitgraph');
    ids.add('suppliers');
    ids.add('customers');
    ids.add('operations');
    ids.add('inventory');
  }
  if (
    pack.id === 'allied_health_clinic' ||
    pack.id === 'allied_health'
  ) {
    ids.add('physiograph');
    ids.add('suppliers');
    ids.add('customers');
    ids.add('operations');
    ids.add('inventory');
    ids.add('people');
  }
  if (pack.id === 'dental') {
    ids.add('dentalgraph');
    ids.add('suppliers');
    ids.add('customers');
    ids.add('operations');
    ids.add('inventory');
    ids.add('people');
    ids.add('quality');
  }
  if (pack.id === 'medical_practice' || pack.id === 'medical') {
    ids.add('medicalgraph');
    ids.add('suppliers');
    ids.add('customers');
    ids.add('operations');
    ids.add('inventory');
    ids.add('people');
    ids.add('quality');
  }
  if (pack.id === 'psychiatry') {
    ids.add('psychiatrygraph');
    ids.add('suppliers');
    ids.add('customers');
    ids.add('operations');
    ids.add('inventory');
    ids.add('people');
    ids.add('quality');
  }
  if (pack.id === 'impact_esg') {
    ids.add('sustainability');
    ids.add('intelligence');
  }
  if (pack.id === 'public_procurement') {
    ids.add('schools');
  }
  addAdvisorPackUnlocks(ids, [pack.id]);
  return [...ids];
}

/** Packs that unlock a given app module id. */
export function packsUnlockingAppModule(moduleId: string): IndustryPackDef[] {
  return INDUSTRY_PACKS.filter((p) =>
    appModulesUnlockedByPack(p).includes(moduleId)
  );
}
