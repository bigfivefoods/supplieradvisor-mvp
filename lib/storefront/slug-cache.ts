import type { StoreCompany } from './types';

const HIT_MS = 60_000;
const MISS_MS = 10_000;
const CAP = 2_000;

type Entry = {
  exp: number;
  company: StoreCompany | null;
  companyId: number | null;
};

const bySlug = new Map<string, Entry>();
let clock: () => number = () => Date.now();

export function setStoreSlugCacheClockForTests(now: (() => number) | null): void {
  clock = now || (() => Date.now());
}

export function clearStoreSlugCacheForTests(): void {
  bySlug.clear();
}

export function readStoreSlugCache(
  slug: string
): { hit: true; company: StoreCompany | null } | { hit: false } {
  const row = bySlug.get(slug);
  if (!row) return { hit: false };
  if (row.exp <= clock()) {
    bySlug.delete(slug);
    return { hit: false };
  }
  return { hit: true, company: row.company };
}

export function writeStoreSlugCache(slug: string, company: StoreCompany | null): void {
  if (!slug) return;
  const now = clock();
  if (bySlug.size >= CAP && !bySlug.has(slug)) {
    const oldest = bySlug.keys().next().value;
    if (oldest) bySlug.delete(oldest);
  }
  bySlug.delete(slug);
  bySlug.set(slug, {
    exp: now + (company ? HIT_MS : MISS_MS),
    company,
    companyId: company && company.id > 0 ? company.id : null,
  });
}

/** Profile metadata keys whose change makes a cached store company stale. */
export function storefrontMetaTouchesSlugCache(
  patch: Record<string, unknown> | null | undefined
): boolean {
  if (!patch) return false;
  return (
    'store_slug' in patch ||
    'storefront_catalog' in patch ||
    'store_tagline' in patch
  );
}

export function invalidateStoreSlugCache(opts?: {
  slug?: string | null;
  companyId?: number | null;
}): void {
  if (!opts || (opts.slug == null && opts.companyId == null)) {
    bySlug.clear();
    return;
  }
  if (opts.slug) bySlug.delete(opts.slug);
  if (opts.companyId != null && Number.isFinite(opts.companyId)) {
    for (const [key, row] of bySlug) {
      if (row.companyId === opts.companyId) bySlug.delete(key);
    }
  }
}
