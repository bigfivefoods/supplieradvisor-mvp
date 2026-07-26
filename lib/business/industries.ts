/**
 * Company identity: economic sectors (primary → quinary) and industries.
 *
 * Primary   — extract / grow raw materials
 * Secondary — manufacture & process
 * Tertiary  — services & distribution
 * Quaternary — knowledge, tech, R&D, information
 * Quinary   — highest-order services: government, education, health, culture
 *
 * Stored on profiles as free-text industry / industries[] / sub_industries[].
 */

export type EconomicSectorId =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'quaternary'
  | 'quinary';

export type EconomicSector = {
  id: EconomicSectorId;
  label: string;
  shortLabel: string;
  description: string;
  /** Display order 1–5 */
  order: number;
};

export const ECONOMIC_SECTORS: readonly EconomicSector[] = [
  {
    id: 'primary',
    label: 'Primary sector',
    shortLabel: 'Primary',
    description: 'Extraction and production of raw materials — farming, mining, fishing, forestry.',
    order: 1,
  },
  {
    id: 'secondary',
    label: 'Secondary sector',
    shortLabel: 'Secondary',
    description: 'Manufacturing, processing, construction and utilities from raw inputs.',
    order: 2,
  },
  {
    id: 'tertiary',
    label: 'Tertiary sector',
    shortLabel: 'Tertiary',
    description: 'Commercial services — trade, logistics, finance, hospitality, professional services.',
    order: 3,
  },
  {
    id: 'quaternary',
    label: 'Quaternary sector',
    shortLabel: 'Quaternary',
    description: 'Knowledge economy — technology, R&D, information, media, advanced professional services.',
    order: 4,
  },
  {
    id: 'quinary',
    label: 'Quinary sector',
    shortLabel: 'Quinary',
    description:
      'Highest-order services — government, education, health & care, culture, non-profits and domestic services.',
    order: 5,
  },
] as const;

export type IndustryDefinition = {
  name: string;
  sector: EconomicSectorId;
  /** Short helper under the chip (optional) */
  blurb?: string;
};

/**
 * Full industry catalogue for company profile multi-select.
 * Names are stable storage keys — do not rename lightly.
 */
