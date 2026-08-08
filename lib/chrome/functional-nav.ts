/**
 * Functional side navigation order (brief 2026-08-09).
 * Packaging is NOT a top-level header — Industry Tools appears only when packs are active.
 */
import { MODULE_NAV, type ModuleNav } from '@/lib/chrome/module-nav';
import {
  INDUSTRY_PACKS,
  readPackagingFromMetadata,
  type PackagingSelection,
} from '@/lib/product/architecture';
import {
  Building2,
  ContactRound,
  UsersRound,
  Workflow,
  Warehouse,
  ClipboardCheck,
  Landmark,
  Brain,
  Layers,
  Network,
  Settings2,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';

/** Ordered functional sections for the sidebar */
export type FunctionalNavId =
  | 'control_tower'
  | 'suppliers'
  | 'customers'
  | 'operations'
  | 'inventory'
  | 'quality_compliance'
  | 'finance'
  | 'intelligence_impact'
  | 'industry_tools'
  | 'multi_entity'
  | 'administration';

export type FunctionalNavSection = {
  id: FunctionalNavId;
  name: string;
  icon: LucideIcon;
  href: string;
  /** MODULE_NAV ids folded into this section */
  moduleIds: string[];
  /** Hide unless industry packs active */
  requiresPacks?: boolean;
  /** Hide for school simplified nav unless pack unlocks */
  schoolDefault?: boolean;
};

/**
 * Canonical functional structure — maps onto existing MODULE_NAV hubs.
 * Do not use Core / Sector / Pack as sidebar headers.
 */
export const FUNCTIONAL_NAV: readonly FunctionalNavSection[] = [
  {
    id: 'control_tower',
    name: 'Control Tower',
    icon: LayoutDashboard,
    href: '/dashboard',
    moduleIds: ['home'],
    schoolDefault: true,
  },
  {
    id: 'suppliers',
    name: 'Suppliers',
    icon: ContactRound,
    href: '/dashboard/suppliers',
    moduleIds: ['suppliers'],
    schoolDefault: true,
  },
  {
    id: 'customers',
    name: 'Customers',
    icon: UsersRound,
    href: '/dashboard/customers',
    moduleIds: ['customers', 'sales-portal'],
    schoolDefault: false,
  },
  {
    id: 'operations',
    name: 'Operations',
    icon: Workflow,
    href: '/dashboard/operations',
    moduleIds: ['operations', 'manufacturing', 'distribution', 'schools', 'health'],
    schoolDefault: true,
  },
  {
    id: 'inventory',
    name: 'Inventory',
    icon: Warehouse,
    href: '/dashboard/inventory',
    moduleIds: ['inventory'],
    schoolDefault: true,
  },
  {
    id: 'quality_compliance',
    name: 'Quality & Compliance',
    icon: ClipboardCheck,
    href: '/dashboard/quality',
    moduleIds: ['quality', 'sheq', 'projects'],
    schoolDefault: false,
  },
  {
    id: 'finance',
    name: 'Finance',
    icon: Landmark,
    href: '/dashboard/accounting',
    moduleIds: ['accounting'],
    schoolDefault: false,
  },
  {
    id: 'intelligence_impact',
    name: 'Intelligence & Impact',
    icon: Brain,
    href: '/dashboard/intelligence',
    moduleIds: ['intelligence', 'sustainability'],
    schoolDefault: true,
  },
  {
    id: 'industry_tools',
    name: 'Industry Tools',
    icon: Layers,
    href: '/dashboard/industry-tools',
    moduleIds: ['containers'],
    requiresPacks: true,
    schoolDefault: false,
  },
  {
    id: 'multi_entity',
    name: 'Multi-entity',
    icon: Network,
    href: '/dashboard/my-business/group',
    moduleIds: [],
    schoolDefault: false,
  },
  {
    id: 'administration',
    name: 'Administration',
    icon: Settings2,
    href: '/dashboard/my-business',
    moduleIds: ['my-business', 'people', 'guide', 'network'],
    schoolDefault: true,
  },
] as const;

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
  /** Functional section id for ordering / chrome */
  functionalId?: FunctionalNavId;
};

function moduleById(id: string): ModuleNav | undefined {
  return MODULE_NAV.find((m) => m.id === id);
}

/**
 * Build sidebar modules in functional order, gated by company enablement + packs.
 */
