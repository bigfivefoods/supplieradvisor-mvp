import { slugifyCompanyName } from '@/lib/seo/company-public';

/** Case, trailing slash, and unicode-normalised store slug. */
export function normaliseStoreSlug(raw: string | null | undefined): string {
  return String(raw || '')
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '');
}

/**
 * Equality values for metadata.store_slug.
 * The lower-case form, plus the original casing when the caller did not already lower it.
 */
export function storeSlugLookupValues(raw: string | null | undefined): string[] {
  const trimmed = String(raw || '')
    .normalize('NFC')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  const normalised = trimmed.toLowerCase();
  if (!normalised) return [];
  if (trimmed === normalised) return [normalised];
  return [normalised, trimmed];
}

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
  const fromMeta = normaliseStoreSlug(String(meta.store_slug || ''));
  if (fromMeta) return fromMeta;
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