export const INDUSTRY_CATALOGUE: readonly IndustryDefinition[] = [
  // ── Primary ──────────────────────────────────────────────────────────
  {
    name: 'Agriculture & Farming',
    sector: 'primary',
    blurb: 'Crops, livestock, horticulture',
  },
  {
    name: 'Aquaculture & Fisheries',
    sector: 'primary',
    blurb: 'Fish farming, commercial fishing',
  },
  {
    name: 'Forestry & Timber',
    sector: 'primary',
    blurb: 'Plantations, logging, sawmills',
  },
  {
    name: 'Mining & Resources',
    sector: 'primary',
    blurb: 'Minerals, coal, quarrying',
  },
  {
    name: 'Oil & Gas extraction',
    sector: 'primary',
    blurb: 'Upstream energy',
  },
  {
    name: 'Hunting & Wildlife management',
    sector: 'primary',
  },

  // ── Secondary ────────────────────────────────────────────────────────
  {
    name: 'Food & Beverage Processing',
    sector: 'secondary',
    blurb: 'Manufactured foods & drinks',
  },
  {
    name: 'Ingredients & Raw Materials',
    sector: 'secondary',
    blurb: 'Bulk inputs into food & industry',
  },
  {
    name: 'Packaging & Materials',
    sector: 'secondary',
  },
  {
    name: 'Manufacturing',
    sector: 'secondary',
    blurb: 'General industrial manufacture',
  },
  {
    name: 'Automotive & Transport equipment',
    sector: 'secondary',
  },
  {
    name: 'Chemicals',
    sector: 'secondary',
  },
  {
    name: 'Pharmaceuticals manufacturing',
    sector: 'secondary',
  },
  {
    name: 'Textiles, Apparel & Footwear',
    sector: 'secondary',
  },
  {
    name: 'Construction & Infrastructure',
    sector: 'secondary',
  },
  {
    name: 'Building materials',
    sector: 'secondary',
  },
  {
    name: 'Energy generation & Utilities',
    sector: 'secondary',
    blurb: 'Power plants, water, waste utilities',
  },
  {
    name: 'Metals, Steel & Fabrication',
    sector: 'secondary',
  },
  {
    name: 'Electronics & Electrical manufacturing',
    sector: 'secondary',
  },
  {
    name: 'Furniture & Wood products',
    sector: 'secondary',
  },
  {
    name: 'Printing & Publishing production',
    sector: 'secondary',
  },

  // ── Tertiary ─────────────────────────────────────────────────────────
  {
    name: 'Retail & Wholesale',
    sector: 'tertiary',
  },
  {
    name: 'Logistics & Distribution',
    sector: 'tertiary',
  },
  {
    name: 'Cold chain & Storage',
    sector: 'tertiary',
  },
  {
    name: 'Transport & Mobility',
    sector: 'tertiary',
    blurb: 'Passenger & freight operators',
  },
  {
    name: 'Hospitality & Tourism',
    sector: 'tertiary',
  },
  {
    name: 'Food service & Catering',
    sector: 'tertiary',
    blurb: 'Restaurants, canteens, contract catering',
  },
  {
    name: 'Financial services & Insurance',
    sector: 'tertiary',
  },
  {
    name: 'Real estate & Property',
    sector: 'tertiary',
  },
  {
    name: 'Professional services',
    sector: 'tertiary',
    blurb: 'Legal, accounting, consulting, HR',
  },
  {
    name: 'Marketing, Advertising & PR',
    sector: 'tertiary',
  },
  {
    name: 'Security & Facilities management',
    sector: 'tertiary',
  },
  {
    name: 'Personal care & Beauty',
    sector: 'tertiary',
  },
  {
    name: 'Repair & Maintenance services',
    sector: 'tertiary',
  },
  {
    name: 'Import / Export trading',
    sector: 'tertiary',
  },
  {
    name: 'E-commerce & Marketplaces',
    sector: 'tertiary',
  },

  // ── Quaternary ───────────────────────────────────────────────────────
  {
    name: 'Technology & Software',
    sector: 'quaternary',
    blurb: 'SaaS, platforms, digital products',
  },
  {
    name: 'Telecommunications & Connectivity',
    sector: 'quaternary',
  },
  {
    name: 'Research & Development',
    sector: 'quaternary',
  },
  {
    name: 'Information services & Data',
    sector: 'quaternary',
  },
  {
    name: 'Media, Content & Entertainment',
    sector: 'quaternary',
  },
  {
    name: 'Design, Architecture & Creative',
    sector: 'quaternary',
  },
  {
    name: 'Higher education & Training providers',
    sector: 'quaternary',
    blurb: 'Private colleges, corporate learning',
  },
  {
    name: 'Biotechnology & Life sciences',
    sector: 'quaternary',
  },
  {
    name: 'Aerospace & Advanced engineering',
    sector: 'quaternary',
  },

  // ── Quinary (government, education, health, care, culture) ───────────
  {
    name: 'Government & Public administration',
    sector: 'quinary',
    blurb: 'National, provincial, local departments',
  },
  {
    name: 'Education (schools & ECD)',
    sector: 'quinary',
    blurb: 'Schools, ECD centres, PEU programmes',
  },
  {
    name: 'Education (tertiary & TVET)',
    sector: 'quinary',
    blurb: 'Universities, colleges, TVET',
  },
  {
    name: 'Healthcare (hospitals & clinics)',
    sector: 'quinary',
    blurb: 'Public & private facilities',
  },
  {
    name: 'Public health & Community care',
    sector: 'quinary',
  },
  {
    name: 'Social services & Welfare',
    sector: 'quinary',
  },
  {
    name: 'Defence, Police & Emergency services',
    sector: 'quinary',
  },
  {
    name: 'Culture, Arts & Heritage',
    sector: 'quinary',
  },
  {
    name: 'Religion & Faith-based organisations',
    sector: 'quinary',
  },
  {
    name: 'NGO / Non-profit / Impact',
    sector: 'quinary',
  },
  {
    name: 'Sport, Recreation & Community',
    sector: 'quinary',
  },
  {
    name: 'Household & Domestic services',
    sector: 'quinary',
  },

  // Catch-all
  {
    name: 'Other',
    sector: 'tertiary',
    blurb: 'Not listed — describe in profile',
  },
] as const;

/** Flat list of industry names (backward compatible). */
export const COMPANY_INDUSTRIES = INDUSTRY_CATALOGUE.map(
  (i) => i.name
) as readonly string[];