export function functionalSidebarModules(opts: {
  isModuleEnabled: (id: string) => boolean;
  packaging?: PackagingSelection | null;
  /** School simplified experience */
  simplifiedSchool?: boolean;
}): SidebarModuleShape[] {
  const packIds = opts.packaging?.packIds || [];
  const hasPacks = packIds.length > 0;
  const out: SidebarModuleShape[] = [];
  const seen = new Set<string>();

  for (const section of FUNCTIONAL_NAV) {
    if (section.requiresPacks && !hasPacks) continue;
    if (opts.simplifiedSchool && section.schoolDefault === false) {
      // Still show if pack explicitly unlocked a module under this section
      const anyEnabled = section.moduleIds.some((id) => opts.isModuleEnabled(id));
      if (!anyEnabled && section.id !== 'control_tower') continue;
    }

    if (section.id === 'control_tower') {
      out.push({
        id: 'home',
        name: section.name,
        icon: section.icon,
        href: section.href,
        sub: [],
        functionalId: section.id,
      });
      seen.add('home');
      continue;
    }

    if (section.id === 'industry_tools') {
      const tools: SidebarModuleShape['sub'] = [];
      for (const pid of packIds) {
        const pack = INDUSTRY_PACKS.find((p) => p.id === pid);
        if (!pack) continue;
        for (const t of pack.industryToolsHrefs) {
          if (tools.some((x) => x.href === t.href)) continue;
          tools.push({
            name: t.name,
            href: t.href,
            desc: t.desc,
          });
        }
      }
      // Containers pack surfaces
      if (opts.isModuleEnabled('containers')) {
        const c = moduleById('containers');
        if (c) {
          for (const s of c.steps.slice(0, 4)) {
            if (tools.some((x) => x.href === s.href)) continue;
            tools.push({
              name: s.name,
              href: s.href,
              exact: s.exact,
              desc: s.desc,
            });
          }
        }
      }
      if (!tools.length && !opts.isModuleEnabled('containers')) continue;
      out.push({
        id: 'industry_tools',
        name: section.name,
        icon: section.icon,
        href: tools[0]?.href || section.href,
        sub: tools.length
          ? tools
          : [{ name: 'Overview', href: section.href, exact: true }],
        functionalId: section.id,
      });
      continue;
    }

    if (section.id === 'multi_entity') {
      out.push({
        id: 'multi_entity',
        name: section.name,
        icon: section.icon,
        href: section.href,
        sub: [
          {
            name: 'Group',
            href: '/dashboard/my-business/group',
            desc: 'Holding, subsidiaries, associations',
          },
        ],
        functionalId: section.id,
      });
      continue;
    }

    // Fold enabled modules under this section (first primary hub is the section root)
    const enabledMods = section.moduleIds
      .map((id) => moduleById(id))
      .filter((m): m is ModuleNav => Boolean(m && opts.isModuleEnabled(m.id)));

    if (!enabledMods.length) {
      // Administration always shows company hub
      if (section.id === 'administration') {
        const mb = moduleById('my-business');
        if (mb) {
          out.push({
            id: mb.id,
            name: section.name,
            icon: section.icon,
            href: mb.href,
            sub: mb.steps.map((s) => ({
              name: s.name,
              href: s.href,
              exact: Boolean(s.exact),
              group: s.group,
              section: s.section,
              rail: s.rail !== false,
              desc: s.desc,
            })),
            functionalId: section.id,
          });
          seen.add(mb.id);
        }
      }
      continue;
    }

    // Primary module for section name/href; merge steps from all folded modules
    const primary = enabledMods[0];
    if (seen.has(primary.id) && section.moduleIds.length === 1) continue;

    const sub: SidebarModuleShape['sub'] = [];
    for (const mod of enabledMods) {
      if (seen.has(mod.id) && mod.id !== primary.id) {
        // still merge unique steps
      }
      for (const s of mod.steps) {
        if (sub.some((x) => x.href === s.href)) continue;
        sub.push({
          name: s.name,
          href: s.href,
          exact: Boolean(s.exact),
          group: s.group || (enabledMods.length > 1 ? mod.name : undefined),
          section: s.section,
          rail: s.rail !== false,
          desc: s.desc,
        });
      }
      seen.add(mod.id);
    }

    out.push({
      id: primary.id,
      name: section.name,
      icon: section.icon,
      href: primary.href,
      sub,
      functionalId: section.id,
    });
  }

  // Any remaining enabled modules not folded (fallback)
  for (const m of MODULE_NAV) {
    if (seen.has(m.id)) continue;
    if (m.id === 'home') continue;
    if (!opts.isModuleEnabled(m.id)) continue;
    out.push({
      id: m.id,
      name: m.name,
      icon: m.icon,
      href: m.href,
      sub: m.steps.map((s) => ({
        name: s.name,
        href: s.href,
        exact: Boolean(s.exact),
        group: s.group,
        section: s.section,
        rail: s.rail !== false,
        desc: s.desc,
      })),
    });
    seen.add(m.id);
  }

  return out;
}

export function packagingFromCompanyMeta(
  meta: unknown
): PackagingSelection | null {
  if (!meta || typeof meta !== 'object') return null;
  return readPackagingFromMetadata(meta as Record<string, unknown>);
}

/** Display alias: Company hub → Administration label already applied above */
export { Building2 };
