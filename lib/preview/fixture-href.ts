/**
 * Keeps the sample walkthrough on /preview/* so a click never leaves
 * the fixture for a signed-in route.
 */

const STAY = '__stay__';

export function isFixturePath(prefix = '/preview'): boolean {
  return typeof window !== 'undefined' && window.location.pathname.startsWith(prefix);
}

export function mapFixtureHref(href: string): string | null {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(href, 'http://preview.local');
  } catch {
    return null;
  }
  if (url.origin !== 'http://preview.local') return null;
  const path = url.pathname.replace(/\/$/, '') || '/';
  if (path.startsWith('/preview')) return null;
  const q = url.searchParams;
  const id = q.get('id');
  const withId = (base: string) =>
    id ? `${base}${base.includes('?') ? '&' : '?'}id=${encodeURIComponent(id)}` : base;

  if (path === '/dashboard') return '/preview/dashboard';
  if (path.startsWith('/dashboard/customers/profiles')) return withId('/preview/crm?screen=profiles');
  if (path.startsWith('/dashboard/customers/onboard')) return '/preview/crm';
  if (path.startsWith('/dashboard/customers/leads')) {
    return q.get('tab') === 'pipeline' ? '/preview/crm?screen=pipeline' : '/preview/crm?screen=leads';
  }
  if (path.startsWith('/dashboard/customers/360')) return withId('/preview/crm?screen=360');
  if (
    path.startsWith('/dashboard/customers/ratings') ||
    path.startsWith('/dashboard/suppliers/ratings')
  ) {
    return '/preview/ratings';
  }
  if (path === '/dashboard/customers') return '/preview/crm';
  if (path.startsWith('/dashboard/my-business/profile')) return '/preview/onboarding';
  if (path.startsWith('/dashboard/my-business/team')) return '/preview/onboarding';
  if (path.startsWith('/dashboard/my-business/verifications')) return '/preview/onboarding';
  if (path.startsWith('/dashboard/suppliers/po')) {
    const po = q.get('po');
    return po ? `/preview/po?po=${encodeURIComponent(po)}` : '/preview/po';
  }
  if (path.startsWith('/dashboard/suppliers')) {
    return id ? `/preview/srm?id=${encodeURIComponent(id)}` : '/preview/srm';
  }
  if (path.startsWith('/dashboard/inventory/stock')) {
    return q.get('low') === '1' ? '/preview/inventory?screen=stock&low=1' : '/preview/inventory?screen=stock';
  }
  if (path.startsWith('/dashboard/inventory')) return '/preview/inventory';
  if (path.startsWith('/dashboard/sheq/incidents')) return '/preview/sheq?screen=incidents';
  if (path.startsWith('/dashboard/sheq/ncrs')) return '/preview/sheq?screen=ncrs';
  if (path.startsWith('/dashboard/sheq/capas')) return '/preview/sheq?screen=capas';
  if (path.startsWith('/dashboard/sheq/hazards')) return '/preview/sheq?screen=hazards';
  if (path.startsWith('/dashboard/sheq') || path.startsWith('/dashboard/quality')) return '/preview/sheq';
  if (path.startsWith('/sales/tasks')) return '/preview/crm?screen=tasks';
  if (path.startsWith('/sales/pipeline')) return '/preview/crm?screen=pipeline';
  if (path.startsWith('/dashboard') || path.startsWith('/sales') || path.startsWith('/login')) {
    return STAY;
  }
  return null;
}

/** True when a fixture click would leave this page for another preview screen. */
export function isFixtureReachable(href: string): boolean {
  const next = mapFixtureHref(href);
  return typeof next === 'string' && next.length > 0 && next !== STAY;
}

/** Preview address for a flow link, or null when the fixture stays on this page. */
export function fixtureFlowHref(href: string): string | null {
  const next = mapFixtureHref(href);
  if (typeof next !== 'string' || next.length === 0 || next === STAY) return null;
  return next;
}

/** Rewrite in-app links while a fixture route is open. Other pages are unchanged. */
export function fixtureHref(href: string): string {
  if (!isFixturePath()) return href;
  const next = mapFixtureHref(href);
  if (!next || next === STAY) return href;
  return next;
}

export function bindFixtureNavigation(): () => void {
  if (typeof document === 'undefined') return () => {};
  const onClick = (event: MouseEvent) => {
    if (!isFixturePath()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest('a');
    if (!anchor) return;
    const raw = anchor.getAttribute('href') || '';
    const next = mapFixtureHref(raw);
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    if (next === STAY) return;
    const here = `${window.location.pathname}${window.location.search}`;
    if (next !== here) window.location.assign(next);
  };
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}
