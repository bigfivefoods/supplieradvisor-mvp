/**
 * ConstructionAdvisor® PWA roles. Mirrors the desk matrix in roles.ts
 * so the site app and the staff API cannot drift.
 */
import {
  capabilitiesFor,
  resolveConstructionRole,
  type ConstructionCapabilities,
  type ConstructionRole,
} from './roles';

export type ConstructionPwaRole = ConstructionRole;
export type ConstructionAppRole = 'owner' | 'workers' | 'none';

export function constructionPwaCapabilities(
  companyRole: string | null | undefined
): ConstructionCapabilities {
  return capabilitiesFor(resolveConstructionRole(companyRole));
}

/** Owner and office open the business app. Site workers open the workers app. */
export function constructionAppRole(
  companyRole: string | null | undefined
): ConstructionAppRole {
  if (companyRole === 'owner' || companyRole === 'office' || companyRole === 'admin' || companyRole === 'finance') {
    return 'owner';
  }
  if (
    companyRole === 'site_manager' ||
    companyRole === 'viewer' ||
    companyRole === 'member' ||
    companyRole === 'operations' ||
    companyRole === 'sales'
  ) {
    return 'workers';
  }
  const role = resolveConstructionRole(companyRole);
  if (role === 'none') return 'none';
  if (role === 'owner' || role === 'office') return 'owner';
  return 'workers';
}

export function constructionCrewPath(token: string): string {
  return `/crew/constructiongraph/${encodeURIComponent(token)}`;
}

export function constructionCustomerPath(token: string): string {
  return `/customer/constructiongraph/${encodeURIComponent(token)}`;
}

export function constructionWorkPath(): string {
  return '/work/constructiongraph';
}

export function constructionPortalPath(token: string): string {
  return `/construction/${encodeURIComponent(token)}`;
}

export function constructionPreviewPath(): string {
  return '/preview/constructiongraph';
}
