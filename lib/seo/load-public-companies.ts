/**
 * Paginated load of all discoverable public companies for sitemap + directory SEO.
 * Shared so sitemap and directory never silently cap at a few hundred rows.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { isEligibleForDiscovery } from '@/lib/business/completeness';

export type PublicCompanyRow = {
  id: number;
  trading_name: string | null;
  legal_name: string | null;
  industry: string | null;
  city: string | null;
  country: string | null;
  province: string | null;
  logo_url: string | null;
  short_description: string | null;
  verification_status: string | null;
  trust_score: number | null;
  is_discoverable: boolean | null;
  email: string | null;
  registration_number: string | null;
  updated_at: string | null;
  settings?: unknown;
  is_buyer?: boolean | null;
  business_type?: string | null;
  org_type?: string | null;
  category?: string | null;
};

const SELECT_FULL =
  'id, trading_name, legal_name, industry, city, country, province, logo_url, short_description, verification_status, trust_score, is_discoverable, email, registration_number, updated_at, settings, is_buyer, business_type, org_type, category';

const SELECT_MIN =
  'id, trading_name, legal_name, industry, city, country, logo_url, short_description, verification_status, is_discoverable, email, updated_at, business_type, org_type';

/**
 * Fetch every named profile (paginated), then filter with isEligibleForDiscovery.
 * @param maxRows hard cap for safety (default 50_000)
 */
export async function loadAllPublicCompanyRows(
  maxRows = 50_000
): Promise<PublicCompanyRow[]> {
  const supabase = getSupabaseServer();
  const pageSize = 1000;
  const maxPages = Math.ceil(maxRows / pageSize);
  const all: Array<Record<string, unknown>> = [];

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('profiles')
      .select(SELECT_FULL)
      .not('trading_name', 'is', null)
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (error) {
      if (page === 0) {
        const retry = await supabase
          .from('profiles')
          .select(SELECT_MIN)
          .not('trading_name', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(1000);
        if (retry.data) all.push(...(retry.data as Array<Record<string, unknown>>));
      }
      break;
    }
    const batch = (data || []) as Array<Record<string, unknown>>;
    all.push(...batch);
    if (batch.length < pageSize) break;
  }

  return all
    .filter((p) => isEligibleForDiscovery(p).ok)
    .map((p): PublicCompanyRow => ({
      id: Number(p.id),
      trading_name: p.trading_name != null ? String(p.trading_name) : null,
      legal_name: p.legal_name != null ? String(p.legal_name) : null,
      industry: p.industry != null ? String(p.industry) : null,
      city: p.city != null ? String(p.city) : null,
      country: p.country != null ? String(p.country) : null,
      province: p.province != null ? String(p.province) : null,
      logo_url: p.logo_url != null ? String(p.logo_url) : null,
      short_description:
        p.short_description != null ? String(p.short_description) : null,
      verification_status:
        p.verification_status != null ? String(p.verification_status) : null,
      trust_score:
        p.trust_score != null && Number.isFinite(Number(p.trust_score))
          ? Number(p.trust_score)
          : null,
      is_discoverable:
        p.is_discoverable !== false && p.is_discoverable !== 'false',
      email: p.email != null ? String(p.email) : null,
      registration_number:
        p.registration_number != null ? String(p.registration_number) : null,
      updated_at: p.updated_at != null ? String(p.updated_at) : null,
      settings: p.settings,
      is_buyer: p.is_buyer != null ? Boolean(p.is_buyer) : null,
      business_type:
        p.business_type != null ? String(p.business_type) : null,
      org_type: p.org_type != null ? String(p.org_type) : null,
      category: p.category != null ? String(p.category) : null,
    }))
    .filter((c) => Number.isFinite(c.id) && c.id > 0);
}
