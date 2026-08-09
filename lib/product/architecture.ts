/**
 * Core OS → Sector → Industry Pack → Modules → Bespoke
 * Single source of truth for packaging (brief 2026-08-09).
 */

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
  },
  {
    id: 'school',
    label: 'School',
    shortLabel: 'School',
    description: 'School kitchen & NSNP workspace — simplified navigation.',
    businessType: 'school',
    setupPath: 'self_serve' as const,
    publicSector: true,
  },
  {
    id: 'municipal',
    label: 'Municipal / Local Government',
    shortLabel: 'Municipal',
    description: 'Local government — self-serve with public procurement tools.',
    businessType: 'municipal_government',
    setupPath: 'self_serve' as const,
    publicSector: true,
  },
  {
    id: 'provincial',
    label: 'Provincial Government',
    shortLabel: 'Provincial',
    description: 'Provincial department — pack selection; specialist completes setup.',
    businessType: 'provincial_government',
    setupPath: 'contact_required' as const,
    publicSector: true,
  },
  {
    id: 'national',
    label: 'National Government',
    shortLabel: 'National',
    description: 'National department — pack selection; specialist completes setup.',
    businessType: 'national_government',
    setupPath: 'contact_required' as const,
    publicSector: true,
  },
] as const;

export type OsEntityTypeId = (typeof OS_ENTITY_TYPES)[number]['id'];
export type SetupPath = 'self_serve' | 'contact_required';

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
    description: 'Government and publicly funded programmes.',
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
        id: 'agri_farm_book',
        name: 'Farm & grower book',
        description: 'Grower profiles, seasons, and farm supplier book.',
        unlocks: ['suppliers', 'network'],
      },
      {
        id: 'agri_trace',
        name: 'Lot & origin trace',
        description: 'Lots, origin, and batch handoff into inventory.',
        unlocks: ['inventory', 'sustainability'],
      },
      {
        id: 'agri_regen_metrics',
        name: 'Regen metrics',
        description: 'Soil, water, and impact metrics for buyers.',
        unlocks: ['sustainability', 'intelligence'],
      },
    ],
    industryToolsHrefs: [
      { name: 'Supplier book', href: '/dashboard/suppliers/network', desc: 'Growers & farms' },
      { name: 'Source growers', href: '/dashboard/suppliers/discover', desc: 'Find primary suppliers' },
      { name: 'Lots & stock', href: '/dashboard/inventory/lots', desc: 'Origin batches' },
      { name: 'Inventory', href: '/dashboard/inventory/stock', desc: 'On-hand' },
      { name: 'Impact / ESG', href: '/dashboard/sustainability', desc: 'Regen metrics' },
      { name: 'Intelligence', href: '/dashboard/intelligence', desc: 'Pulse & scores' },
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
    name: 'Fitness & Gym',
    shortName: 'Fitness',
    description:
      'Facility ops, supplier book for equipment & nutrition, member-facing trade later.',
    monthlyZar: INDUSTRY_PACK_MONTHLY_ZAR,
    priority: 1,
    recommendSectors: ['tertiary', 'quaternary'],
    recommendEntities: ['private_company'],
    modules: [
      {
        id: 'fit_suppliers',
        name: 'Equipment & nutrition suppliers',
        description: 'Source and rate gym suppliers.',
        unlocks: ['suppliers', 'network'],
      },
      {
        id: 'fit_ops',
        name: 'Facility ops',
        description: 'Ops checklist and inventory for sites.',
        unlocks: ['operations', 'inventory'],
      },
    ],
    industryToolsHrefs: [
      { name: 'Suppliers', href: '/dashboard/suppliers', desc: 'Gym suppliers' },
    ],
  },
  {
    id: 'dental',
    name: 'Dental Practice',
    shortName: 'Dental',
    description:
      'Practice procurement, clinical suppliers, compliance docs, and multi-site ready.',
    monthlyZar: INDUSTRY_PACK_MONTHLY_ZAR,
    priority: 1,
    recommendSectors: ['tertiary', 'quaternary'],
    recommendEntities: ['private_company'],
    modules: [
      {
        id: 'den_procure',
        name: 'Practice procurement',
        description: 'Order from dental suppliers.',
        unlocks: ['suppliers', 'inventory'],
      },
      {
        id: 'den_compliance',
        name: 'Clinical compliance',
        description: 'Docs, quality, and SHEQ light.',
        unlocks: ['quality', 'sheq'],
      },
    ],
    industryToolsHrefs: [
      { name: 'Suppliers', href: '/dashboard/suppliers', desc: 'Dental supply' },
    ],
  },
  {
    id: 'allied_health',
    name: 'Allied Health / Physio & Biokinetics',
    shortName: 'Allied Health',
    description:
      'Clinic procurement, supplier network, and light multi-site operations.',
    monthlyZar: INDUSTRY_PACK_MONTHLY_ZAR,
    priority: 1,
    recommendSectors: ['tertiary', 'quaternary'],
    recommendEntities: ['private_company'],
    modules: [
      {
        id: 'ah_procure',
        name: 'Clinic procurement',
        description: 'Consumables and equipment.',
        unlocks: ['suppliers', 'inventory'],
      },
      {
        id: 'ah_health_link',
        name: 'Health programme link',
        description: 'Optional health facility pathways.',
        unlocks: ['health'],
      },
    ],
    industryToolsHrefs: [
      { name: 'Suppliers', href: '/dashboard/suppliers', desc: 'Clinic supply' },
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
      'Public procurement pathways, compliance, multi-entity, and programme control.',
    monthlyZar: INDUSTRY_PACK_MONTHLY_ZAR,
    priority: 1,
    recommendSectors: ['public_sector'],
    recommendEntities: ['municipal', 'provincial', 'national', 'school'],
    modules: [
      {
        id: 'pp_nsnp',
        name: 'NSNP / schools programme',
        description: 'Schools feeding programme tools (full Schools module).',
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
        description: 'Group and subsidiary oversight.',
        unlocks: ['my-business', 'network'],
      },
    ],
    industryToolsHrefs: [
      { name: 'Schools hub', href: '/dashboard/schools', desc: 'Full NSNP OS' },
      { name: 'Approved foods', href: '/dashboard/schools/approved-list', desc: 'Catalogue' },
      { name: 'Kitchen', href: '/dashboard/schools/kitchen', desc: 'Stock & reorder' },
      { name: 'Orders / SP', href: '/dashboard/schools/orders', desc: 'School POs' },
      { name: 'Serve day', href: '/dashboard/schools/serve-day', desc: 'Feeding' },
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
  // Agri → suppliers + inventory + impact
  if (packIds.includes('agri_regen')) {
    unlocked.add('suppliers');
    unlocked.add('inventory');
    unlocked.add('sustainability');
  }
  // Impact pack
  if (packIds.includes('impact_esg')) {
    unlocked.add('sustainability');
    unlocked.add('intelligence');
  }

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
  packIds: string[];
  moduleIds: string[];
  setupPath: SetupPath;
  setupStatus: 'active' | 'contact_required' | 'pending_specialist';
};

export function packagingFromSelection(opts: {
  entityTypeId: string;
  sectorId: string;
  packIds: string[];
  moduleIds?: string[];
}): PackagingSelection {
  const entity = getOsEntityType(opts.entityTypeId);
  const setupPath = entity?.setupPath || 'self_serve';
  return {
    entityTypeId: opts.entityTypeId,
    sectorId: opts.sectorId,
    packIds: [...new Set(opts.packIds)],
    moduleIds: [...new Set(opts.moduleIds || [])],
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
  return {
    os_architecture: 'core_sector_pack_module',
    os_entity_type: selection.entityTypeId,
    os_sector: selection.sectorId,
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
  if (!entityTypeId && !sectorId) return null;
  const packIds = Array.isArray(meta.industry_packs)
    ? meta.industry_packs.map(String)
    : [];
  const moduleIds = Array.isArray(meta.industry_modules)
    ? meta.industry_modules.map(String)
    : [];
  const setupStatus = String(meta.setup_status || 'active') as PackagingSelection['setupStatus'];
  return {
    entityTypeId: entityTypeId || 'private_company',
    sectorId: sectorId || 'secondary',
    packIds,
    moduleIds,
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
    ids.add('suppliers');
    ids.add('inventory');
    ids.add('sustainability');
  }
  if (pack.id === 'impact_esg') {
    ids.add('sustainability');
    ids.add('intelligence');
  }
  if (pack.id === 'public_procurement') {
    ids.add('schools');
  }
  return [...ids];
}

/** Packs that unlock a given app module id. */
export function packsUnlockingAppModule(moduleId: string): IndustryPackDef[] {
  return INDUSTRY_PACKS.filter((p) =>
    appModulesUnlockedByPack(p).includes(moduleId)
  );
}
