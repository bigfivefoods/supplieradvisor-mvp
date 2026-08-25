/**
 * Server load of a company-branded member PWA.
 * Reads only module settings (not the gym/clinic blob) and memoises per request.
 */
import { cache } from 'react';
import type { Metadata, Viewport } from 'next';
import { unstable_cache } from 'next/cache';
import { isAdvisorModuleKey } from '@/lib/business/company-data';
import { resolveAdvisorCompanyId } from '@/lib/business/advisor-store-resolve';
import { pickCompanyLogoUrl } from '@/lib/business/company-logo';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { ttlDel, ttlGet, ttlSet } from '@/lib/system/memory-ttl';
import { SITE_URL } from '@/lib/seo/site';
import {
  ADVISOR_PWA_INDEX_KEYS,
  ADVISOR_PWA_PORTAL_INDEX_KEYS,
  advisorPwaBrandStamp,
  advisorPwaIconPath,
  advisorPwaManifestPath,
  advisorPwaOgPath,
  advisorPwaSplashPath,
  buildAdvisorPwaBrand,
  isAdvisorPwaModule,
  type AdvisorPwaBrand,
  type AdvisorPwaModule,
} from '@/lib/advisors/member-pwa';

const BRAND_TTL_MS = 90_000;
const MISS_TTL_MS = 15_000;

