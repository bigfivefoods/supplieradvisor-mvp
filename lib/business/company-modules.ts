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

export type CompanyModuleOption = {
  id: string;
  name: string;
  description: string;
  alwaysOn: boolean;
};

const MODULE_DESCRIPTIONS: Record<string, string> = {
  'sales-portal': 'Sales contractor portal, pipeline, quotes & earnings',
  network: 'Connections, pricing agreements, marketplace, invites',
  suppliers: 'SRM book, discover, POs, performance & ratings',
  customers: 'CRM, quotes, invoices, money hub & settle',
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
  intelligence: 'Pulse, forecasts, scorecards & leadership',
  home: 'Command centre home',
  'my-business': 'Company profile, team, billing & ops',
  guide: 'In-app training curriculum',
};

export function listCompanyModuleOptions(): CompanyModuleOption[] {
  return MODULE_NAV.map((m) => ({
    id: m.id,
    name: m.name,
    description: MODULE_DESCRIPTIONS[m.id] || m.name,
    alwaysOn: (ALWAYS_ON_MODULE_IDS as readonly string[]).includes(m.id),
  }));
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
      map[id] = true; // default all selected
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
  if (!enabled) return true; // fail open until loaded
  if (Object.prototype.hasOwnProperty.call(enabled, moduleId)) {
    return enabled[moduleId] !== false;
  }
  return true;
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
  enabledModules: EnabledModulesMap
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
  };
}

/** Type guard helper for MODULE_NAV export usage */
export type CompanyModuleNav = ModuleNav;
