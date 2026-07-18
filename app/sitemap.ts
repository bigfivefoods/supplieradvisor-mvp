import type { MetadataRoute } from 'next';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { isEligibleForDiscovery } from '@/lib/business/completeness';
import { companyPublicPath, SITE_URL } from '@/lib/seo/company-public';
import { facetSlug } from '@/lib/seo/directory-data';

/** Prefer www canonical host for Google Search Console */
const BASE = SITE_URL;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE}/directory`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.95,
    },
    {
      url: `${BASE}/#directory`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.85,
    },
    {
      url: `${BASE}/pricing`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE}/verification-sla`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.75,
    },
    {
      url: `${BASE}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE}/onboarding?type=business`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];

  try {
    const supabase = getSupabaseServer();
    // Paginate to cover more of the directory (Google sitemap soft limit is large)
    const pageSize = 1000;
    const maxPages = 5;
    const allCompanies: Array<Record<string, unknown>> = [];

    for (let page = 0; page < maxPages; page += 1) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from('profiles')
        .select(
          // Never select is_verified — ghost column on profiles
          'id, trading_name, legal_name, is_discoverable, logo_url, email, city, country, registration_number, verification_status, industry, updated_at'
        )
        .not('trading_name', 'is', null)
        .order('updated_at', { ascending: false })
        .range(from, to);

      if (error) {
        // Fallback single page without range
        if (page === 0) {
          const retry = await supabase
            .from('profiles')
            .select(
              'id, trading_name, legal_name, is_discoverable, email, city, country, verification_status, industry, updated_at'
            )
            .not('trading_name', 'is', null)
            .order('updated_at', { ascending: false })
            .limit(500);
          if (retry.data) allCompanies.push(...(retry.data as Array<Record<string, unknown>>));
        }
        break;
      }
      const batch = (data || []) as Array<Record<string, unknown>>;
      allCompanies.push(...batch);
      if (batch.length < pageSize) break;
    }

    const discoverable = allCompanies.filter((p) =>
      isEligibleForDiscovery(p).ok
    );

    const companyUrls: MetadataRoute.Sitemap = discoverable.map((p) => {
      const verified =
        String(p.verification_status || '').toLowerCase() === 'verified';
      const path = companyPublicPath({
        id: Number(p.id),
        trading_name:
          p.trading_name != null ? String(p.trading_name) : null,
        legal_name: p.legal_name != null ? String(p.legal_name) : null,
      });
      return {
        url: `${BASE}${path}`,
        lastModified: p.updated_at
          ? new Date(String(p.updated_at))
          : undefined,
        changeFrequency: 'weekly' as const,
        priority: verified ? 0.85 : 0.7,
      };
    });

    // Industry + city hub landing pages for long-tail SEO
    const industries = [
      ...new Set(
        discoverable
          .map((p) => (p.industry != null ? String(p.industry).trim() : ''))
          .filter(Boolean)
      ),
    ];
    const cities = [
      ...new Set(
        discoverable
          .map((p) => (p.city != null ? String(p.city).trim() : ''))
          .filter(Boolean)
      ),
    ];
    const industryHubs: MetadataRoute.Sitemap = industries
      .slice(0, 80)
      .map((ind) => ({
        url: `${BASE}/directory/industry/${facetSlug(ind)}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.75,
      }));
    const cityHubs: MetadataRoute.Sitemap = cities.slice(0, 80).map((city) => ({
      url: `${BASE}/directory/city/${facetSlug(city)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.75,
    }));
    const countriesList = [
      ...new Set(
        discoverable
          .map((p) => (p.country != null ? String(p.country).trim() : ''))
          .filter(Boolean)
      ),
    ];
    const countryHubs: MetadataRoute.Sitemap = countriesList
      .slice(0, 80)
      .map((country) => ({
        url: `${BASE}/directory/country/${facetSlug(country)}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.78,
      }));

    const { data: products } = await supabase
      .from('products')
      .select('public_id, updated_at')
      .not('public_id', 'is', null)
      .limit(1000);

    const productUrls: MetadataRoute.Sitemap = (products || [])
      .filter((p) => p.public_id)
      .map((p) => ({
        url: `${BASE}/p/${p.public_id}`,
        lastModified: p.updated_at ? new Date(String(p.updated_at)) : undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.55,
      }));

    return [
      ...staticRoutes,
      ...industryHubs,
      ...cityHubs,
      ...countryHubs,
      ...companyUrls,
      ...productUrls,
    ];
  } catch {
    return staticRoutes;
  }
}
