/**
 * Company-level module enablement (sidebar visibility).
 * Stored in profiles.metadata.enabled_modules as Record<moduleId, boolean>.
 * Missing keys default to true (all selected).
 */

import type { ModuleNav } from '@/lib/chrome/module-nav';
import { MODULE_NAV } from '@/lib/chrome/module-nav';
import {
  appModulesUnlockedByPack,
  getIndustryPack,
} from '@/lib/product/architecture';
import { getIndustry } from '@/lib/product/business-catalogue';
import { applyAdvisorCoreCompanions } from '@/lib/product/advisor-core-unlocks';
import { isFounderLifetimeCompany } from '@/lib/billing/lifetime';

/** Always visible — cannot be turned off in company profile */
export const ALWAYS_ON_MODULE_IDS = ['home', 'my-business', 'guide'] as const;

export type AlwaysOnModuleId = (typeof ALWAYS_ON_MODULE_IDS)[number];

/** Modules companies can toggle on the profile (default: all on) */
export type SelectableModuleId = Exclude<
  (typeof MODULE_NAV)[number]['id'],
  AlwaysOnModuleId
>;

export type EnabledModulesMap = Record<string, boolean>;

const MODULE_DESCRIPTIONS: Record<string, string> = {
  'sales-portal': 'Sales contractor portal, pipeline, quotes & earnings',
  network: 'Connections, pricing agreements, marketplace, invites',
  suppliers: 'SRM: source, connect, procure, rate & report suppliers',
  customers: 'CRM: source, connect, quote, invoice, rate & report buyers — includes Advisor members',
  containers:
    'ContainerAdvisor® — container outlets, resellers, contractors & impact',
  inventory: 'Products, stock, lots, transfers & counts',
  operations: 'Inbound, warehouse, production, outbound control tower',
  manufacturing: 'MPS, MRP, BOM, production orders & work centres',
  distribution: 'Inbound/outbound logistics, tracking & carriers',
  accounting: 'Books, bank recon, journals, tax & reports — Advisor fees post here',
  people: 'HR directory, payroll, leave, org chart & training — includes employed Advisor staff',
  sheq: 'OH&S, NCR/CAPA, safety incidents',
  quality: 'Inspections, holds, quality assurance',
  projects: 'Portfolio, kanban, milestones & timesheets',
  sustainability: 'Carbon tracking, ESG packs & impact',
  fieldgraph:
    'CropAdvisor® — multi-crop fields, estimates, harvest, inputs, regen & farm-to-buyer trade',
  quarrygraph:
    'QuarryAdvisor® — sites, reserves, production, plant, weighbridge, fleet, QA & permits',
  fitgraph:
    'GymAdvisor® (tertiary services) — coaches, member invites & portal, memberships, classes, calendar, feedback, messages & check-ins',
  physiograph:
    'PhysioAdvisor® (tertiary services) — practitioners, patient invites & portal, packages, diary, medical chart, scripts, bookings & messages',
  dentalgraph:
    'DentalAdvisor® (tertiary services) — staff, patient invites & portal, care plans, diary, medical chart, scripts, bookings & messages',
  psychiatrygraph:
    'PsychiatryAdvisor® (tertiary services) — clinicians, patients, therapy packs, diary, medical chart, scripts, portal, bookings & messages',
  medicalgraph:
    'MedicalAdvisor® (tertiary services) — GPs & nurses, patients, consults, care packs, diary, scripts, medical chart, portal & messages',
  vetgraph:
    'VetAdvisor® (tertiary services) — vets & veterinary nurses, clients, animals, consults, vaccines, diary, pet medical aid, portal & messages',
  hiregraph:
    'HireAdvisor® — hire/rental marketplace: suppliers list gear, people rent free (B2C), category requirements, 2.5% on the listing business',
  retailgraph:
    'RetailAdvisor® — B2C retail till: catalogue, cash or QR/NFC phone pay, collect SA Member bills at the counter',
  intelligence: 'Pulse, forecasts, scorecards & Super-Cube® leadership',
  schools:
    'SchoolAdvisor® (public sector) — NSNP kitchen, learners, SPs, catalogue, feeding, prizes (DBE / PEU / schools)',
  health:
    'HealthAdvisor® (public sector) — DoH clinics, hospitals, SPs, approved foods & nutrition',
  platform:
    'SupplierAdvisor platform admin console — system & management reports for the whole network',
  home: 'Command centre home',
  'my-business': 'Company profile, team, modules, billing & trust',
  guide: 'In-app training curriculum',
};

