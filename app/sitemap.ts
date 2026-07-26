import type { MetadataRoute } from 'next';
import { companyPublicPath } from '@/lib/seo/company-public';
import { facetSlug, industryCityPairs, type DirCompany } from '@/lib/seo/directory-data';
import { loadAllPublicCompanyRows } from '@/lib/seo/load-public-companies';
import { SITE_URL, STATIC_SEO_ROUTES } from '@/lib/seo/site';

/** Prefer www canonical host for Google Search Console */
const BASE = SITE_URL;

/** Companies per sitemap shard (Google supports 50k URLs; keep shards lean). */
const COMPANIES_PER_SITEMAP = 2000;

/**
 * Sitemap index shards:
 *  0 — static marketing + directory facet hubs + industry×city long-tail
 *  1+ — company profile pages (every discoverable business)
 */
export async function generateSitemaps() {
  try {
    const companies = await loadAllPublicCompanyRows();
    const companyShards = Math.max(
      1,
      Math.ceil(companies.length / COMPANIES_PER_SITEMAP)
    );
    // id 0 = static + hubs; ids 1..N = company shards
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
    return buildStaticAndHubs(now);
  }

  return buildCompanyShard(id - 1, now);
}

async function buildStaticAndHubs(now: Date): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = STATIC_SEO_ROUTES.map((r) => ({
    url: `${BASE}${r.path === '/' ? '/' : r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  try {
    const rows = await loadAllPublicCompanyRows();
    const asDir: DirCompany[] = rows.map((r) => ({
      id: r.id,
      trading_name: r.trading_name,
      legal_name: r.legal_name,
      industry: r.industry,
      city: r.city,
      country: r.country,
      logo_url: r.logo_url,
      short_description: r.short_description,
      verification_status: r.verification_status,
      trust_score: r.trust_score,
    }));

    const industries = [
      ...new Set(
        asDir
          .map((p) => (p.industry != null ? String(p.industry).trim() : ''))
          .filter(Boolean)
      ),
    ];
    const cities = [
      ...new Set(
        asDir
          .map((p) => (p.city != null ? String(p.city).trim() : ''))
          .filter(Boolean)
      ),
    ];
    const countries = [
      ...new Set(
        asDir
          .map((p) => (p.country != null ? String(p.country).trim() : ''))
          .filter(Boolean)
      ),
    ];

    const industryHubs: MetadataRoute.Sitemap = industries.map((ind) => ({
      url: `${BASE}/directory/industry/${facetSlug(ind)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
    const cityHubs: MetadataRoute.Sitemap = cities.map((city) => ({
      url: `${BASE}/directory/city/${facetSlug(city)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.78,
    }));
    const countryHubs: MetadataRoute.Sitemap = countries.map((country) => ({
      url: `${BASE}/directory/country/${facetSlug(country)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

    // Long-tail: industry × city (e.g. Food suppliers in Johannesburg)
    const pairs = industryCityPairs(asDir, 500);
    const comboHubs: MetadataRoute.Sitemap = pairs.map(({ industry, city }) => ({
      url: `${BASE}/directory/industry/${facetSlug(industry)}/in/${facetSlug(city)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.72,
    }));

    return [
      ...staticRoutes,
      ...industryHubs,
      ...cityHubs,
      ...countryHubs,
      ...comboHubs,
    ];
  } catch {
    return staticRoutes;
  }
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