export const COMPANY_SUB_INDUSTRIES: Record<string, string[]> = {
  'Agriculture & Farming': [
    'Crop production',
    'Livestock',
    'Poultry',
    'Dairy farming',
    'Horticulture',
    'Viticulture',
    'Agri-tech',
    'Seed & inputs retail',
    'Agri cooperatives',
  ],
  'Aquaculture & Fisheries': [
    'Marine fishing',
    'Inland fishing',
    'Fish farming',
    'Shellfish',
    'Seafood processing (primary)',
  ],
  'Forestry & Timber': [
    'Plantation forestry',
    'Logging',
    'Sawmilling',
    'Pulpwood',
  ],
  'Mining & Resources': [
    'Coal',
    'Gold',
    'PGMs',
    'Iron ore',
    'Diamonds',
    'Industrial minerals',
    'Quarrying',
    'Mining services',
    'Minerals trading',
  ],
  'Oil & Gas extraction': [
    'Upstream exploration',
    'Production',
    'Support services',
  ],
  'Hunting & Wildlife management': [
    'Game farming',
    'Conservation management',
    'Safari operations',
  ],

  'Food & Beverage Processing': [
    'Dairy',
    'Meat & poultry',
    'Bakery',
    'Beverages',
    'Confectionery',
    'Ready meals',
    'Milling & cereals',
    'Snacks',
    'Canning & preserves',
    'NSNP / institutional food manufacturing',
  ],
  'Ingredients & Raw Materials': [
    'Flours & grains',
    'Oils & fats',
    'Spices & flavours',
    'Additives',
    'Sugar & sweeteners',
    'Proteins & isolates',
  ],
  'Packaging & Materials': [
    'Flexible packaging',
    'Rigid packaging',
    'Glass',
    'Metal cans',
    'Labels',
    'Sustainable packaging',
    'Pallets & crates',
  ],
  Manufacturing: [
    'Contract manufacturing',
    'OEM',
    'Assembly',
    'Industrial equipment',
    'Consumer goods',
    'Capital equipment',
  ],
  'Automotive & Transport equipment': [
    'Vehicle assembly',
    'Components',
    'Trailers & bodies',
    'Aftermarket parts',
  ],
  Chemicals: [
    'Industrial chemicals',
    'Agrochemicals',
    'Specialty chemicals',
    'Paints & coatings',
    'Cleaning chemicals',
  ],
  'Pharmaceuticals manufacturing': [
    'Generic medicines',
    'API production',
    'Nutraceuticals manufacture',
    'Medical consumables',
  ],
  'Textiles, Apparel & Footwear': [
    'Yarn & fabric',
    'Garment manufacturing',
    'Footwear',
    'Workwear',
  ],
  'Construction & Infrastructure': [
    'Building materials supply',
    'General contracting',
    'Civil works',
    'Roads & bridges',
    'Specialist trades',
    'Project development',
  ],
  'Building materials': [
    'Cement',
    'Bricks & blocks',
    'Steel merchant',
    'Timber merchant',
    'Hardware',
  ],
  'Energy generation & Utilities': [
    'Renewables',
    'Thermal power',
    'Fuel distribution',
    'Water utilities',
    'Waste management',
    'Electricity retail',
  ],
  'Metals, Steel & Fabrication': [
    'Steel production',
    'Foundries',
    'Metal fabrication',
    'Welding & structural',
  ],
  'Electronics & Electrical manufacturing': [
    'Consumer electronics',
    'Industrial electronics',
    'Cabling',
    'Solar equipment',
  ],
  'Furniture & Wood products': [
    'Furniture manufacturing',
    'Joinery',
    'Board products',
  ],
  'Printing & Publishing production': [
    'Commercial print',
    'Packaging print',
    'Book production',
  ],

  'Retail & Wholesale': [
    'Wholesale',
    'Grocery retail',
    'Cash & carry',
    'Speciality retail',
    'E-commerce retail',
    'Franchise retail',
  ],
  'Logistics & Distribution': [
    'Freight',
    'Last mile',
    'Warehousing',
    '3PL',
    '4PL',
    'Customs brokerage',
    'Courier',
    'NSNP / school food logistics',
  ],
  'Cold chain & Storage': [
    'Refrigerated transport',
    'Cold storage',
    'Frozen logistics',
    'Pharma cold chain',
  ],
  'Transport & Mobility': [
    'Road freight operator',
    'Bus & taxi',
    'Rail',
    'Aviation',
    'Maritime shipping',
    'Ports & terminals',
  ],
  'Hospitality & Tourism': [
    'Hotels',
    'Guest houses',
    'Tour operators',
    'Attractions',
    'Event venues',
  ],
  'Food service & Catering': [
    'Restaurants',
    'QSR / fast food',
    'Contract catering',
    'Institutional catering',
    'School feeding service (SP)',
    'Hospital catering',
  ],
  'Financial services & Insurance': [
    'Banking',
    'Insurance',
    'Asset management',
    'Microfinance',
    'Payments',
    'Fintech (regulated)',
  ],
  'Real estate & Property': [
    'Residential development',
    'Commercial property',
    'Property management',
    'Industrial property',
    'Estate agency',
  ],
  'Professional services': [
    'Consulting',
    'Legal',
    'Accounting & audit',
    'Training & coaching',
    'Engineering consulting',
    'HR services',
  ],
  'Marketing, Advertising & PR': [
    'Advertising agency',
    'Digital marketing',
    'Public relations',
    'Market research',
  ],
  'Security & Facilities management': [
    'Guarding',
    'Electronic security',
    'Cleaning',
    'Facilities management',
    'Pest control',
  ],
  'Personal care & Beauty': [
    'Salons',
    'Spas',
    'Personal care products retail',
  ],
  'Repair & Maintenance services': [
    'Vehicle repair',
    'Industrial maintenance',
    'IT support (field)',
    'Appliance repair',
  ],
  'Import / Export trading': [
    'Import agency',
    'Export trading house',
    'Commodity trading',
    'Indent agent',
  ],
  'E-commerce & Marketplaces': [
    'Online marketplace',
    'D2C brands',
    'Fulfilment for e-com',
  ],

  'Technology & Software': [
    'SaaS',
    'IoT',
    'ERP / supply chain software',
    'Data services',
    'Cybersecurity',
    'AI / ML products',
    'Mobile apps',
  ],
  'Telecommunications & Connectivity': [
    'Mobile network',
    'ISP / broadband',
    'Tower infrastructure',
    'Satellite',
  ],
  'Research & Development': [
    'Contract research',
    'Product R&D',
    'Labs & testing',
    'Innovation hubs',
  ],
  'Information services & Data': [
    'Data analytics',
    'Business intelligence',
    'Credit bureaux',
    'Market data',
  ],
  'Media, Content & Entertainment': [
    'Broadcast',
    'Streaming',
    'Film & production',
    'Gaming',
    'Publishing (digital)',
  ],
  'Design, Architecture & Creative': [
    'Architecture',
    'Industrial design',
    'Graphic design',
    'UX / product design',
  ],
  'Higher education & Training providers': [
    'Private college',
    'Corporate L&D',
    'Online learning',
    'Skills programmes',
  ],
  'Biotechnology & Life sciences': [
    'Biotech R&D',
    'Diagnostics',
    'Agri-biotech',
  ],
  'Aerospace & Advanced engineering': [
    'Aerospace components',
    'Defence engineering',
    'Precision engineering',
  ],

  'Government & Public administration': [
    'National department',
    'Provincial department',
    'Local municipality',
    'State-owned entity (SOE)',
    'Department of Basic Education (DBE)',
    'Provincial Education Unit (PEU)',
    'Department of Health (DoH)',
    'Public procurement unit',
    'Regulator / statutory body',
  ],
  'Education (schools & ECD)': [
    'Public school',
    'Independent school',
    'ECD centre',
    'Special needs school',
    'School governing body support',
  ],
  'Education (tertiary & TVET)': [
    'University',
    'University of technology',
    'TVET college',
    'Private higher education',
  ],
  'Healthcare (hospitals & clinics)': [
    'Public hospital',
    'Private hospital',
    'Primary health clinic',
    'Community health centre',
    'Day hospital',
    'Specialist clinic',
  ],
  'Public health & Community care': [
    'Community health workers programmes',
    'Vaccination programmes',
    'Occupational health',
    'Home-based care',
  ],
  'Social services & Welfare': [
    'Child care services',
    'Elderly care',
    'Shelters',
    'Social development programmes',
  ],
  'Defence, Police & Emergency services': [
    'Defence support',
    'Policing support services',
    'Fire & rescue',
    'EMS / ambulance',
  ],
  'Culture, Arts & Heritage': [
    'Museums',
    'Performing arts',
    'Heritage sites',
    'Cultural foundations',
  ],
  'Religion & Faith-based organisations': [
    'Places of worship',
    'Faith-based charity',
    'Religious education',
  ],
  'NGO / Non-profit / Impact': [
    'Development NGO',
    'Humanitarian aid',
    'Environmental NGO',
    'Social enterprise (NPC)',
    'Foundations & trusts',
  ],
  'Sport, Recreation & Community': [
    'Sports clubs',
    'Federations',
    'Recreation centres',
    'Community programmes',
  ],
  'Household & Domestic services': [
    'Domestic employment agencies',
    'Home services',
  ],

  Other: ['General', 'Multi-industry holding', 'Not elsewhere classified'],
};

