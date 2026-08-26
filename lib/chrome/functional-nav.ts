/**
 * Functional side navigation order (brief 2026-08-09).
 *
 * CRITICAL: Never fold multiple MODULE_NAV hubs into one item.
 * Each existing module keeps its full step tree (Source, Book, Order, …).
 * We only reorder + rename labels for functional clarity.
 * Advisor OS hubs always sit at the top of the sidenav.
 */
import { MODULE_NAV, type ModuleNav } from '@/lib/chrome/module-nav';
import { applySidebarModuleOrder } from '@/lib/chrome/sidebar-order';
import { ADVISOR_CORE_COMPANIONS } from '@/lib/product/advisor-core-unlocks';
import {
  readPackagingFromMetadata,
  type PackagingSelection,
} from '@/lib/product/architecture';
import { Network, type LucideIcon } from 'lucide-react';

/**
 * Advisor / programme OS hubs. When a company has one of these enabled
 * (or a pack that unlocks it), that hub is pinned first in the sidenav.
 */
export const ADVISOR_OS_MODULE_IDS = [
  'fitgraph',
  'physiograph',
  'dentalgraph',
  'psychiatrygraph',
  'medicalgraph',
  'hiregraph',
  'retailgraph',
  'quarrygraph',
  'fieldgraph',
  'schools',
  'health',
  'containers',
] as const;
export type AdvisorOsModuleId = (typeof ADVISOR_OS_MODULE_IDS)[number];

const PACK_TO_ADVISOR_MODULE: Record<string, AdvisorOsModuleId> = {
  fitness_gym: 'fitgraph',
  allied_health_clinic: 'physiograph',
  allied_health: 'physiograph',
  dental: 'dentalgraph',
  medical_practice: 'medicalgraph',
  medical: 'medicalgraph',
  psychiatry: 'psychiatrygraph',
  staffing_hire: 'hiregraph',
  retail_shop: 'retailgraph',
  quarry_aggregates: 'quarrygraph',
  agri_regen: 'fieldgraph',
  public_procurement: 'schools',
  logistics_containers: 'containers',
};

/**
 * This company's Advisor OS module(s), primary pack first.
 * Always returned when enabled so they stay pinned at the top of the sidenav.
 */
export function advisorModulesForCompany(opts: {
  isModuleEnabled: (id: string) => boolean;
  packaging?: PackagingSelection | null;
}): string[] {
  const enabled: string[] = ADVISOR_OS_MODULE_IDS.filter((id) =>
    opts.isModuleEnabled(id)
  );
  if (!enabled.length) return [];

  const fromPacks: string[] = [];
  for (const pid of opts.packaging?.packIds || []) {
    const mapped = PACK_TO_ADVISOR_MODULE[String(pid)];
    const id = typeof mapped === 'string' ? mapped : '';
    if (id && enabled.includes(id) && !fromPacks.includes(id)) {
      fromPacks.push(id);
    }
  }
  if (fromPacks.length) {
    return [
      ...fromPacks,
      ...enabled.filter((id) => !fromPacks.includes(id)),
    ];
  }
  return [...enabled];
}

function isAdvisorOsModule(id: string): boolean {
  return (ADVISOR_OS_MODULE_IDS as readonly string[]).includes(id);
}

/** Keep Advisor hubs first; preserve relative order among them and among the rest. */
export function pinAdvisorHubsFirst<T extends { id: string }>(modules: T[]): T[] {
  const advisors: T[] = [];
  const rest: T[] = [];
  for (const m of modules) {
    if (isAdvisorOsModule(m.id)) advisors.push(m);
    else rest.push(m);
  }
  if (!advisors.length) return modules;
  return [...advisors, ...rest];
}

/**
 * Functional ordering of existing MODULE_NAV ids (1:1, full trees preserved).
 * 1) Advisor OS hubs (always pinned to the top of the sidenav)
 * 2) Control Tower (+ Platform admin)
 * 3) Core modules
 */
