/**
 * Per-member module visibility (what a user sees when they log in).
 *
 * Stored on business_users.permissions jsonb:
 *   { allowed_modules?: Record<moduleId, boolean> | null }
 *
 * - null / missing → inherit all company-enabled modules
 * - present map (including {}) → only modules set true (∩ company-enabled)
 * - Always-on modules (home, my-business, guide) always on
 * - Owners always inherit company modules (cannot be locked out)
 */

import {
  ALWAYS_ON_MODULE_IDS,
  isModuleEnabled,
  normalizeEnabledModules,
  type EnabledModulesMap,
} from '@/lib/business/company-modules';
import { normalizeTeamRole, type TeamRole } from '@/lib/business/permissions';

export type MemberPermissionsBlob = {
  allowed_modules?: EnabledModulesMap | null;
  sidebar_module_order?: string[] | null;
  [key: string]: unknown;
};

function isAllowedTrue(v: unknown): boolean {
  return v === true || v === 1 || v === 'true';
}

export function extractSidebarModuleOrder(
  permissions: unknown
): string[] {
  const p = parseMemberPermissions(permissions);
  if (!Array.isArray(p.sidebar_module_order)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of p.sidebar_module_order) {
    const id = String(item || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function mergeSidebarOrderIntoPermissions(
  existing: unknown,
  order: string[]
): MemberPermissionsBlob {
  const base = parseMemberPermissions(existing);
  return {
    ...base,
    sidebar_module_order: extractSidebarModuleOrder({
      sidebar_module_order: order,
    }),
  };
}

export function parseMemberPermissions(raw: unknown): MemberPermissionsBlob {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return p && typeof p === 'object' && !Array.isArray(p)
        ? (p as MemberPermissionsBlob)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as MemberPermissionsBlob;
  }
  return {};
}

/**
 * True when the member has an explicit custom module allow-list.
 * Empty `{}` means “only always-on modules” (not inherit-all).
 */
export function hasCustomModuleAccess(permissions: unknown): boolean {
  const p = parseMemberPermissions(permissions);
  const m = p.allowed_modules;
  return Boolean(m) && typeof m === 'object' && !Array.isArray(m);
}

/**
 * Slim allow-list of module ids set true. Missing keys are OFF.
 * Do not run this through normalizeEnabledModules — that map defaults
 * unset core hubs to on, which undoes every unchecked box on reload.
 * null = inherit all company-enabled modules.
 */
export function extractAllowedModules(
  permissions: unknown
): EnabledModulesMap | null {
  if (!hasCustomModuleAccess(permissions)) return null;
  const p = parseMemberPermissions(permissions);
  const m = p.allowed_modules;
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  const slim: EnabledModulesMap = {};
  for (const [k, v] of Object.entries(m)) {
    const id = String(k || '').trim();
    if (!id) continue;
    if (isAllowedTrue(v)) slim[id] = true;
  }
  return slim;
}

/**
 * Effective modules a user sees in the sidebar after login:
 * company enabled ∩ (custom allow-list | inherit all company-enabled).
 * Owners always get full company modules.
 */
export function effectiveModulesForMember(opts: {
  companyEnabled: EnabledModulesMap;
  permissions?: unknown;
  role?: string | null;
}): EnabledModulesMap {
  const company = normalizeEnabledModules(opts.companyEnabled);
  const role = normalizeTeamRole(opts.role);

  // Owners always see every company-enabled module
  if (role === 'owner') {
    return { ...company };
  }

  const custom = extractAllowedModules(opts.permissions);
  if (!custom) {
    return { ...company };
  }

  const out: EnabledModulesMap = {};
  for (const id of Object.keys(company)) {
    const alwaysOn = (ALWAYS_ON_MODULE_IDS as readonly string[]).includes(id);
    if (alwaysOn) {
      out[id] = true;
      continue;
    }
    // Must be on for company AND explicitly allowed for member
    out[id] = Boolean(company[id]) && custom[id] === true;
  }
  // Keep always-on even if missing from company map
  for (const id of ALWAYS_ON_MODULE_IDS) {
    out[id] = true;
  }
  return out;
}

export function mergeAllowedModulesIntoPermissions(
  existing: unknown,
  allowed: EnabledModulesMap | null
): MemberPermissionsBlob {
  const base = parseMemberPermissions(existing);
  if (allowed === null) {
    const next = { ...base };
    delete next.allowed_modules;
    return next;
  }
  // Only store explicit trues. Empty map = custom, always-on only.
  const slim: EnabledModulesMap = {};
  for (const [k, v] of Object.entries(allowed)) {
    if ((ALWAYS_ON_MODULE_IDS as readonly string[]).includes(k)) continue;
    if (isAllowedTrue(v)) slim[k] = true;
  }
  return { ...base, allowed_modules: slim };
}

/** Whether this member may open a module id (after company + custom) */
export function memberCanSeeModule(
  moduleId: string,
  companyEnabled: EnabledModulesMap,
  permissions: unknown,
  role?: string | null
): boolean {
  const eff = effectiveModulesForMember({
    companyEnabled,
    permissions,
    role,
  });
  return isModuleEnabled(eff, moduleId);
}

export type { TeamRole };
