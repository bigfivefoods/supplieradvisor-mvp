/**
 * Cached public store catalogue. Query-string filters stay on the client so
 * the HTML document can be edge-cached.
 *
 * Every catalogue entry is tagged `public-stores`, so a product save or a
 * profile edit can drop them without knowing the slug in advance.
 */
import { unstable_cache } from 'next/cache';
import { listStoreProducts, resolveStoreCompany } from '@/lib/storefront/catalog';
import type { StoreCompany, StoreProduct } from '@/lib/storefront/types';
import {
  PUBLIC_PAGE_REVALIDATE_SECONDS,
  PUBLIC_STORES_TAG,
  publicStoreTag,
} from '@/lib/seo/public-page-cache';

export type PublicStoreCatalog = {
  company: StoreCompany;
  products: StoreProduct[];
};

export function loadCachedStoreCatalog(slug: string): Promise<PublicStoreCatalog | null> {
  const key = String(slug || '').trim().toLowerCase();
  return unstable_cache(
    async () => {
      const company = await resolveStoreCompany(key);
      if (!company) return null;
      const products = await listStoreProducts(company);
      return { company, products };
    },
    ['public-store-catalog-v1', key],
    {
      revalidate: PUBLIC_PAGE_REVALIDATE_SECONDS,
      tags: [publicStoreTag(key), PUBLIC_STORES_TAG],
    }
  )();
}
