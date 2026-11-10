import { MODULE_NAV } from '@/lib/chrome/module-nav';

/** Which module guide a screen belongs to. Home matches only /dashboard. */
export function guideIdForPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/';
  // The guide itself is not a module screen. Old /help addresses redirect here.
  if (path.startsWith('/dashboard/help') || path === '/dashboard/guide' || path.startsWith('/dashboard/guide/')) {
    return null;
  }
  let bestId: string | null = null;
  let bestLen = -1;
  for (const mod of MODULE_NAV) {
    const href = mod.href.replace(/\/$/, '') || '/';
    if (href === '/dashboard') {
      if (path === '/dashboard' && href.length > bestLen) {
        bestId = mod.id;
        bestLen = href.length;
      }
      continue;
    }
    if (path === href || path.startsWith(`${href}/`)) {
      if (href.length > bestLen) {
        bestId = mod.id;
        bestLen = href.length;
      }
    }
  }
  return bestId;
}