/** Industries for a given economic sector. */
export function industriesForSector(sectorId: EconomicSectorId): string[] {
  return INDUSTRY_CATALOGUE.filter((i) => i.sector === sectorId).map(
    (i) => i.name
  );
}

export function sectorForIndustry(industryName: string): EconomicSector | null {
  const def = INDUSTRY_CATALOGUE.find((i) => i.name === industryName);
  if (!def) return null;
  return ECONOMIC_SECTORS.find((s) => s.id === def.sector) || null;
}

export function industriesGroupedBySector(): Array<{
  sector: EconomicSector;
  industries: IndustryDefinition[];
}> {
  return ECONOMIC_SECTORS.map((sector) => ({
    sector,
    industries: INDUSTRY_CATALOGUE.filter((i) => i.sector === sector.id),
  }));
}

export function subIndustriesFor(selectedIndustries: string[]): string[] {
  const set = new Set<string>();
  for (const ind of selectedIndustries) {
    for (const s of COMPANY_SUB_INDUSTRIES[ind] || []) set.add(s);
  }
  if (set.size === 0) {
    for (const list of Object.values(COMPANY_SUB_INDUSTRIES)) {
      for (const s of list) set.add(s);
    }
  }
  return Array.from(set).sort();
}

/**
 * Organisation / entity form for company identity (profiles.business_type).
 * Includes legal forms and public-sector / programme organisation kinds.
 */
