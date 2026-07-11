import type { ProcessStep } from '@/components/relationship/RelationshipChrome';
import { BUYER_LIFECYCLE, lifecyclesFromNav } from '@/lib/chrome/module-nav';

/** Sticky process rail — critical steps only (sourced from module-nav). */
export type ModuleLifecycle = {
  id: string;
  prefixes: string[];
  title: string;
  steps: readonly ProcessStep[];
};

export const MODULE_LIFECYCLES: readonly ModuleLifecycle[] = [
  ...lifecyclesFromNav(),
  BUYER_LIFECYCLE,
];

export function lifecycleForPath(pathname: string | null | undefined): ModuleLifecycle | null {
  if (!pathname) return null;
  let best: ModuleLifecycle | null = null;
  let bestLen = -1;
  for (const life of MODULE_LIFECYCLES) {
    for (const prefix of life.prefixes) {
      if (
        (pathname === prefix || pathname.startsWith(prefix + '/')) &&
        prefix.length > bestLen
      ) {
        best = life;
        bestLen = prefix.length;
      }
    }
  }
  return best;
}

export function isStepActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  if (pathname === href) return true;
  const parts = href.split('/').filter(Boolean);
  // Hub roots under /dashboard or /sales — exact only
  if (
    (parts.length === 2 && parts[0] === 'dashboard') ||
    (parts.length === 1 && parts[0] === 'sales') ||
    (parts.length === 0 && href === '/sales')
  ) {
    return pathname === href || pathname === href + '/';
  }
  return pathname.startsWith(href + '/');
}