/**
 * Logical groups for the Modules workspace UI.
 * Two bands: Core OS · Sector & industry — keep subsections short.
 */
export type ModuleBandId = 'core' | 'industry';

export type ModuleCategoryId =
  | 'core_home'
  | 'core_trade'
  | 'core_operate'
  | 'core_finance'
  | 'core_people'
  | 'core_assure'
  | 'core_insights'
  | 'ind_primary'
  | 'ind_services'
  | 'ind_programme';

export type ModuleCategory = {
  id: ModuleCategoryId;
  /** Parent band for page grouping */
  band: ModuleBandId;
  title: string;
  blurb: string;
  moduleIds: string[];
};

export const MODULE_BANDS: Array<{
  id: ModuleBandId;
  title: string;
  blurb: string;
}> = [
  {
    id: 'core',
    title: 'Core OS',
    blurb: 'Platform foundations — trade, ops, finance, people, and insight.',
  },
  {
    id: 'industry',
    title: 'Sector & industry',
    blurb:
      'Vertical modules for agri, extractives, fitness, clinics, and public programmes.',
  },
];

export const MODULE_CATEGORIES: ModuleCategory[] = [
  {
    id: 'core_home',
    band: 'core',
    title: 'Home & company',
    blurb: 'Always on — command centre, company, and training guide.',
    moduleIds: ['home', 'my-business', 'guide'],
  },
  {
    id: 'core_trade',
    band: 'core',
    title: 'Trade',
    blurb: 'Network, suppliers, customers, and sales portal.',
    moduleIds: ['network', 'suppliers', 'customers', 'sales-portal'],
  },
  {
    id: 'core_operate',
    band: 'core',
    title: 'Operate',
    blurb: 'Inventory, ops tower, make, and ship.',
    moduleIds: [
      'inventory',
      'operations',
      'manufacturing',
      'distribution',
    ],
  },
  {
    id: 'core_finance',
    band: 'core',
    title: 'Finance',
    blurb: 'Books, bank, tax — Owner and Finance roles only in the sidebar.',
    moduleIds: ['accounting'],
  },
  {
    id: 'core_people',
    band: 'core',
    title: 'People',
    blurb: 'HR directory, payroll, leave, and org chart.',
    moduleIds: ['people'],
  },
  {
    id: 'core_assure',
    band: 'core',
    title: 'Assure',
    blurb: 'SHEQ, quality, and projects.',
    moduleIds: ['sheq', 'quality', 'projects'],
  },
  {
    id: 'core_insights',
    band: 'core',
    title: 'Insights & impact',
    blurb: 'Pulse, Super-Cube®, ESG, and sustainability.',
    moduleIds: ['intelligence', 'sustainability'],
  },
  {
    id: 'ind_primary',
    band: 'industry',
    title: 'Primary production',
    blurb: 'CropAdvisor® (farming) and QuarryAdvisor® (aggregates).',
    moduleIds: ['fieldgraph', 'quarrygraph'],
  },
  {
    id: 'ind_services',
    band: 'industry',
    title: 'Services',
    blurb:
      'GymAdvisor®, PhysioAdvisor®, DentalAdvisor®, PsychiatryAdvisor®, MedicalAdvisor®, VetAdvisor®, HireAdvisor®, RetailAdvisor® and ContainerAdvisor®.',
    moduleIds: [
      'fitgraph',
      'physiograph',
      'dentalgraph',
      'psychiatrygraph',
      'medicalgraph',
      'vetgraph',
      'hiregraph',
      'retailgraph',
      'containers',
    ],
  },
  {
    id: 'ind_programme',
    band: 'industry',
    title: 'Public programmes',
    blurb:
      'SchoolAdvisor® (NSNP / DBE) and HealthAdvisor® (DoH) — government process only.',
    moduleIds: ['schools', 'health'],
  },
];

/** One-click presets for onboarding */
export type ModulePresetId =
  | 'starter'
  | 'trading'
  | 'operations'
  | 'full'
  | 'school_nsnp'
  | 'dbe_agency'
  | 'nsnp_isp'
  | 'doh_agency'
  | 'health_facility';