function asObj(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function settingsFromStoreData(data: unknown): Record<string, unknown> {
  const store = asObj(data);
  const nested = store.settings;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return store;
}

function settingsFromRow(row: Record<string, unknown>): Record<string, unknown> {
  if (row.settings != null) return settingsFromStoreData(row.settings);
  if (row.data != null) return settingsFromStoreData(row.data);
  const rest = { ...row };
  delete rest.company_id;
  delete rest.public_token;
  return settingsFromStoreData(rest);
}

type SlimPwaRow = {
  companyId: number;
  publicToken: string;
  settings: Record<string, unknown>;
};

async function loadSlimPwaSettings(opts: {
  moduleKey: AdvisorPwaModule;
  publicToken?: string;
  companyId?: number;
}): Promise<SlimPwaRow | null> {
  if (!opts.publicToken && !(opts.companyId && opts.companyId > 0)) return null;
  const supabase = getSupabaseServer();
  let slim = supabase
    .from('company_module_stores')
    .select('company_id, public_token, settings:data->settings')
    .eq('module', opts.moduleKey);
  if (opts.publicToken) slim = slim.eq('public_token', opts.publicToken);
  else slim = slim.eq('company_id', opts.companyId as number);
  const first = await slim.maybeSingle();
  let row: Record<string, unknown> | null =
    !first.error && first.data ? asObj(first.data as object) : null;
  if (!row) {
    let fallback = supabase
      .from('company_module_stores')
      .select('company_id, public_token, data->settings')
      .eq('module', opts.moduleKey);
    if (opts.publicToken) fallback = fallback.eq('public_token', opts.publicToken);
    else fallback = fallback.eq('company_id', opts.companyId as number);
    const second = await fallback.maybeSingle();
    if (!second.error && second.data) row = asObj(second.data as object);
  }
  if (!row) return null;
  const companyId = Number(row.company_id);
  if (!Number.isFinite(companyId) || companyId <= 0) return null;
  const publicToken = String(row.public_token || opts.publicToken || '').trim();
  return {
    companyId,
    publicToken,
    settings: settingsFromRow(row),
  };
}

async function loadProfileLogoUrl(companyId: number): Promise<string | null> {
  const key = `pwa-profile-logo:${companyId}`;
  const hit = ttlGet<string | false>(key);
  if (hit === false) return null;
  if (hit) return hit;
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('profiles')
    .select('logo_url')
    .eq('id', companyId)
    .maybeSingle();
  const url = pickCompanyLogoUrl(data);
  ttlSet(key, url || false, url ? BRAND_TTL_MS : MISS_TTL_MS);
  return url;
}

async function brandFromSlim(
  moduleRaw: AdvisorPwaModule,
  slim: SlimPwaRow,
  publicTokenFallback: string
): Promise<AdvisorPwaBrand | null> {
  const publicToken = slim.publicToken || publicTokenFallback;
  if (!publicToken) return null;
  const identityLogo = await loadProfileLogoUrl(slim.companyId);
  const settings = identityLogo
    ? { ...slim.settings, company_logo_url: identityLogo }
    : slim.settings;
  return buildAdvisorPwaBrand({
    module: moduleRaw,
    publicToken,
    companyId: slim.companyId,
    settings,
  });
}

async function loadAdvisorPwaBrandUncached(
  moduleRaw: string,
  tokenRaw: string
): Promise<AdvisorPwaBrand | null> {
  if (!isAdvisorPwaModule(moduleRaw) || !isAdvisorModuleKey(moduleRaw)) return null;
  const token = String(tokenRaw || '').trim();
  if (token.length < 8) return null;

  const byToken = await loadSlimPwaSettings({
    moduleKey: moduleRaw,
    publicToken: token,
  });
  if (byToken?.publicToken === token) {
    return await brandFromSlim(moduleRaw, byToken, token);
  }

  const companyId = await resolveAdvisorCompanyId({
    token,
    moduleKey: moduleRaw,
    indexKeys: ADVISOR_PWA_INDEX_KEYS[moduleRaw],
  });
  if (!companyId) return null;
  const slim = await loadSlimPwaSettings({
    moduleKey: moduleRaw,
    companyId,
  });
  if (!slim) return null;
  const brand = await brandFromSlim(moduleRaw, slim, token);
  if (!brand) return null;
  if (brand.publicToken && brand.publicToken !== token) return null;
  return brand;
}

async function loadAdvisorPwaBrandFromPortalTokenUncached(
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
  } else if (moduleRaw === 'hiregraph') {
    const hire = await import('@/lib/hire/hiregraph');
    parseCompanyId = (t) =>
      hire.parseCompanyIdFromHireCustomerToken(t) ||
      hire.parseCompanyIdFromHirePublicToken(t);
  } else if (moduleRaw === 'retailgraph') {
    const retail = await import('@/lib/retail/retailgraph');
    parseCompanyId = (t) =>
      retail.parseCompanyIdFromRetailCustomerToken(t) ||
      retail.parseCompanyIdFromRetailPublicToken(t);
  } else if (moduleRaw === 'physiograph') {
    parseCompanyId = (await import('@/lib/clinic/physiograph'))
      .parsePhysioCompanyIdFromToken;
  } else if (moduleRaw === 'dentalgraph') {
    parseCompanyId = (await import('@/lib/dental/dentalgraph'))
      .parseDentalCompanyIdFromToken;
  } else if (moduleRaw === 'medicalgraph') {
    parseCompanyId = (await import('@/lib/clinic/medicalgraph'))
      .parseMedicalCompanyIdFromToken;
  } else if (moduleRaw === 'psychiatrygraph') {
    parseCompanyId = (await import('@/lib/clinic/psychiatrygraph'))
      .parsePsychiatryCompanyIdFromToken;
  }
  const companyId = await resolveAdvisorCompanyId({
    token,
    moduleKey: moduleRaw,
    indexKeys: ADVISOR_PWA_PORTAL_INDEX_KEYS[moduleRaw],
    parseCompanyId,
  });
  if (!companyId) return null;
  const slim = await loadSlimPwaSettings({
    moduleKey: moduleRaw,
    companyId,
  });
  if (!slim) return null;
  return brandFromSlim(moduleRaw, slim, slim.publicToken);
}

function ttlBrand(
  key: string,
  load: () => Promise<AdvisorPwaBrand | null>
): Promise<AdvisorPwaBrand | null> {
  const hit = ttlGet<AdvisorPwaBrand | false>(key);
  if (hit === false) return Promise.resolve(null);
  if (hit) return Promise.resolve(hit);
  return load().then((brand) => {
    ttlSet(key, brand || false, brand ? BRAND_TTL_MS : MISS_TTL_MS);
    return brand;
  });
}

const loadAdvisorPwaBrandData = unstable_cache(
  async (moduleKey: string, token: string) =>
    loadAdvisorPwaBrandUncached(moduleKey, token),
  ['advisor-pwa-brand-v3'],
  { revalidate: 15, tags: ['advisor-pwa-brand'] }
);

const loadAdvisorPwaBrandFromPortalData = unstable_cache(
  async (moduleKey: string, token: string) =>
    loadAdvisorPwaBrandFromPortalTokenUncached(moduleKey, token),
  ['advisor-pwa-brand-portal-v3'],
  { revalidate: 15, tags: ['advisor-pwa-brand'] }
);

