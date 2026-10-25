/**
 * Cache tags and paths for public company, store, and sitemap pages.
 * Pure — safe to import from tests. Does not talk to Supabase.
 */
import { companyPublicPath } from '@/lib/seo/company-public';
import { publicStoreSlug } from '@/lib/storefront/public-store';

/** Full-route and data cache lifetime for public SEO pages. */
export const PUBLIC_PAGE_REVALIDATE_SECONDS = 3600;

export const PUBLIC_SITEMAP_TAG = 'public-sitemap';
export const PUBLIC_STORES_TAG = 'public-stores';

export function publicCompanyTag(companyId: number): string {
  return `public-company-${companyId}`;
}

export function publicStoreTag(slug: string): string {
  return `public-store-${String(slug || '').trim().toLowerCase()}`;
}

export function publicStoreCompanyTag(companyId: number): string {
  return `public-store-company-${companyId}`;
}

export type PublicSurfaceInput = {
  companyId: number;
  tradingName?: string | null;
  legalName?: string | null;
  metadata?: unknown;
  previousTradingName?: string | null;
  previousLegalName?: string | null;
  previousMetadata?: unknown;
};

export function publicInvalidationTags(input: PublicSurfaceInput): string[] {
  const id = Number(input.companyId);
  const tags = new Set<string>([PUBLIC_SITEMAP_TAG, PUBLIC_STORES_TAG]);
  if (Number.isFinite(id) && id > 0) {
    tags.add(publicCompanyTag(id));
    tags.add(publicStoreCompanyTag(id));
  }
  const slugs = [
    publicStoreSlug({
      tradingName: input.tradingName,
      legalName: input.legalName,
      metadata: input.metadata,
    }),
    publicStoreSlug({
      tradingName: input.previousTradingName,
      legalName: input.previousLegalName,
      metadata: input.previousMetadata,
    }),
  ];
  for (const slug of slugs) {
    if (slug) tags.add(publicStoreTag(slug));
  }
  return [...tags];
}

export function publicInvalidationPaths(input: PublicSurfaceInput): string[] {
  const id = Number(input.companyId);
  const paths = new Set<string>([
    '/sitemap.xml',
    '/sitemap-index.xml',
    '/sitemap/0.xml',
    '/sitemap/1.xml',
  ]);
  if (!Number.isFinite(id) || id <= 0) return [...paths];

  const current = companyPublicPath({
    id,
    trading_name: input.tradingName,
    legal_name: input.legalName,
  });
  const previous = companyPublicPath({
    id,
    trading_name: input.previousTradingName ?? input.tradingName,
    legal_name: input.previousLegalName ?? input.legalName,
  });
  paths.add(current);
  paths.add(previous);
  paths.add(`/c/${id}`);
  paths.add(`${current}/open`);

  const slugs = [
    publicStoreSlug({
      tradingName: input.tradingName,
      legalName: input.legalName,
      metadata: input.metadata,
    }),
    publicStoreSlug({
      tradingName: input.previousTradingName,
      legalName: input.previousLegalName,
      metadata: input.previousMetadata,
    }),
  ];
  for (const slug of slugs) {
    if (!slug) continue;
    paths.add(`/store/${slug}`);
    paths.add(`/embed/store/${slug}`);
  }
  return [...paths];
}
