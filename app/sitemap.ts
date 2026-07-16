import type { MetadataRoute } from 'next';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { isEligibleForDiscovery } from '@/lib/business/completeness';

const BASE =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://supplieradvisor.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/#directory`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/login`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/add-to-home.html`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  try {
    const supabase = getSupabaseServer();
    const { data: companies } = await supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, is_discoverable, logo_url, email, city, country, registration_number, verification_status, is_verified, industry, updated_at'
      )
      .not('trading_name', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(500);

    const companyUrls: MetadataRoute.Sitemap = (companies || [])
      .filter((p) => isEligibleForDiscovery(p as Record<string, unknown>).ok)
      .map((p) => ({
        url: `${BASE}/c/${p.id}`,
        lastModified: p.updated_at ? new Date(String(p.updated_at)) : undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));

    const { data: products } = await supabase
      .from('products')
      .select('public_id, updated_at')
      .not('public_id', 'is', null)
      .limit(500);

    const productUrls: MetadataRoute.Sitemap = (products || [])
      .filter((p) => p.public_id)
      .map((p) => ({
        url: `${BASE}/p/${p.public_id}`,
        lastModified: p.updated_at ? new Date(String(p.updated_at)) : undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));

    return [...staticRoutes, ...companyUrls, ...productUrls];
  } catch {
    return staticRoutes;
  }
}
