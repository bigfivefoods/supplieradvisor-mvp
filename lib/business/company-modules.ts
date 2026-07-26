/**
 * Company-level module enablement (sidebar visibility).
 * Stored in profiles.metadata.enabled_modules as Record<moduleId, boolean>.
 * Missing keys default to true (all selected).
 */

import type { ModuleNav } from '@/lib/chrome/module-nav';
import { MODULE_NAV } from '@/lib/chrome/module-nav';

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
  customers: 'CRM: source, connect, quote, invoice, rate & report buyers',
  containers: 'Container outlets, resellers, contractors & impact',
  inventory: 'Products, stock, lots, transfers & counts',
  operations: 'Inbound, warehouse, production, outbound control tower',
  manufacturing: 'MPS, MRP, BOM, production orders & work centres',
  distribution: 'Inbound/outbound logistics, tracking & carriers',
  accounting: 'Books, bank recon, journals, tax & reports',
  people: 'HR directory, payroll, leave, org chart & training',
  sheq: 'OH&S, NCR/CAPA, safety incidents',
  quality: 'Inspections, holds, quality assurance',
  projects: 'Portfolio, kanban, milestones & timesheets',
  sustainability: 'Carbon tracking, ESG packs & impact',
  intelligence: 'Pulse, forecasts, scorecards & Super-Cube® leadership',
  schools:
    'NSNP schools: kitchen, learners, SPs, approved brands, feeding, prizes',
  home: 'Command centre home',
  'my-business': 'Company profile, team, modules, billing & trust',
  guide: 'In-app training curriculum',
};

/** Logical groups for the Modules workspace UI */
export type ModuleCategoryId =
  | 'core'
  | 'trade'
  | 'operations'
  | 'finance'
  | 'people'
  | 'compliance'
  | 'intelligence'
  | 'programmes';

export const MODULE_CATEGORIES: Array<{
  id: ModuleCategoryId;
  title: string;
  blurb: string;
  moduleIds: string[];
}> = [
  {
    id: 'core',
    title: 'Always on',
    blurb: 'Identity, home, and help — never turn these off.',
    moduleIds: ['home', 'my-business', 'guide'],
  },
  {
    id: 'trade',
    title: 'Trade network',
    blurb: 'Find partners, buy, sell, and settle money.',
    moduleIds: ['network', 'suppliers', 'customers', 'sales-portal'],
  },
  {
    id: 'operations',
    title: 'Operations',
    blurb: 'Stock, production, logistics, and outlets.',
    moduleIds: [
      'inventory',
      'operations',
      'manufacturing',
      'distribution',
      'containers',
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    blurb: 'General ledger, bank, tax, and management packs.',
    moduleIds: ['accounting'],
  },
  {
    id: 'people',
    title: 'People',
    blurb: 'Team beyond Company → Team: HR, leave, payroll.',
    moduleIds: ['people'],
  },
  {
    id: 'compliance',
    title: 'Quality & compliance',
    blurb: 'SHEQ, quality, projects, and ESG.',
    moduleIds: ['sheq', 'quality', 'projects', 'sustainability'],
  },
  {
    id: 'intelligence',
    title: 'Intelligence',
    blurb: 'Pulse, insights, forecasts, Super-Cube® leadership.',
    moduleIds: ['intelligence'],
  },
  {
    id: 'programmes',
    title: 'Programmes',
    blurb: 'Sector programmes — NSNP schools, kitchens, approved brands.',
    moduleIds: ['schools'],
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
  | 'nsnp_isp';

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
    label: 'School / NSNP',
    description:
      'School kitchen, learners, approved brands, SPs, feeding & prizes.',
    enable: ['schools', 'inventory', 'suppliers', 'network', 'quality', 'sheq'],
  },
  {
    id: 'dbe_agency',
    label: 'DBE / PEU agency',
    description:
      'Approve schools, catalogue, PEU visits, claims, multi-school nutrition.',
    enable: ['schools', 'network', 'intelligence'],
  },
  {
    id: 'nsnp_isp',
    label: 'NSNP SP',
    description:
      'Deliver to schools + buy from wholesalers (suppliers, inventory, schools).',
    enable: [
      'schools',
      'suppliers',
      'inventory',
      'network',
      'customers',
      'accounting',
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
    category: catById.get(m.id) || 'trade',
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
      // Schools / NSNP is opt-in (sector programme); other modules default on
      map[id] = id === 'schools' ? false : true;
    }
  }
  return map;
}

export function extractEnabledModulesFromMetadata(
  metadata: unknown
): EnabledModulesMap {
  const meta =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  return normalizeEnabledModules(meta.enabled_modules);
}

export function isModuleEnabled(
  enabled: EnabledModulesMap | null | undefined,
  moduleId: string
): boolean {
  if (isAlwaysOnModule(moduleId)) return true;
  if (!enabled) return moduleId !== 'schools'; // fail open except opt-in schools
  if (Object.prototype.hasOwnProperty.call(enabled, moduleId)) {
    return enabled[moduleId] !== false;
  }
  return moduleId !== 'schools';
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
