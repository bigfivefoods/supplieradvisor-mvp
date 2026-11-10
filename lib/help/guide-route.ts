/**
 * How-to guides live at /dashboard/guide.
 * /dashboard/help redirects here and keeps the module, query, and anchor.
 */
import { GUIDE_SECTIONS, getGuideSection, type GuideSection } from '@/lib/guide/curriculum';
import { getModuleGuide } from '@/lib/help/module-guides';
import type { ModuleGuide } from '@/lib/help/types';

export const HOW_TO_GUIDE_NAME = 'How-to guide';

/**
 * Curriculum slugs whose module id is different.
 * Both addresses open the same how-to.
 */
export const GUIDE_SLUG_ALIASES: Record<string, string> = {
  company: 'my-business',
  make: 'manufacturing',
  ship: 'distribution',
  finance: 'accounting',
  impact: 'sustainability',
  insights: 'intelligence',
  sales: 'sales-portal',
};

const MODULE_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(GUIDE_SLUG_ALIASES).map(([slug, id]) => [id, slug])
);

export function moduleGuidePath(moduleId: string): string {
  return `/dashboard/guide/${moduleId}`;
}

/** Sidebar row for a module that has a how-to. Null when it does not. */
export type HowToStep = {
  name: typeof HOW_TO_GUIDE_NAME;
  href: string;
  desc: string;
  exact: true;
  rail: false;
  howTo: true;
};

export function howToStep(moduleId: string): HowToStep | null {
  if (!getModuleGuide(moduleId)) return null;
  return {
    name: HOW_TO_GUIDE_NAME,
    href: moduleGuidePath(moduleId),
    desc: 'How this module works',
    exact: true,
    rail: false,
    howTo: true,
  };
}

/** First item in a module's expandable nav group. Process-rail steps stay after it. */
export function withHowToFirst<T extends { name: string; href: string }>(
  moduleId: string,
  steps: readonly T[]
): Array<HowToStep | T> {
  const item = howToStep(moduleId);
  if (!item) return [...steps];
  const rest = steps.filter((step) => !(step.name === item.name && step.href === item.href));
  return [item, ...rest];
}

/**
 * Map an old help URL onto the guide, including ?query and #anchor.
 * The browser keeps the anchor on an HTTP redirect; this helper is the same rule for tests.
 */
export function helpToGuideLocation(url: string): string | null {
  const hashAt = url.indexOf('#');
  const hash = hashAt >= 0 ? url.slice(hashAt) : '';
  const beforeHash = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const queryAt = beforeHash.indexOf('?');
  const query = queryAt >= 0 ? beforeHash.slice(queryAt) : '';
  const path = (queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash).replace(/\/$/, '') || '/';
  if (path === '/dashboard/help') return `/dashboard/guide${query}${hash}`;
  const match = path.match(/^\/dashboard\/help\/([^/]+)$/);
  if (!match) return null;
  return `/dashboard/guide/${match[1]}${query}${hash}`;
}

export type ResolvedGuide = {
  guide: ModuleGuide | null;
  section: GuideSection | null;
};

/** Handbook chapter folded under a module how-to. Alias slugs win over a shared module id. */
export function handbookSectionForModule(moduleId: string): GuideSection | null {
  const alias = MODULE_TO_SLUG[moduleId];
  if (alias) return getGuideSection(alias) ?? null;
  const same = getGuideSection(moduleId);
  if (same && (!same.moduleId || same.moduleId === moduleId)) return same;
  return GUIDE_SECTIONS.find((section) => section.slug === moduleId && section.moduleId === moduleId) ?? null;
}

/** Module how-to, handbook chapter, or both. Null when the slug is neither. */
export function resolveGuideRoute(slug: string): ResolvedGuide | null {
  const direct = getModuleGuide(slug);
  const aliased = GUIDE_SLUG_ALIASES[slug];
  const guide = direct ?? (aliased ? getModuleGuide(aliased) : null);
  const section = getGuideSection(slug) ?? (guide ? handbookSectionForModule(guide.id) : null);
  if (!guide && !section) return null;
  return { guide: guide ?? null, section: section ?? null };
}
