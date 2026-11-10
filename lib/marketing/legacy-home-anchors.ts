import { localizedPath, type Locale } from '@/lib/i18n/config';

export const LEGACY_HOME_ANCHOR_TARGETS: Record<string, string> = {
  video: '/product',
  stack: '/product',
  systems: '/product',
  'whats-new': '/product',
  'industry-packs': '/product',
  tradeadvisor: '/product',
  'why-join': '/why-supplieradvisor',
  compare: '/why-supplieradvisor',
  proof: '/why-supplieradvisor',
  'super-cube': '/why-supplieradvisor',
  modules: '/modules',
  'modules-industry': '/modules',
  packaging: '/how-it-fits',
  trust: '/trust',
  security: '/trust',
  'member-app': '/sa-member',
  pricing: '/pricing',
  roi: '/roi',
  industries: '/industries',
  catalogues: '/catalogues',
  markets: '/',
  audiences: '/',
};

export function legacyHomeAnchorTarget(hash: string, locale: Locale): string | null {
  const key = hash.replace(/^#/, '');
  const target = LEGACY_HOME_ANCHOR_TARGETS[key];
  if (!target) return null;
  if (target === '/' || target === '/pricing') return localizedPath(locale, target);
  return target;
}
