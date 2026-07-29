import type { MetadataRoute } from 'next';
import { companyPublicPath } from '@/lib/seo/company-public';
import { loadAllPublicCompanyRows } from '@/lib/seo/load-public-companies';
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
    return STATIC_SEO_ROUTES.map((r) => ({
      url: `${BASE}${r.path === '/' ? '/' : r.path}`,
      lastModified: now,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    }));
  }

  return buildCompanyShard(id - 1, now);
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