export const MODULE_PRESETS: Array<{
  id: ModulePresetId;
  label: string;
  description: string;
  /** Module ids forced on (plus always-on). Others off. */
  enable: string[];
}> = [
  {
    id: 'starter',
    label: 'Starter',
    description: 'Network + suppliers + customers — get to first trade fast.',
    enable: ['network', 'suppliers', 'customers'],
  },
  {
    id: 'trading',
    label: 'Trading company',
    description: 'Buy/sell stack with inventory, accounting, and intelligence.',
    enable: [
      'network',
      'suppliers',
      'customers',
      'inventory',
      'accounting',
      'intelligence',
    ],
  },
  {
    id: 'operations',
    label: 'Ops-heavy',
    description: 'Full ops: manufacturing, distribution, quality, SHEQ, people.',
    enable: [
      'network',
      'suppliers',
      'customers',
      'inventory',
      'operations',
      'manufacturing',
      'distribution',
      'accounting',
      'people',
      'sheq',
      'quality',
      'projects',
      'sustainability',
      'intelligence',
    ],
  },
  {
    id: 'full',
    label: 'Everything',
    description: 'All modules visible — turn off what you do not need later.',
    enable: MODULE_NAV.map((m) => m.id),
  },
  {
    id: 'school_nsnp',
    label: 'SchoolAdvisor · School',
    description:
      'Public sector school kitchen — learners, catalogue, SPs, feeding & prizes (government process).',
    enable: ['schools', 'inventory', 'suppliers', 'network', 'quality', 'sheq'],
  },
  {
    id: 'dbe_agency',
    label: 'SchoolAdvisor · DBE / PEU',
    description:
      'Provincial/national education agency — approve schools, catalogue, PEU visits, claims, finance. (Not DoH.)',
    enable: ['schools', 'network', 'intelligence', 'accounting'],
  },
  {
    id: 'nsnp_isp',
    label: 'SchoolAdvisor · NSNP SP',
    description:
      'Service provider to schools — deliver + buy from wholesalers (suppliers, inventory, SchoolAdvisor).',
    enable: [
      'schools',
      'suppliers',
      'inventory',
      'network',
      'customers',
      'accounting',
    ],
  },
  {
    id: 'doh_agency',
    label: 'Department of Health (DoH)',
    description:
      'Standalone health programme: approve clinics & hospitals, catalogue, nutrition.',
    enable: ['health', 'network', 'intelligence', 'suppliers'],
  },
  {
    id: 'health_facility',
    label: 'Clinic / hospital',
    description:
      'Join DoH, order approved foods, kitchen and nutrition for health facilities.',
    enable: [
      'health',
      'inventory',
      'suppliers',
      'network',
      'quality',
      'sheq',
    ],
  },
];

export type CompanyModuleOption = {
  id: string;
  name: string;
  description: string;
  alwaysOn: boolean;
  category: ModuleCategoryId;
};

/** Platform hubs that are not a sector/industry vertical. */
export const CORE_WORKSPACE_MODULE_IDS = [
  'home',
  'my-business',
  'guide',
  'platform',
  'network',
  'suppliers',
  'customers',
  'sales-portal',
  'inventory',
  'operations',
  'manufacturing',
  'distribution',
  'accounting',
  'people',
  'sheq',
  'quality',
  'projects',
  'intelligence',
  'sustainability',
] as const;

/**
 * Core OS hubs a public-sector company (DBE, school, NSNP SP, DoH) may tick
 * on Company → Modules. Programme verticals stay forced on; other Advisors stay off.
 */
export const GOVERNMENT_CORE_MODULE_IDS = [
  'network',
  'suppliers',
  'customers',
  'sales-portal',
  'inventory',
  'operations',
  'manufacturing',
  'distribution',
  'accounting',
  'people',
  'sheq',
  'quality',
  'projects',
  'intelligence',
  'sustainability',
] as const;

export function isGovernmentCoreModule(id: string): boolean {
  return (GOVERNMENT_CORE_MODULE_IDS as readonly string[]).includes(id);
}

/** Industry Advisors — pack-subscribed verticals (not government programmes). */
export const INDUSTRY_ADVISOR_MODULE_IDS = [
  'fieldgraph',
  'quarrygraph',
  'fitgraph',
  'physiograph',
  'dentalgraph',
  'psychiatrygraph',
  'medicalgraph',
  'vetgraph',
  'hiregraph',
  'retailgraph',
  'containers',
] as const;