export const FUNCTIONAL_MODULE_ORDER: readonly string[] = [
  // 1 — Advisor OS hubs (pinned first when enabled)
  'fitgraph', // GymAdvisor® gym / studio OS
  'physiograph', // PhysioAdvisor® clinic / physio OS
  'dentalgraph', // DentalAdvisor® dental practice OS
  'psychiatrygraph', // PsychiatryAdvisor® mental health OS
  'medicalgraph', // MedicalAdvisor® medical practice OS
  'hiregraph', // HireAdvisor® hire / rental marketplace (members free)
  'retailgraph', // RetailAdvisor® B2C till OS
  'quarrygraph', // QuarryAdvisor® aggregates OS
  'fieldgraph', // CropAdvisor® agri OS
  'schools', // SchoolAdvisor® (public sector / NSNP)
  'health', // HealthAdvisor (public sector / provincial)
  'containers', // ContainerAdvisor

  // 2 — Command / Control Tower
  'home', // Control Tower
  'platform', // Platform admin — under Control Tower (SupplierAdvisor business)

  // 3 — Core modules
  'my-business', // Company
  'suppliers',
  'customers',
  'sales-portal',
  'operations',
  'manufacturing',
  'distribution',
  'inventory',
  'quality',
  'sheq',
  'projects',
  'accounting',
  'intelligence',
  'sustainability',
  'network',
  'people',
  'guide',
] as const;

/** Display labels for functional chrome (hrefs + steps unchanged). */
export const FUNCTIONAL_DISPLAY_NAME: Record<string, string> = {
  home: 'Control Tower',
  platform: 'Platform',
  'my-business': 'Company',
  suppliers: 'Suppliers',
  customers: 'Customers',
  'sales-portal': 'Sales',
  operations: 'Operations',
  manufacturing: 'Make',
  distribution: 'Ship',
  inventory: 'Inventory',
  quality: 'Quality',
  sheq: 'SHEQ',
  projects: 'Projects',
  accounting: 'Finance',
  intelligence: 'Intelligence',
  sustainability: 'Impact',
  fieldgraph: 'CropAdvisor',
  quarrygraph: 'QuarryAdvisor',
  fitgraph: 'GymAdvisor (Gym)',
  physiograph: 'PhysioAdvisor (Clinic)',
  dentalgraph: 'DentalAdvisor (Dental)',
  psychiatrygraph: 'PsychiatryAdvisor (Mental health)',
  medicalgraph: 'MedicalAdvisor (Medical)',
  hiregraph: 'HireAdvisor (Hire / rent)',
  retailgraph: 'RetailAdvisor (Till)',
  containers: 'ContainerAdvisor',
  schools: 'SchoolAdvisor',
  health: 'HealthAdvisor',
  network: 'Network',
  people: 'People',
  guide: 'Guide',
};

/**
 * School simplified experience: still show these modules when enabled,
 * with FULL step trees (kitchen, orders, serve day, etc. stay under Schools).
 * Other modules only appear if pack-enabled or company explicitly enabled.
 */
export const SCHOOL_PRIORITY_MODULE_IDS = new Set([
  'home',
  'schools',
  'suppliers',
  'inventory',
  'operations',
  'network',
  'sustainability',
  'intelligence',
  'quality',
  'sheq',
  'my-business',
  'guide',
  'accounting', // optional but keep if enabled
]);

export type SidebarModuleShape = {
  id: string;
  name: string;
  icon: LucideIcon;
  href: string;
  sub: Array<{
    name: string;
    href: string;
    exact?: boolean;
    group?: string;
    section?: string;
    rail?: boolean;
    desc?: string;
  }>;
  /** Optional functional section tag for chrome */
  functionalId?: string;
};

function moduleById(id: string): ModuleNav | undefined {
  return MODULE_NAV.find((m) => m.id === id);
}

function stepsFromModule(m: ModuleNav): SidebarModuleShape['sub'] {
  return m.steps.map((s) => ({
    name: s.name,
    href: s.href,
    exact: Boolean(s.exact),
    group: s.group,
    section: s.section,
    rail: s.rail !== false,
    desc: s.desc,
  }));
}

/**
 * Build sidebar modules:
 * - Every enabled MODULE_NAV hub is its own item with complete steps
 * - Advisor OS hubs always sit at the top (even after a saved custom order)
 * - Multi-entity shortcut without removing Company → Group
 */