export const BUSINESS_TYPE_OPTIONS = [
  // Legal / commercial forms
  'Private Company (Pty Ltd)',
  'Public Company (Ltd)',
  'Close Corporation (CC)',
  'Sole Proprietor',
  'Partnership',
  'Non-Profit Company (NPC)',
  'Trust',
  'Cooperative',
  'Branch of foreign company',
  'State-owned company (SOC)',
  // Trade roles
  'Business / wholesaler',
  'Supplier / manufacturer',
  'Service Provider (SP)',
  'Distributor / 3PL',
  'Retailer',
  'Importer / exporter',
  // Government
  'Government — national department',
  'Government — provincial department',
  'Government — local / municipal',
  'Government — DBE / PEU (education)',
  'Government — Department of Health',
  'Government entity / SOE',
  'Regulator / statutory body',
  // Education
  'School (public)',
  'School (independent)',
  'ECD centre',
  'TVET / college',
  'University / higher education',
  'School / Education (other)',
  // Health
  'Hospital (public)',
  'Hospital (private)',
  'Clinic / primary healthcare',
  'Healthcare facility (other)',
  // Civil society
  'Association / industry body',
  'NGO / Impact organisation',
  'Faith-based organisation',
  'Community organisation',
  'Other',
] as const;

export type BusinessTypeOption = (typeof BUSINESS_TYPE_OPTIONS)[number];

/** Group business types for UI optgroups */
export const BUSINESS_TYPE_GROUPS: Array<{
  label: string;
  options: readonly string[];
}> = [
  {
    label: 'Legal form',
    options: [
      'Private Company (Pty Ltd)',
      'Public Company (Ltd)',
      'Close Corporation (CC)',
      'Sole Proprietor',
      'Partnership',
      'Non-Profit Company (NPC)',
      'Trust',
      'Cooperative',
      'Branch of foreign company',
      'State-owned company (SOC)',
    ],
  },
  {
    label: 'Trade role',
    options: [
      'Business / wholesaler',
      'Supplier / manufacturer',
      'Service Provider (SP)',
      'Distributor / 3PL',
      'Retailer',
      'Importer / exporter',
    ],
  },
  {
    label: 'Government & public sector',
    options: [
      'Government — national department',
      'Government — provincial department',
      'Government — local / municipal',
      'Government — DBE / PEU (education)',
      'Government — Department of Health',
      'Government entity / SOE',
      'Regulator / statutory body',
    ],
  },
  {
    label: 'Education',
    options: [
      'School (public)',
      'School (independent)',
      'ECD centre',
      'TVET / college',
      'University / higher education',
      'School / Education (other)',
    ],
  },
  {
    label: 'Health',
    options: [
      'Hospital (public)',
      'Hospital (private)',
      'Clinic / primary healthcare',
      'Healthcare facility (other)',
    ],
  },
  {
    label: 'Civil society',
    options: [
      'Association / industry body',
      'NGO / Impact organisation',
      'Faith-based organisation',
      'Community organisation',
    ],
  },
  {
    label: 'Other',
    options: ['Other'],
  },
];