/** SchoolAdvisor® + HealthAdvisor® — platform admin sets up government orgs. */
export const GOVERNMENT_PROGRAMME_MODULE_IDS = ['schools', 'health'] as const;

/** Vertical OS hubs — belong to a sector / industry, not Core OS. */
export const VERTICAL_MODULE_IDS = [
  ...INDUSTRY_ADVISOR_MODULE_IDS,
  ...GOVERNMENT_PROGRAMME_MODULE_IDS,
] as const;

export function isIndustryAdvisorModule(id: string): boolean {
  return (INDUSTRY_ADVISOR_MODULE_IDS as readonly string[]).includes(id);
}

export function isGovernmentProgrammeModule(id: string): boolean {
  return (GOVERNMENT_PROGRAMME_MODULE_IDS as readonly string[]).includes(id);
}

/** True for the SupplierAdvisor control-plane company (management console). */
export function isSupplierAdvisorPlatformCompany(opts: {
  tradingName?: string | null;
  legalName?: string | null;
  metadata?: unknown;
}): boolean {
  const meta =
    opts.metadata && typeof opts.metadata === 'object' && !Array.isArray(opts.metadata)
      ? (opts.metadata as Record<string, unknown>)
      : {};
  if (
    meta.is_platform_company === true ||
    meta.platform_console === true ||
    String(meta.slug || '').toLowerCase() === 'supplieradvisor'
  ) {
    return true;
  }
  const names = [opts.tradingName, opts.legalName]
    .map((n) => String(n || '').trim())
    .filter(Boolean);
  for (const name of names) {
    const compact = name.replace(/\s+/g, '');
    if (/^supplier\s*advisor$/i.test(name) || /^supplieradvisor$/i.test(compact)) {
      return true;
    }
  }
  return false;
}

export const SECTOR_VERTICAL_MODULE_IDS: Record<string, readonly string[]> = {
  primary: ['fieldgraph', 'quarrygraph'],
  secondary: ['containers'],
  tertiary: [
    'fitgraph',
    'physiograph',
    'dentalgraph',
    'psychiatrygraph',
    'medicalgraph',
    'vetgraph',
    'hiregraph',
    'retailgraph',
  ],
  public_sector: ['schools', 'health'],
};

export type WorkspaceModuleLayer = 'core' | 'industry' | 'government';

export type WorkspaceModuleGroup = {
  layer: WorkspaceModuleLayer;
  title: string;
  blurb: string;
  moduleIds: string[];
};

const VERTICAL_ID_SET = new Set<string>(VERTICAL_MODULE_IDS);