export function functionalSidebarModules(opts: {
  isModuleEnabled: (id: string) => boolean;
  packaging?: PackagingSelection | null;
  simplifiedSchool?: boolean;
  moduleOrder?: string[] | null;
}): SidebarModuleShape[] {
  const packIds = opts.packaging?.packIds || [];
  const out: SidebarModuleShape[] = [];
  const seen = new Set<string>();
  const pinnedAdvisors = advisorModulesForCompany(opts);
  // People / members / finance sit with the Advisor hub on focused workspaces.
  // All-on / platform companies already list every Advisor at the top.
  const focusedAdvisorWorkspace =
    pinnedAdvisors.length > 0 && pinnedAdvisors.length < 6;
  const companionCore: string[] = focusedAdvisorWorkspace
    ? ADVISOR_CORE_COMPANIONS.filter(
        (id) => opts.isModuleEnabled(id) && !pinnedAdvisors.includes(id)
      )
    : [];
  const moduleOrder = [
    ...pinnedAdvisors,
    ...companionCore,
    ...FUNCTIONAL_MODULE_ORDER.filter(
      (id) => !pinnedAdvisors.includes(id) && !companionCore.includes(id)
    ),
  ];

  const shouldShowModule = (id: string): boolean => {
    if (!opts.isModuleEnabled(id)) return false;
    if (!opts.simplifiedSchool) return true;
    // Schools: priority modules always if enabled; others only if pack unlocked them
    if (SCHOOL_PRIORITY_MODULE_IDS.has(id)) return true;
    // Pack-driven extras (e.g. containers from logistics pack)
    return opts.isModuleEnabled(id);
  };

  for (const id of moduleOrder) {
    if (seen.has(id)) continue;
    if (!shouldShowModule(id)) continue;
    const m = moduleById(id);
    if (!m) continue;

    const name = FUNCTIONAL_DISPLAY_NAME[id] || m.name;

    out.push({
      id: m.id,
      name,
      icon: m.icon,
      href: m.href,
      // FULL tree — never slice
      sub: stepsFromModule(m),
      functionalId: id,
    });
    seen.add(id);
  }

  // Any MODULE_NAV hub not in the order list (future-proof) — still full tree
  for (const m of MODULE_NAV) {
    if (seen.has(m.id)) continue;
    if (m.id === 'home') continue;
    if (!shouldShowModule(m.id)) continue;
    out.push({
      id: m.id,
      name: FUNCTIONAL_DISPLAY_NAME[m.id] || m.name,
      icon: m.icon,
      href: m.href,
      sub: stepsFromModule(m),
    });
    seen.add(m.id);
  }

  // Multi-entity shortcut (does not remove Company → Group step) — sit just after Company
  const multi: SidebarModuleShape = {
    id: 'multi_entity',
    name: 'Multi-entity',
    icon: Network,
    href: '/dashboard/my-business/group',
    sub: [
      {
        name: 'Group structure',
        href: '/dashboard/my-business/group',
        desc: 'Holding, subsidiaries, associations',
      },
    ],
    functionalId: 'multi_entity',
  };
  // Show for non-school or when packaging implies multi-entity
  const showMulti =
    !opts.simplifiedSchool ||
    packIds.includes('public_procurement') ||
    opts.packaging?.entityTypeId === 'provincial' ||
    opts.packaging?.entityTypeId === 'national' ||
    opts.packaging?.entityTypeId === 'municipal';
  if (showMulti) {
    const companyIdx = out.findIndex((x) => x.id === 'my-business');
    if (companyIdx >= 0) out.splice(companyIdx + 1, 0, multi);
    else out.push(multi);
  }

  return pinAdvisorHubsFirst(applySidebarModuleOrder(out, opts.moduleOrder));
}

export function packagingFromCompanyMeta(
  meta: unknown
): PackagingSelection | null {
  if (!meta || typeof meta !== 'object') return null;
  return readPackagingFromMetadata(meta as Record<string, unknown>);
}

/**
 * Assert helper for tests / docs: every MODULE_NAV id has a place in order or fallback.
 */
export function allModuleNavIdsPreserved(): boolean {
  const ordered = new Set(FUNCTIONAL_MODULE_ORDER);
  return MODULE_NAV.every((m) => ordered.has(m.id) || m.id === 'home');
}