export function invalidateAdvisorPwaBrandCache(): void {
  ttlDel('pwa-brand');
  ttlDel('pwa-icon');
  ttlDel('pwa-splash');
  ttlDel('pwa-og');
  ttlDel('pwa-og-mark');
  ttlDel('pwa-logo-v2');
  void import('next/cache')
    .then((n) => {
      const tag = n.revalidateTag as
        | ((t: string, p?: string) => void)
        | undefined;
      tag?.('advisor-pwa-brand', 'max');
    })
    .catch(() => {
      /* tests / non-next */
    });
}

export const loadAdvisorPwaBrand = cache(
  async (moduleRaw: string, tokenRaw: string): Promise<AdvisorPwaBrand | null> => {
    const moduleKey = String(moduleRaw || '').trim();
    const token = String(tokenRaw || '').trim();
    return ttlBrand(`pwa-brand:${moduleKey}:${token}`, () =>
      loadAdvisorPwaBrandData(moduleKey, token)
    );
  }
);

/** Member / patient portal token → same company brand as the public PWA. */
export const loadAdvisorPwaBrandFromPortalToken = cache(
  async (moduleRaw: string, tokenRaw: string): Promise<AdvisorPwaBrand | null> => {
    const moduleKey = String(moduleRaw || '').trim();
    const token = String(tokenRaw || '').trim();
    return ttlBrand(`pwa-brand-portal:${moduleKey}:${token}`, () =>
      loadAdvisorPwaBrandFromPortalData(moduleKey, token)
    );
  }
);

export function advisorPwaPageMetadata(brand: AdvisorPwaBrand | null): Metadata {
  if (!brand) {
    return { title: 'Member app', robots: 'noindex' };
  }
  const stamp = advisorPwaBrandStamp(brand);
  const appleIcon = advisorPwaIconPath(brand.module, brand.publicToken, 180, stamp);
  const appIcon = advisorPwaIconPath(brand.module, brand.publicToken, 192, stamp);
  const splash = advisorPwaSplashPath(brand.module, brand.publicToken, stamp);
  const ogPath = advisorPwaOgPath(brand.module, brand.publicToken, stamp);
  const og = `${SITE_URL}${ogPath}`;
  const shareTitle = brand.brandName;
  return {
    title: { absolute: shareTitle },
    description: brand.brandName,
    applicationName: brand.shortName,
    robots: 'noindex',
    appleWebApp: {
      capable: true,
      title: brand.shortName,
      statusBarStyle: 'black-translucent',
      startupImage: [splash],
    },
    icons: {
      apple: [{ url: appleIcon, sizes: '180x180', type: 'image/png' }],
      icon: [{ url: appIcon, sizes: '192x192', type: 'image/png' }],
    },
    manifest: advisorPwaManifestPath(brand.module, brand.publicToken, stamp),
    openGraph: {
      type: 'website',
      title: brand.brandName,
      description: brand.brandName,
      siteName: brand.brandName,
      url: brand.startPath,
      images: [
        {
          url: og,
          width: 1200,
          height: 630,
          alt: brand.brandName,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: brand.brandName,
      description: brand.brandName,
      images: [og],
    },
    other: {
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-title': brand.shortName,
    },
  };
}

export function advisorPwaPageViewport(brand: AdvisorPwaBrand | null): Viewport {
  return {
    themeColor: brand?.themeColor || brand?.backgroundColor || '#0c4a6e',
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
  };
}

async function readTokenParam(
  params: { token: string } | Promise<{ token: string }>
): Promise<string> {
  const { token } = await params;
  return String(token || '').trim();
}

/** Branded PWA chrome for /member, /hire, and retail embed token routes. */
export async function generateAdvisorPortalTokenMetadata(
  module: AdvisorPwaModule,
  params: { token: string } | Promise<{ token: string }>
): Promise<Metadata> {
  const token = await readTokenParam(params);
  const brand = await loadAdvisorPwaBrandFromPortalToken(module, token);
  return advisorPwaPageMetadata(brand);
}

export async function generateAdvisorPortalTokenViewport(
  module: AdvisorPwaModule,
  params: { token: string } | Promise<{ token: string }>
): Promise<Viewport> {
  const token = await readTokenParam(params);
  const brand = await loadAdvisorPwaBrandFromPortalToken(module, token);
  return advisorPwaPageViewport(brand);
}
