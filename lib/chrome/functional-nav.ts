/**
 * Functional side navigation order (brief 2026-08-09).
 *
 * CRITICAL: Never fold multiple MODULE_NAV hubs into one item.
 * Each existing module keeps its full step tree (Source, Book, Order, …).
 * We only reorder + rename labels for functional clarity.
 * Industry Tools is additive when packs are active.
 */
import { MODULE_NAV, type ModuleNav } from '@/lib/chrome/module-nav';
import {
  INDUSTRY_PACKS,
  readPackagingFromMetadata,
  type PackagingSelection,
} from '@/lib/product/architecture';
import {
  Layers,
  Network,
  type LucideIcon,
} from 'lucide-react';

/** Functional ordering of existing MODULE_NAV ids (1:1, full trees preserved). */
export const FUNCTIONAL_MODULE_ORDER: readonly string[] = [
  'home', // Control Tower (command center)
  'platform', // SupplierAdvisor platform admin (opt-in / platform company only)
  'my-business', // Company — directly below command
  'suppliers',
  'customers',
  'sales-portal', // under trade — keep as own hub so Sales features stay
  'operations',
  'manufacturing', // Make — not merged into Operations
  'distribution', // Ship
  'inventory',
  'quality',
  'sheq',
  'projects',
  'accounting', // Finance
  'intelligence',
  'sustainability', // Impact
  'fieldgraph', // Fieldgraph® agri OS — primary production
  'quarrygraph', // Quarrygraph® quarrying & aggregates OS
  'containers', // Industry vertical — also listed under Industry Tools when packs on
  'fitgraph', // Fitgraph® — tertiary services (gyms / studios)
  'schools', // Programme — full NSNP tree
  'health', // Programme — full DoH tree
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
  fieldgraph: 'Fieldgraph',
  quarrygraph: 'Quarrygraph',
  fitgraph: 'Fitgraph (Gym)',
  containers: 'Containers',
  schools: 'Schools',
  health: 'Health',
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
 * - Ordered for functional daily work
 * - Industry Tools added when packs active (does not replace Containers / Schools)
 * - Multi-entity shortcut without removing Company → Group
 */
export function functionalSidebarModules(opts: {
  isModuleEnabled: (id: string) => boolean;
  packaging?: PackagingSelection | null;
  simplifiedSchool?: boolean;
}): SidebarModuleShape[] {
  const packIds = opts.packaging?.packIds || [];
  const hasPacks = packIds.length > 0;
  const out: SidebarModuleShape[] = [];
  const seen = new Set<string>();

  const shouldShowModule = (id: string): boolean => {
    if (!opts.isModuleEnabled(id)) return false;
    if (!opts.simplifiedSchool) return true;
    // Schools: priority modules always if enabled; others only if pack unlocked them
    if (SCHOOL_PRIORITY_MODULE_IDS.has(id)) return true;
    // Pack-driven extras (e.g. containers from logistics pack)
    return opts.isModuleEnabled(id);
  };

  for (const id of FUNCTIONAL_MODULE_ORDER) {
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

  // Industry Tools — additive hub (packs + deep links into existing modules)
  if (hasPacks) {
    const tools = buildIndustryToolsSubs(packIds, opts.isModuleEnabled);
    if (tools.length) {
      // After Impact / before Containers when present; else before Network/People/Guide tail
      const insertAt = (() => {
        const containersIdx = out.findIndex((x) => x.id === 'containers');
        if (containersIdx >= 0) return containersIdx;
        const impactIdx = out.findIndex((x) => x.id === 'sustainability');
        if (impactIdx >= 0) return impactIdx + 1;
        const networkIdx = out.findIndex((x) => x.id === 'network');
        if (networkIdx >= 0) return networkIdx;
        return out.length;
      })();
      const item: SidebarModuleShape = {
        id: 'industry_tools',
        name: 'Industry Tools',
        icon: Layers,
        href: '/dashboard/industry-tools',
        sub: [
          {
            name: 'Overview',
            href: '/dashboard/industry-tools',
            exact: true,
            desc: 'Packs & vertical tools',
          },
          ...tools,
        ],
        functionalId: 'industry_tools',
      };
      out.splice(insertAt, 0, item);
    }
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

  return out;
}

/** Collect pack tool links + preserve entry points into full modules */
function buildIndustryToolsSubs(
  packIds: string[],
  isModuleEnabled: (id: string) => boolean
): SidebarModuleShape['sub'] {
  const tools: SidebarModuleShape['sub'] = [];
  const seenHref = new Set<string>();

  const push = (name: string, href: string, desc?: string) => {
    if (seenHref.has(href)) return;
    seenHref.add(href);
    tools.push({ name, href, desc });
  };

  for (const pid of packIds) {
    const pack = INDUSTRY_PACKS.find((p) => p.id === pid);
    if (!pack) continue;
    for (const t of pack.industryToolsHrefs) {
      push(`${pack.shortName}: ${t.name}`, t.href, t.desc);
    }
  }

  // When containers module on, expose hub (full module still in main nav)
  if (isModuleEnabled('containers')) {
    push('Containers hub', '/dashboard/containers', 'Full container OS');
  }
  if (isModuleEnabled('schools')) {
    push('Schools / NSNP hub', '/dashboard/schools', 'Full schools programme');
  }
  if (isModuleEnabled('manufacturing')) {
    push('Make · MPS/MRP', '/dashboard/manufacturing', 'Full manufacturing');
  }
  if (isModuleEnabled('sustainability')) {
    push('Impact / ESG', '/dashboard/sustainability', 'Full impact module');
  }

  return tools;
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
