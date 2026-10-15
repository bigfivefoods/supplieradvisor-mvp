/**
 * TradeAdvisor® office paths. The signed-in dashboard uses the core sidebar.
 * The public preview keeps this in-page nav because it has no core sidebar.
 */

export function officeUsesCoreSidebar(base: string) {
  return base.startsWith('/dashboard');
}

/** Same screen, older path. Jobs board is /board and /jobs. Calendar is /calendar and /schedule. */
export function officeHrefAliases(href: string): string[] {
  if (href === '/board') return ['/jobs'];
  if (href === '/calendar') return ['/schedule'];
  return [];
}

export function officeOn(path: string, base: string, href: string) {
  return [href, ...officeHrefAliases(href)].some((item) => {
    const target = `${base}${item}` || base;
    if (item === '') return path === base || path === `${base}/`;
    return path === target || path.startsWith(`${target}/`);
  });
}
