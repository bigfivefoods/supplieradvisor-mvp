import type { MetadataRoute } from 'next';

/** Literal required by Next.js segment config. Keep equal to PUBLIC_PAGE_REVALIDATE_SECONDS. */
export const revalidate = 3600;
import {
  LOCALES,
  TRANSLATED_PATHS,
  hreflangAlternates,
  isTranslatedPath,
  localizedPath,
} from '@/lib/i18n/config';
import { companyPublicPath } from '@/lib/seo/company-public';
import { loadAllPublicCompanyRows } from '@/lib/seo/load-public-companies';
import { shareCardById } from '@/lib/seo/share-cards';
import { SITE_URL, STATIC_SEO_ROUTES } from '@/lib/seo/site';

/** Prefer www canonical host for Google Search Console */
const BASE = SITE_URL;

/** Companies per sitemap shard (Google supports 50k URLs; keep shards lean). */
const COMPANIES_PER_SITEMAP = 2000;

/**
 * Sitemap index shards:
 *  0 — static marketing routes
 *  1+ — company profile pages (/c/*)
 */
export async function generateSitemaps() {
  try {
    const companies = await loadAllPublicCompanyRows();
    const companyShards = Math.max(
      1,
      Math.ceil(companies.length / COMPANIES_PER_SITEMAP)
    );
    return Array.from({ length: 1 + companyShards }, (_, id) => ({ id }));
  } catch {
    return [{ id: 0 }, { id: 1 }];
  }
}

export default async function sitemap(props: {
  id: Promise<string> | string | number;
}): Promise<MetadataRoute.Sitemap> {
  const rawId = await Promise.resolve(props.id);
  const id = typeof rawId === 'number' ? rawId : Number(rawId);
  const now = new Date();

  if (!Number.isFinite(id) || id <= 0) {
    const staticEntries = STATIC_SEO_ROUTES.map((r) =>
      withLanguageAlternates(r.path, {
        url: `${BASE}${r.path === '/' ? '/' : r.path}`,
        lastModified: now,
        changeFrequency: r.changeFrequency,
        priority: r.priority,
        ...shareImage(r.path),
      })
    );

    const localizedEntries = LOCALES.filter((locale) => locale !== 'en').flatMap((locale) =>
      TRANSLATED_PATHS.map((path) =>
        withLanguageAlternates(path, {
          url: `${BASE}${localizedPath(locale, path)}`,
          lastModified: now,
          changeFrequency: 'weekly' as const,
          priority: path === '/' ? 0.9 : 0.8,
          ...shareImage(path),
        })
      )
    );

    return [...staticEntries, ...localizedEntries];
  }

  return buildCompanyShard(id - 1, now);
}

function withLanguageAlternates(
  path: string,
  entry: MetadataRoute.Sitemap[number]
): MetadataRoute.Sitemap[number] {
  if (!isTranslatedPath(path)) return entry;
  return {
    ...entry,
    alternates: {
      languages: hreflangAlternates(path, BASE),
    },
  };
}

function shareImage(path: string): { images?: string[] } {
  const id =
    path === '/'
      ? 'home'
      : path === '/pricing'
        ? 'pricing'
        : path === '/demo'
          ? 'demo'
          : path === '/industries'
            ? 'industries'
            : path.startsWith('/industries/')
              ? path.slice('/industries/'.length)
              : '';
  const card = id ? shareCardById(id) : undefined;
  if (!card) return {};
  return { images: [`${BASE}/${card.file}`] };
}

async function buildCompanyShard(
  shardIndex: number,
  now: Date
): Promise<MetadataRoute.Sitemap> {
  try {
    const rows = await loadAllPublicCompanyRows();
    const from = shardIndex * COMPANIES_PER_SITEMAP;
    const slice = rows.slice(from, from + COMPANIES_PER_SITEMAP);

    return slice.map((p) => {
      const verified =
        String(p.verification_status || '').toLowerCase() === 'verified';
      const path = companyPublicPath({
        id: Number(p.id),
        trading_name: p.trading_name,
        legal_name: p.legal_name,
      });
      return {
        url: `${BASE}${path}`,
        lastModified: p.updated_at ? new Date(String(p.updated_at)) : now,
        changeFrequency: 'weekly' as const,
        priority: verified ? 0.9 : 0.75,
      };
    });
  } catch {
    return [];
  }
}
