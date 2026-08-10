/**
 * Per-member module visibility (what a user sees when they log in).
 *
 * Stored on business_users.permissions jsonb:
 *   { allowed_modules?: Record<moduleId, boolean> | null }
 *
 * - null / missing / empty → inherit all company-enabled modules
 * - non-empty map → only modules set true (∩ company-enabled)
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
  [key: string]: unknown;
};

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

/** True when the member has an explicit custom module allow-list */
export function hasCustomModuleAccess(permissions: unknown): boolean {
  const p = parseMemberPermissions(permissions);
  const m = p.allowed_modules;
  if (!m || typeof m !== 'object' || Array.isArray(m)) return false;
  return Object.keys(m).length > 0;
}

/**
 * Extract allowed_modules map from permissions (null = inherit company).
 */
export function extractAllowedModules(
  permissions: unknown
): EnabledModulesMap | null {
  if (!hasCustomModuleAccess(permissions)) return null;
  const p = parseMemberPermissions(permissions);
  return normalizeEnabledModules(p.allowed_modules || {});
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
  if (!allowed || Object.keys(allowed).length === 0) {
    const next = { ...base };
    delete next.allowed_modules;
    return next;
  }
  // Only store explicit trues for selectable modules
  const slim: EnabledModulesMap = {};
  for (const [k, v] of Object.entries(allowed)) {
    if ((ALWAYS_ON_MODULE_IDS as readonly string[]).includes(k)) continue;
    if (v) slim[k] = true;
  }
  if (Object.keys(slim).length === 0) {
    const next = { ...base };
    delete next.allowed_modules;
    return next;
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
