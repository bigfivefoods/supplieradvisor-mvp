/**
 * Sector → Industry → Business type catalogue for onboarding & packaging.
 * Exhaustive enough for SA supply-chain registration; maps to packs + entity types.
 */
import type { OsEntityTypeId, OsSectorId } from '@/lib/product/architecture';
import { OS_SECTORS, SA_NATIONAL_DEPARTMENTS } from '@/lib/product/architecture';

export type BusinessTypeOption = {
  id: string;
  label: string;
  description: string;
  /** profiles.business_type */
  profileBusinessType: string;
  /** packaging entity */
  entityTypeId: OsEntityTypeId;
};

export type IndustryOption = {
  id: string;
  label: string;
  description: string;
  sectorId: OsSectorId;
  /** Industry packs to recommend / pre-select */
  packIds: string[];
  businessTypes: BusinessTypeOption[];
};

const privateTypes = (
  items: Array<Omit<BusinessTypeOption, 'entityTypeId' | 'profileBusinessType'> & {
    profileBusinessType?: string;
  }>
): BusinessTypeOption[] =>
  items.map((i) => ({
    ...i,
    entityTypeId: 'private_company' as const,
    profileBusinessType: i.profileBusinessType || 'business',
  }));

/** Exhaustive industry + business-type tree by economic sector */
export const INDUSTRIES: readonly IndustryOption[] = [
  // ── Primary ──────────────────────────────────────────────
  {
    id: 'agriculture',
    label: 'Agriculture & farming',
    description: 'Crops, livestock, horticulture, agri-processing inputs.',
    sectorId: 'primary',
    packIds: ['agri_regen', 'impact_esg'],
    businessTypes: privateTypes([
      { id: 'crop_farm', label: 'Crop / arable farm', description: 'Field crops, grains, oilseeds, vegetables.' },
      { id: 'livestock', label: 'Livestock / dairy / poultry', description: 'Animal production and primary animal products.' },
      { id: 'horticulture', label: 'Horticulture / greenhouse', description: 'Fruit, flowers, protected cropping.' },
      { id: 'mixed_farm', label: 'Mixed farming', description: 'Combined crop and livestock operations.' },
      { id: 'agri_coop', label: 'Agricultural co-operative', description: 'Farmer co-ops and collective marketing.' },
      { id: 'agri_input', label: 'Agri inputs supplier', description: 'Seed, feed, fertiliser, chemicals, equipment.' },
      { id: 'primary_processor', label: 'Primary agri processor', description: 'First-stage processing near farm gate.' },
    ]),
  },
  {
    id: 'fishing_aqua',
    label: 'Fishing & aquaculture',
    description: 'Marine and freshwater harvest and farming.',
    sectorId: 'primary',
    packIds: ['agri_regen', 'impact_esg'],
    businessTypes: privateTypes([
      { id: 'commercial_fishing', label: 'Commercial fishing', description: 'Wild catch and vessel operators.' },
      { id: 'aquaculture', label: 'Aquaculture farm', description: 'Fish, shellfish or algae farming.' },
      { id: 'seafood_primary', label: 'Seafood primary handler', description: 'Landing, ice, first processing.' },
    ]),
  },
  {
    id: 'forestry',
    label: 'Forestry',
    description: 'Timber, pulp feedstock and forest products.',
    sectorId: 'primary',
    packIds: ['agri_regen', 'impact_esg'],
    businessTypes: privateTypes([
      { id: 'timber_grower', label: 'Timber grower / plantation', description: 'Forest ownership and harvesting.' },
      { id: 'sawmill_primary', label: 'Sawmill / primary timber', description: 'Logs to lumber and residues.' },
    ]),
  },
  {
    id: 'mining_extractives',
    label: 'Mining & extractives',
    description: 'Minerals, quarrying and extractive supply chains.',
    sectorId: 'primary',
    packIds: ['quarry_aggregates', 'impact_esg', 'logistics_containers'],
    businessTypes: privateTypes([
      { id: 'mine_operator', label: 'Mine operator', description: 'Mining production company.' },
      { id: 'quarry', label: 'Quarry / aggregates', description: 'Stone, sand, aggregate extraction.' },
      { id: 'mining_services', label: 'Mining services contractor', description: 'Contract mining, drilling, support.' },
      { id: 'mineral_trader', label: 'Mineral trader / exporter', description: 'Bulk mineral trade and offtake.' },
    ]),
  },

  // ── Secondary ────────────────────────────────────────────
  {
    id: 'food_bev_mfg',
    label: 'Food & beverage manufacturing',
    description: 'Processing, packing and brand manufacturing of food & drink.',
    sectorId: 'secondary',
    packIds: ['food_bev_mfg', 'impact_esg'],
    businessTypes: privateTypes([
      { id: 'food_manufacturer', label: 'Food manufacturer', description: 'Processed foods, meals, ingredients.' },
      { id: 'beverage_mfg', label: 'Beverage manufacturer', description: 'Soft drinks, juice, water, alcohol.' },
      { id: 'bakery_confectionery', label: 'Bakery / confectionery', description: 'Bread, pastry, sweets manufacturing.' },
      { id: 'meat_processing', label: 'Meat / poultry processing', description: 'Abattoir-linked and further processing.' },
      { id: 'dairy_mfg', label: 'Dairy manufacturer', description: 'Milk processing, cheese, yoghurt.' },
      { id: 'packaging_food', label: 'Food packaging co-packer', description: 'Contract packing for food brands.' },
    ]),
  },
  {
    id: 'general_mfg',
    label: 'General manufacturing',
    description: 'Non-food manufacturing, assembly and fabrication.',
    sectorId: 'secondary',
    packIds: ['food_bev_mfg', 'logistics_containers'],
    businessTypes: privateTypes([
      { id: 'discrete_mfg', label: 'Discrete / assembly manufacturer', description: 'Parts, equipment, finished goods.' },
      { id: 'process_mfg', label: 'Process / chemicals manufacturer', description: 'Chemicals, materials, continuous process.' },
      { id: 'packaging_mfg', label: 'Packaging manufacturer', description: 'Corrugated, flexible, rigid packaging.' },
      { id: 'pharma_mfg', label: 'Pharma / nutraceutical mfg', description: 'Medicines, supplements manufacturing.' },
      { id: 'textile_mfg', label: 'Textile / apparel manufacturing', description: 'Fabric and garment production.' },
      { id: 'construction_mfg', label: 'Building materials manufacturer', description: 'Cement, steel, fittings production.' },
    ]),
  },
  {
    id: 'construction_utilities',
    label: 'Construction & utilities',
    description: 'Building, infrastructure and utility-side industrial work.',
    sectorId: 'secondary',
    packIds: ['logistics_containers', 'impact_esg'],
    businessTypes: privateTypes([
      { id: 'main_contractor', label: 'Main building contractor', description: 'Principal construction contractor.' },
      { id: 'specialist_trade', label: 'Specialist trade contractor', description: 'Electrical, plumbing, civils, etc.' },
      { id: 'utilities_contractor', label: 'Utilities contractor', description: 'Water, power, telecoms infrastructure.' },
      { id: 'epc', label: 'EPC / project company', description: 'Engineering, procurement, construction.' },
    ]),
  },

  // ── Tertiary ─────────────────────────────────────────────
  {
    id: 'wholesale_distribution',
    label: 'Wholesale & distribution',
    description: 'Bulk trade, DC operations and channel distribution.',
    sectorId: 'tertiary',
    packIds: ['logistics_containers'],
    businessTypes: privateTypes([
      { id: 'wholesaler', label: 'Wholesaler', description: 'B2B wholesale of goods.' },
      { id: 'distributor', label: 'Distributor / agent', description: 'Brand distribution and agency.' },
      { id: 'cash_carry', label: 'Cash & carry', description: 'Trade cash-and-carry outlets.' },
      { id: 'importer_exporter', label: 'Importer / exporter', description: 'Cross-border trade house.' },
      { id: 'commodity_trader', label: 'Commodity trader', description: 'Agricultural or bulk commodity trade.' },
    ]),
  },
  {
    id: 'retail',
    label: 'Retail',
    description: 'Consumer-facing retail stores and e-commerce.',
    sectorId: 'tertiary',
    packIds: ['logistics_containers'],
    businessTypes: privateTypes([
      { id: 'grocery_retail', label: 'Grocery / supermarket', description: 'Food retail chains and independents.' },
      { id: 'specialty_retail', label: 'Specialty retail', description: 'Category or lifestyle retail.' },
      { id: 'ecommerce_retail', label: 'E-commerce retailer', description: 'Online-first retail.' },
      { id: 'convenience', label: 'Convenience / forecourt', description: 'C-store and fuel retail.' },
    ]),
  },
  {
    id: 'logistics_transport',
    label: 'Logistics & transport',
    description: 'Freight, warehousing, last mile and container networks.',
    sectorId: 'tertiary',
    packIds: ['logistics_containers'],
    businessTypes: privateTypes([
      { id: 'freight_carrier', label: 'Freight carrier / fleet', description: 'Road freight and fleet operators.' },
      { id: '3pl_warehouse', label: '3PL / warehouse', description: 'Warehousing and fulfilment.' },
      { id: 'freight_forwarder', label: 'Freight forwarder / clearing', description: 'International freight and customs.' },
      { id: 'courier_lastmile', label: 'Courier / last mile', description: 'Parcel and last-mile delivery.' },
      { id: 'container_ops', label: 'Container park / outlet operator', description: 'Container sites and conversion.' },
    ]),
  },
  {
    id: 'hospitality_foodservice',
    label: 'Hospitality & foodservice',
    description: 'Hotels, restaurants, catering and institutional feeding.',
    sectorId: 'tertiary',
    packIds: ['food_bev_mfg', 'logistics_containers'],
    businessTypes: privateTypes([
      { id: 'restaurant', label: 'Restaurant / QSR', description: 'Restaurants and quick service.' },
      { id: 'hotel', label: 'Hotel / accommodation', description: 'Hotels, lodges, guesthouses.' },
      { id: 'caterer', label: 'Caterer / canteen', description: 'Contract catering and canteens.' },
      { id: 'events_fs', label: 'Events foodservice', description: 'Event and venue catering.' },
    ]),
  },
  {
    id: 'professional_services',
    label: 'Professional & business services',
    description: 'Advisory, professional and B2B services.',
    sectorId: 'tertiary',
    packIds: ['impact_esg'],
    businessTypes: privateTypes([
      { id: 'consulting', label: 'Consulting / advisory', description: 'Management and technical consulting.' },
      { id: 'accounting_legal', label: 'Accounting / legal / audit', description: 'Professional practice firms.' },
      { id: 'facility_services', label: 'Facilities / cleaning / security', description: 'Outsourced facility services.' },
      { id: 'marketing_agency', label: 'Marketing / creative agency', description: 'Brand and digital agencies.' },
      { id: 'staffing', label: 'Staffing / labour broker', description: 'Temporary and permanent staffing.' },
    ]),
  },
  {
    id: 'fitness_wellness',
    label: 'Fitness & wellness',
    description:
      'Tertiary services: commercial gyms, boutique studios and wellness facilities (member services, classes, coaching).',
    sectorId: 'tertiary',
    packIds: ['fitness_gym'],
    businessTypes: privateTypes([
      { id: 'gym', label: 'Gym / health club', description: 'Full-service fitness clubs and gyms.' },
      { id: 'studio', label: 'Boutique studio', description: 'Yoga, pilates, HIIT and specialised studios.' },
      { id: 'pt_studio', label: 'Personal training studio', description: 'PT-led studios and coaching practices.' },
      { id: 'wellness_centre', label: 'Wellness centre', description: 'Spa and wellness facilities.' },
    ]),
  },
  {
    id: 'dental_clinical',
    label: 'Dental & clinical practices',
    description: 'Dental and private clinical practices (non-hospital).',
    sectorId: 'tertiary',
    packIds: ['dental'],
    businessTypes: privateTypes([
      { id: 'dental_practice', label: 'Dental practice', description: 'General or specialist dental practice.' },
      { id: 'dental_group', label: 'Dental group / multi-site', description: 'Multi-chair or multi-site groups.' },
    ]),
  },
  {
    id: 'allied_health_private',
    label: 'Allied health (private)',
    description: 'Physio, biokinetics and private allied practices.',
    sectorId: 'tertiary',
    packIds: ['allied_health'],
    businessTypes: privateTypes([
      { id: 'physio', label: 'Physiotherapy practice', description: 'Private physio clinics.' },
      { id: 'biokinetics', label: 'Biokinetics practice', description: 'Biokinetics and rehab.' },
      { id: 'allied_multi', label: 'Multi-disciplinary clinic', description: 'Combined allied health rooms.' },
    ]),
  },

  // ── Quaternary ───────────────────────────────────────────
  {
    id: 'tech_software',
    label: 'Technology & software',
    description: 'Software, platforms, IT services and digital products.',
    sectorId: 'quaternary',
    packIds: ['impact_esg'],
    businessTypes: privateTypes([
      { id: 'saas', label: 'SaaS / software product', description: 'Product software companies.' },
      { id: 'it_services', label: 'IT services / MSP', description: 'Managed IT and systems integration.' },
      { id: 'data_ai', label: 'Data / AI / analytics firm', description: 'Data products and analytics.' },
      { id: 'telecoms', label: 'Telecoms / ISP', description: 'Connectivity and telecoms services.' },
    ]),
  },
  {
    id: 'education_private',
    label: 'Private education & training',
    description: 'Private schools, colleges, training and edtech (not public NSNP).',
    sectorId: 'quaternary',
    packIds: ['impact_esg'],
    businessTypes: privateTypes([
      { id: 'private_school', label: 'Private school', description: 'Independent school (non-NSNP public programme).' },
      { id: 'college_tvet_private', label: 'Private college / TVET', description: 'Private higher or vocational education.' },
      { id: 'training_provider', label: 'Training / SETA provider', description: 'Skills and corporate training.' },
      { id: 'edtech', label: 'EdTech product', description: 'Education technology products.' },
    ]),
  },
  {
    id: 'rd_professional_iq',
    label: 'R&D and professional knowledge',
    description: 'Research, labs and knowledge-intensive firms.',
    sectorId: 'quaternary',
    packIds: ['impact_esg'],
    businessTypes: privateTypes([
      { id: 'rd_lab', label: 'R&D / laboratory', description: 'Research and testing laboratories.' },
      { id: 'think_tank', label: 'Think tank / institute', description: 'Policy and research institutes.' },
      { id: 'design_engineering', label: 'Design / engineering firm', description: 'Professional design and engineering.' },
    ]),
  },

  // ── Public sector ────────────────────────────────────────
  {
    id: 'public_national',
    label: 'National government',
    description: 'National departments and agencies (DoE, DoH, Treasury, full Cabinet list).',
    sectorId: 'public_sector',
    packIds: ['public_procurement', 'impact_esg'],
    businessTypes: [
      {
        id: 'nat_doe',
        label: 'Department of Education (DoE / DBE)',
        description: 'National basic education policy and NSNP standards.',
        profileBusinessType: 'national_government',
        entityTypeId: 'national',
      },
      {
        id: 'nat_dhet',
        label: 'Department of Higher Education and Training',
        description: 'Universities, TVET and skills (national).',
        profileBusinessType: 'national_government',
        entityTypeId: 'national',
      },
      {
        id: 'nat_doh',
        label: 'Department of Health (DoH)',
        description: 'National health programme and facility pathways.',
        profileBusinessType: 'national_government',
        entityTypeId: 'national',
      },
      {
        id: 'nat_treasury',
        label: 'National Treasury',
        description: 'Public finance and PFMA oversight.',
        profileBusinessType: 'national_government',
        entityTypeId: 'national',
      },
      ...SA_NATIONAL_DEPARTMENTS.filter(
        (d) => !['doe_basic', 'dhet', 'doh', 'treasury'].includes(d.id)
      ).map((d) => ({
        id: `nat_${d.id}`,
        label: d.name,
        description: d.focus,
        profileBusinessType: 'national_government',
        entityTypeId: 'national' as const,
      })),
      {
        id: 'nat_agency',
        label: 'Other national agency / SOE programme unit',
        description: 'Public entity or agency at national level.',
        profileBusinessType: 'national_government',
        entityTypeId: 'national',
      },
    ],
  },
  {
    id: 'public_provincial',
    label: 'Provincial government',
    description: 'Provincial departments and PEUs — DBE education agency, provincial health.',
    sectorId: 'public_sector',
    packIds: ['public_procurement', 'impact_esg'],
    businessTypes: [
      {
        id: 'prov_dbe',
        label: 'Provincial Education / DBE PEU (NSNP agency)',
        description: 'Approve schools, catalogue, visits, claims — not a school kitchen.',
        profileBusinessType: 'provincial_government',
        entityTypeId: 'provincial',
      },
      {
        id: 'prov_health',
        label: 'Provincial Health department',
        description: 'Provincial health programme oversight.',
        profileBusinessType: 'provincial_government',
        entityTypeId: 'provincial',
      },
      {
        id: 'prov_other',
        label: 'Other provincial department',
        description: 'Any other provincial government department.',
        profileBusinessType: 'provincial_government',
        entityTypeId: 'provincial',
      },
      {
        id: 'prov_agency',
        label: 'Provincial agency / public entity',
        description: 'Provincial public entity or programme office.',
        profileBusinessType: 'provincial_government',
        entityTypeId: 'provincial',
      },
    ],
  },
  {
    id: 'public_municipal',
    label: 'Municipal government',
    description: 'Metros, local and district municipalities.',
    sectorId: 'public_sector',
    packIds: ['public_procurement', 'logistics_containers'],
    businessTypes: [
      {
        id: 'metro',
        label: 'Metropolitan municipality',
        description: 'Category A metro.',
        profileBusinessType: 'municipal_government',
        entityTypeId: 'municipal',
      },
      {
        id: 'local_muni',
        label: 'Local municipality',
        description: 'Category B local municipality.',
        profileBusinessType: 'municipal_government',
        entityTypeId: 'municipal',
      },
      {
        id: 'district_muni',
        label: 'District municipality',
        description: 'Category C district municipality.',
        profileBusinessType: 'municipal_government',
        entityTypeId: 'municipal',
      },
      {
        id: 'muni_entity',
        label: 'Municipal entity / utility',
        description: 'Municipal-owned entity or utility.',
        profileBusinessType: 'municipal_government',
        entityTypeId: 'municipal',
      },
    ],
  },
  {
    id: 'public_local',
    label: 'Local — schools & facilities',
    description: 'Schools (NSNP kitchens), clinics and local service sites.',
    sectorId: 'public_sector',
    packIds: ['public_procurement'],
    businessTypes: [
      {
        id: 'public_school',
        label: 'Public school (NSNP kitchen)',
        description: 'School kitchen, learners, SPs, serve day — local NSNP site.',
        profileBusinessType: 'school',
        entityTypeId: 'school',
      },
      {
        id: 'special_school',
        label: 'Special / LSEN school',
        description: 'Special needs school on NSNP or feeding programmes.',
        profileBusinessType: 'school',
        entityTypeId: 'school',
      },
      {
        id: 'clinic',
        label: 'Clinic / CHC',
        description: 'Primary health clinic or community health centre.',
        profileBusinessType: 'business',
        entityTypeId: 'private_company',
      },
      {
        id: 'hospital',
        label: 'Public hospital',
        description: 'District, regional or tertiary public hospital.',
        profileBusinessType: 'business',
        entityTypeId: 'private_company',
      },
      {
        id: 'local_facility',
        label: 'Other local public facility',
        description: 'Other local government-funded service site.',
        profileBusinessType: 'municipal_government',
        entityTypeId: 'municipal',
      },
    ],
  },
] as const;

export function industriesForSector(sectorId: string | null | undefined): IndustryOption[] {
  if (!sectorId) return [];
  return INDUSTRIES.filter((i) => i.sectorId === sectorId);
}

export function getIndustry(id: string | null | undefined): IndustryOption | null {
  if (!id) return null;
  return INDUSTRIES.find((i) => i.id === id) || null;
}

export function getBusinessType(
  industryId: string | null | undefined,
  businessTypeId: string | null | undefined
): BusinessTypeOption | null {
  const ind = getIndustry(industryId);
  if (!ind || !businessTypeId) return null;
  return ind.businessTypes.find((b) => b.id === businessTypeId) || null;
}

export function sectorLabel(sectorId: string | null | undefined): string {
  return OS_SECTORS.find((s) => s.id === sectorId)?.label || sectorId || '—';
}

/** Packs relevant to a sector (primary recommendSectors match + industry packIds) */
export function packIdsForSector(sectorId: string | null | undefined): string[] {
  const fromIndustries = industriesForSector(sectorId).flatMap((i) => i.packIds);
  return [...new Set(fromIndustries)];
}
