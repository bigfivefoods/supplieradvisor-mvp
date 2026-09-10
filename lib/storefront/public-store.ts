import { slugifyCompanyName } from '@/lib/seo/company-public';

/** Public catalogue path for a company profile (Big Five Foods → /store/big-five-foods). */
export function publicStoreSlug(opts: {
  tradingName?: string | null;
  legalName?: string | null;
  metadata?: unknown;
}): string | null {
  const meta =
    opts.metadata && typeof opts.metadata === 'object' && !Array.isArray(opts.metadata)
      ? (opts.metadata as Record<string, unknown>)
      : {};
  const fromMeta = String(meta.store_slug || '').trim().toLowerCase();
  if (fromMeta) return fromMeta.replace(/^\/+|\/+$/g, '');
  const name = String(opts.tradingName || opts.legalName || '').trim();
  if (!name) return null;
  return slugifyCompanyName(name);
}

export function publicStorePath(opts: {
  tradingName?: string | null;
  legalName?: string | null;
  metadata?: unknown;
}): string | null {
  const slug = publicStoreSlug(opts);
  return slug ? `/store/${encodeURIComponent(slug)}` : null;
}

export function storeEmbedPath(slug: string): string {
  return `/embed/store/${encodeURIComponent(String(slug || '').trim())}`;
}