function uniqueStrings(ids: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const v = String(id || '').trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/** Pack ids stored on chrome / profile metadata (including industry → pack). */
export function industryPackIdsFromMetadata(metadata: unknown): string[] {
  const meta =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const packs = Array.isArray(meta.industry_packs)
    ? meta.industry_packs.map(String)
    : [];
  const industries = [
    ...(meta.os_industry != null ? [String(meta.os_industry)] : []),
    ...(Array.isArray(meta.os_industries)
      ? meta.os_industries.map(String)
      : []),
  ];
  for (const id of industries) {
    const packIds = getIndustry(id)?.packIds || [];
    for (const pid of packIds) packs.push(String(pid));
  }
  return uniqueStrings(packs);
}

export function failOpenEnabledModules(): EnabledModulesMap {
  const map = normalizeEnabledModules(null);
  for (const id of Object.keys(map)) map[id] = true;
  return applyAdvisorCoreCompanions(map);
}

/**
 * Keep pack / founder Advisor hubs visible in the sidenav.
 * Slim chrome writes (sidenav order only) used to drop enabled_modules,
 * and missing Advisor keys default off — VUKA then lost GymAdvisor.
 */
export function applyAdvisorVisibility(opts: {
  map: EnabledModulesMap;
  packIds?: readonly string[] | null;
  companyId?: number | null;
  companyName?: string | null;
}): EnabledModulesMap {
  const next: EnabledModulesMap = { ...opts.map };
  for (const pid of opts.packIds || []) {
    const pack = getIndustryPack(String(pid));
    if (!pack) continue;
    for (const id of appModulesUnlockedByPack(pack)) {
      if (VERTICAL_ID_SET.has(id)) next[id] = true;
    }
  }
  if (
    isFounderLifetimeCompany({
      id: opts.companyId,
      tradingName: opts.companyName,
      legalName: opts.companyName,
    }) &&
    /vuka/i.test(String(opts.companyName || ''))
  ) {
    next.fitgraph = true;
  }
  if (Number(opts.companyId) === 110) {
    next.fitgraph = true;
  }
  return applyAdvisorCoreCompanions(next);
}

export function resolveVisibleModules(opts: {
  stored?: unknown;
  packaging?: { packIds?: string[] | null } | null;
  metadata?: unknown;
  companyId?: number | null;
  companyName?: string | null;
}): EnabledModulesMap {
  const map = normalizeEnabledModules(opts.stored);
  const packIds = uniqueStrings([
    ...(opts.packaging?.packIds || []),
    ...industryPackIdsFromMetadata(opts.metadata),
  ]);
  const next = applyAdvisorVisibility({
    map,
    packIds,
    companyId: opts.companyId,
    companyName: opts.companyName,
  });
  const platformCo = isSupplierAdvisorPlatformCompany({
    tradingName: opts.companyName,
    metadata: opts.metadata,
  });
  if (platformCo) next.platform = true;
  else next.platform = false;
  return next;
}

function uniqueExistingIds(
  ids: readonly string[],
  known: Set<string>
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Vertical hubs unlocked by industry packs (never core hubs). */
export function verticalModuleIdsForPacks(packIds: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const pid of packIds) {
    const pack = getIndustryPack(pid);
    if (!pack) continue;
    for (const id of appModulesUnlockedByPack(pack)) {
      if (!VERTICAL_ID_SET.has(id) || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Group workspace hubs: Core → Industry Advisors → Government.
 * Every subscriber sees all Core OS hubs. Industry Advisors list in full
 * (unlock by pack). SchoolAdvisor / HealthAdvisor are platform-admin only.
 */
export function groupWorkspaceModules(opts?: {
  sectorId?: string | null;
  industryIds?: string[];
  knownModuleIds?: string[];
  showPlatform?: boolean;
}): WorkspaceModuleGroup[] {
  const known = new Set(
    opts?.knownModuleIds?.length
      ? opts.knownModuleIds
      : MODULE_NAV.map((m) => m.id)
  );
  const coreList = CORE_WORKSPACE_MODULE_IDS.filter(
    (id) => id !== 'platform' || opts?.showPlatform
  );
  const coreIds = uniqueExistingIds(coreList, known);
  const industryIds = uniqueExistingIds(INDUSTRY_ADVISOR_MODULE_IDS, known);
  const governmentIds = uniqueExistingIds(
    GOVERNMENT_PROGRAMME_MODULE_IDS,
    known
  );

  return [
    {
      layer: 'core',
      title: 'Core OS',
      blurb:
        'Available to every subscriber — trade, ops, finance, people, assure, and insight. Tick the hubs this company uses.',
      moduleIds: coreIds,
    },
    {
      layer: 'industry',
      title: 'Industry Advisors',
      blurb:
        'Crop, quarry, gym, clinic, hire, retail and ContainerAdvisor. Subscribe to an Advisor pack to unlock, then tick the hub on.',
      moduleIds: industryIds,
    },
    {
      layer: 'government',
      title: 'Government programmes',
      blurb:
        'SchoolAdvisor® and HealthAdvisor®. Only SupplierAdvisor admin can set up a government organisation.',
      moduleIds: governmentIds,
    },
  ];
}

export function listCompanyModuleOptions(): CompanyModuleOption[] {
  const catById = new Map<string, ModuleCategoryId>();
  for (const cat of MODULE_CATEGORIES) {
    for (const id of cat.moduleIds) catById.set(id, cat.id);
  }
  return MODULE_NAV.map((m) => ({
    id: m.id,
    name: m.name,
    description: MODULE_DESCRIPTIONS[m.id] || m.name,
    alwaysOn: (ALWAYS_ON_MODULE_IDS as readonly string[]).includes(m.id),
    category: catById.get(m.id) || 'core_trade',
  }));
}

/** Build enablement map from a preset */
export function enabledModulesFromPreset(
  presetId: ModulePresetId
): EnabledModulesMap {
  const preset =
    MODULE_PRESETS.find((p) => p.id === presetId) || MODULE_PRESETS[0];
  const map = normalizeEnabledModules(null);
  const enable = new Set(preset.enable);
  for (const opt of listCompanyModuleOptions()) {
    if (opt.alwaysOn) {
      map[opt.id] = true;
    } else {
      map[opt.id] = enable.has(opt.id);
    }
  }
  return map;
}

/** True when company has saved an explicit modules choice (onboarding step) */
export function hasModulesConfigured(metadata: unknown): boolean {
  const meta =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  if (meta.modules_configured_at) return true;
  if (
    meta.enabled_modules &&
    typeof meta.enabled_modules === 'object' &&
    !Array.isArray(meta.enabled_modules)
  ) {
    return Object.keys(meta.enabled_modules as object).length > 0;
  }
  return false;
}

export function countEnabledOptionalModules(
  enabled: EnabledModulesMap
): { on: number; optional: number } {
  let on = 0;
  let optional = 0;
  for (const opt of listCompanyModuleOptions()) {
    if (opt.alwaysOn) continue;
    optional += 1;
    if (enabled[opt.id] !== false) on += 1;
  }
  return { on, optional };
}

export function isAlwaysOnModule(moduleId: string): boolean {
  return (ALWAYS_ON_MODULE_IDS as readonly string[]).includes(moduleId);
}

/**
 * Normalize stored map. Default every known module to true when unset.
 */
export function normalizeEnabledModules(
  raw: unknown
): EnabledModulesMap {
  const known = MODULE_NAV.map((m) => m.id);
  const map: EnabledModulesMap = {};
  const src =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  // Array form: list of enabled ids (legacy-friendly)
  if (Array.isArray(raw)) {
    const set = new Set(raw.map((x) => String(x)));
    for (const id of known) {
      map[id] = isAlwaysOnModule(id) ? true : set.has(id);
    }
    return map;
  }

  for (const id of known) {
    if (isAlwaysOnModule(id)) {
      map[id] = true;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(src, id)) {
      map[id] = src[id] === true || src[id] === 'true' || src[id] === 1;
    } else {
      // Sector programmes + CropAdvisor agri are opt-in; others default on
      map[id] =
        id === 'schools' ||
        id === 'health' ||
        id === 'fieldgraph' ||
        id === 'quarrygraph' ||
        id === 'fitgraph' ||
        id === 'physiograph' ||
        id === 'dentalgraph' ||
        id === 'psychiatrygraph' ||
        id === 'medicalgraph' ||
        id === 'vetgraph' ||
        id === 'hiregraph' ||
        id === 'retailgraph' ||
        id === 'containers' ||
        id === 'platform'
          ? false
          : true;
    }
  }
  return applyAdvisorCoreCompanions(map);
}

export function extractEnabledModulesFromMetadata(
  metadata: unknown,
  opts?: { companyId?: number | null; companyName?: string | null }
): EnabledModulesMap {
  const meta =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  return resolveVisibleModules({
    stored: meta.enabled_modules,
    metadata: meta,
    companyId: opts?.companyId,
    companyName: opts?.companyName,
  });
}

export function isModuleEnabled(
  enabled: EnabledModulesMap | null | undefined,
  moduleId: string
): boolean {
  if (isAlwaysOnModule(moduleId)) return true;
  if (!enabled) {
    // Fail open except opt-in sector programmes / CropAdvisor / platform console
    return (
      moduleId !== 'schools' &&
      moduleId !== 'health' &&
      moduleId !== 'fieldgraph' &&
      moduleId !== 'quarrygraph' &&
      moduleId !== 'fitgraph' &&
      moduleId !== 'physiograph' &&
      moduleId !== 'dentalgraph' &&
      moduleId !== 'psychiatrygraph' &&
      moduleId !== 'medicalgraph' &&
      moduleId !== 'vetgraph' &&
      moduleId !== 'hiregraph' &&
      moduleId !== 'retailgraph' &&
      moduleId !== 'containers' &&
      moduleId !== 'platform'
    );
  }
  if (Object.prototype.hasOwnProperty.call(enabled, moduleId)) {
    return enabled[moduleId] !== false;
  }
  return (
    moduleId !== 'schools' &&
    moduleId !== 'health' &&
    moduleId !== 'fieldgraph' &&
    moduleId !== 'quarrygraph' &&
    moduleId !== 'fitgraph' &&
    moduleId !== 'physiograph' &&
    moduleId !== 'dentalgraph' &&
    moduleId !== 'psychiatrygraph' &&
    moduleId !== 'medicalgraph' &&
    moduleId !== 'vetgraph' &&
    moduleId !== 'hiregraph' &&
    moduleId !== 'retailgraph' &&
    moduleId !== 'containers' &&
    moduleId !== 'platform'
  );
}

/** Sidebar / process rail: keep module if role allows AND company enabled it */
export function filterModulesByCompanyEnablement<
  T extends { id: string },
>(modules: T[], enabled: EnabledModulesMap | null | undefined): T[] {
  return modules.filter((m) => isModuleEnabled(enabled, m.id));
}

/**
 * Map dashboard path → module nav id for enablement checks.
 */
export function moduleIdForPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  if (pathname.startsWith('/sales')) return 'sales-portal';
  if (pathname === '/dashboard' || pathname === '/dashboard/') return 'home';
  if (pathname.startsWith('/dashboard/select-company')) return null;
  if (pathname.startsWith('/dashboard/my-business')) return 'my-business';
  if (pathname.startsWith('/dashboard/guide')) return 'guide';
  if (
    pathname.startsWith('/dashboard/connections') ||
    pathname.startsWith('/dashboard/network') ||
    pathname.startsWith('/dashboard/messages') ||
    pathname.startsWith('/dashboard/invite-business')
  ) {
    return 'network';
  }
  if (pathname.startsWith('/dashboard/suppliers') || pathname.startsWith('/dashboard/escrow')) {
    return 'suppliers';
  }
  if (
    pathname.startsWith('/dashboard/customers') ||
    pathname.startsWith('/dashboard/buyer') ||
    pathname.startsWith('/dashboard/settle')
  ) {
    return 'customers';
  }
  if (pathname.startsWith('/dashboard/containers')) return 'containers';
  if (pathname.startsWith('/dashboard/inventory')) return 'inventory';
  if (pathname.startsWith('/dashboard/operations')) return 'operations';
  if (pathname.startsWith('/dashboard/manufacturing')) return 'manufacturing';
  if (pathname.startsWith('/dashboard/distribution')) return 'distribution';
  if (pathname.startsWith('/dashboard/accounting') || pathname.startsWith('/dashboard/finance')) {
    return 'accounting';
  }
  if (pathname.startsWith('/dashboard/people')) return 'people';
  if (pathname.startsWith('/dashboard/sheq')) return 'sheq';
  if (pathname.startsWith('/dashboard/quality')) return 'quality';
  if (pathname.startsWith('/dashboard/projects')) return 'projects';
  if (pathname.startsWith('/dashboard/sustainability')) return 'sustainability';
  if (pathname.startsWith('/dashboard/intelligence')) return 'intelligence';
  if (pathname.startsWith('/dashboard/fieldgraph')) return 'fieldgraph';
  if (pathname.startsWith('/dashboard/quarrygraph')) return 'quarrygraph';
  if (pathname.startsWith('/dashboard/fitgraph')) return 'fitgraph';
  if (pathname.startsWith('/dashboard/physiograph')) return 'physiograph';
  if (pathname.startsWith('/dashboard/dentalgraph')) return 'dentalgraph';
  if (pathname.startsWith('/dashboard/psychiatrygraph')) return 'psychiatrygraph';
  if (pathname.startsWith('/dashboard/medicalgraph')) return 'medicalgraph';
  if (pathname.startsWith('/dashboard/vetgraph')) return 'vetgraph';
  if (pathname.startsWith('/dashboard/hiregraph')) return 'hiregraph';
  if (pathname.startsWith('/dashboard/retailgraph')) return 'retailgraph';
  if (pathname.startsWith('/dashboard/schools')) return 'schools';
  if (pathname.startsWith('/dashboard/health')) return 'health';
  if (pathname.startsWith('/dashboard/platform')) return 'platform';
  return null;
}

export function mergeEnabledModulesIntoMetadata(
  existingMetadata: unknown,
  enabledModules: EnabledModulesMap,
  opts?: { markConfigured?: boolean }
): Record<string, unknown> {
  const prev =
    existingMetadata &&
    typeof existingMetadata === 'object' &&
    !Array.isArray(existingMetadata)
      ? { ...(existingMetadata as Record<string, unknown>) }
      : {};
  return {
    ...prev,
    enabled_modules: normalizeEnabledModules(enabledModules),
    ...(opts?.markConfigured !== false
      ? {
          modules_configured_at:
            prev.modules_configured_at || new Date().toISOString(),
        }
      : {}),
  };
}

/** Type guard helper for MODULE_NAV export usage */
export type CompanyModuleNav = ModuleNav;
