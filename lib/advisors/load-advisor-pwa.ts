/**
 * Server load of a company-branded member PWA.
 */
import type { Metadata, Viewport } from 'next';
import { isAdvisorModuleKey, loadAdvisorModuleStore } from '@/lib/business/company-data';
import { resolveAdvisorCompanyId } from '@/lib/business/advisor-store-resolve';
import {
  ADVISOR_PWA_INDEX_KEYS,
  ADVISOR_PWA_PORTAL_INDEX_KEYS,
  advisorPwaIconPath,
  advisorPwaManifestPath,
  buildAdvisorPwaBrand,
  isAdvisorPwaModule,
  settingsFromAdvisorMeta,
  type AdvisorPwaBrand,
} from '@/lib/advisors/member-pwa';

async function brandFromCompany(
  moduleRaw: Parameters<typeof buildAdvisorPwaBrand>[0]['module'],
  companyId: number,
  publicTokenFallback: string
): Promise<AdvisorPwaBrand | null> {
  const loaded = await loadAdvisorModuleStore(companyId, moduleRaw, (meta) =>
    settingsFromAdvisorMeta(moduleRaw, meta)
  );
  const settings = loaded.store || {};
  const storedToken = String(settings.public_token || '').trim();
  const publicToken = storedToken || publicTokenFallback;
  if (!publicToken) return null;
  return buildAdvisorPwaBrand({
    module: moduleRaw,
    publicToken,
    companyId,
    settings,
  });
}

export async function loadAdvisorPwaBrand(
  moduleRaw: string,
  tokenRaw: string
): Promise<AdvisorPwaBrand | null> {
  if (!isAdvisorPwaModule(moduleRaw) || !isAdvisorModuleKey(moduleRaw)) return null;
  const token = String(tokenRaw || '').trim();
  if (token.length < 8) return null;
  const companyId = await resolveAdvisorCompanyId({
    token,
    moduleKey: moduleRaw,
    indexKeys: ADVISOR_PWA_INDEX_KEYS[moduleRaw],
  });
  if (!companyId) return null;
  const brand = await brandFromCompany(moduleRaw, companyId, token);
  if (!brand) return null;
  if (brand.publicToken && brand.publicToken !== token) return null;
  return brand;
}

/** Member / patient portal token → same company brand as the public PWA. */
export async function loadAdvisorPwaBrandFromPortalToken(
  moduleRaw: string,
  tokenRaw: string
): Promise<AdvisorPwaBrand | null> {
  if (!isAdvisorPwaModule(moduleRaw) || !isAdvisorModuleKey(moduleRaw)) return null;
  const token = String(tokenRaw || '').trim();
  if (token.length < 8) return null;
  let parseCompanyId: ((t: string) => number | null) | undefined;
  if (moduleRaw === 'fitgraph') {
    const fit = await import('@/lib/fitness/fitgraph');
    parseCompanyId = fit.parseCompanyIdFromToken;
  }
  const companyId = await resolveAdvisorCompanyId({
    token,
    moduleKey: moduleRaw,
    indexKeys: ADVISOR_PWA_PORTAL_INDEX_KEYS[moduleRaw],
    parseCompanyId,
  });
  if (!companyId) return null;
  return brandFromCompany(moduleRaw, companyId, '');
}

export function advisorPwaPageMetadata(brand: AdvisorPwaBrand | null): Metadata {
  if (!brand) {
    return { title: 'Member app', robots: 'noindex' };
  }
  const appleIcon = advisorPwaIconPath(brand.module, brand.publicToken, 180);
  const appIcon = advisorPwaIconPath(brand.module, brand.publicToken, 192);
  return {
    title: brand.brandName,
    description: brand.description,
    applicationName: brand.shortName,
    robots: 'noindex',
    appleWebApp: {
      capable: true,
      title: brand.shortName,
      statusBarStyle: 'black-translucent',
      startupImage: [appleIcon],
    },
    icons: {
      apple: [{ url: appleIcon, sizes: '180x180', type: 'image/png' }],
      icon: [{ url: appIcon, sizes: '192x192', type: 'image/png' }],
    },
    manifest: advisorPwaManifestPath(brand.module, brand.publicToken),
    other: {
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-title': brand.shortName,
    },
  };
}

export function advisorPwaPageViewport(brand: AdvisorPwaBrand | null): Viewport {
  return {
    themeColor: brand?.themeColor || '#0c4a6e',
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
  };
}
