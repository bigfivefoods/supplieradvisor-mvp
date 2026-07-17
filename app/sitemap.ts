import type { MetadataRoute } from 'next';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { isEligibleForDiscovery } from '@/lib/business/completeness';
import { SITE_URL } from '@/lib/seo/company-public';

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
      url: `${BASE}/#directory`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.95,
    },
    {
      url: `${BASE}/pricing`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
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

    const companyUrls: MetadataRoute.Sitemap = allCompanies
      .filter((p) => isEligibleForDiscovery(p).ok)
      .map((p) => {
        const verified =
          String(p.verification_status || '').toLowerCase() === 'verified';
        return {
          url: `${BASE}/c/${p.id}`,
          lastModified: p.updated_at
            ? new Date(String(p.updated_at))
            : undefined,
          changeFrequency: 'weekly' as const,
          // Verified companies rank higher for crawl priority
          priority: verified ? 0.85 : 0.7,
        };
      });

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

    return [...staticRoutes, ...companyUrls, ...productUrls];
  } catch {
    return staticRoutes;
  }
}
