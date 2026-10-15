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

export function constructionPwaCapabilities(
  companyRole: string | null | undefined
): ConstructionCapabilities {
  return capabilitiesFor(resolveConstructionRole(companyRole));
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
