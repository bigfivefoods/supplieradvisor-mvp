/**
 * Shared load/filter for public directory + industry/city hub pages.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { isEligibleForDiscovery } from '@/lib/business/completeness';
import { slugifyCompanyName } from '@/lib/seo/company-public';

export type DirectoryFilters = {
  q?: string;
  industry?: string;
  city?: string;
  country?: string;
  /** When true, only companies with open_to_trade in settings (or default true) */
  openToTrade?: string | boolean;
};

export type DirCompany = {
  id: number;
  trading_name: string | null;
  legal_name: string | null;
  industry: string | null;
  city: string | null;
  country: string | null;
  logo_url: string | null;
  short_description: string | null;
  verification_status: string | null;
  trust_score: number | null;
  open_to_trade?: boolean | null;
};

export function dirCompanyName(c: DirCompany): string {
  return String(c.trading_name || c.legal_name || `Company #${c.id}`).trim();
}

/** Stable slug for industry / city hub paths */
export function facetSlug(label: string): string {
  return slugifyCompanyName(label);
}

export function matchFacetBySlug(
  labels: string[],
  slug: string
): string | null {
  const s = String(slug || '')
    .toLowerCase()
    .trim();
  if (!s) return null;
  for (const l of labels) {
    if (facetSlug(l) === s) return l;
  }
  // Fallback: decode hyphens to spaces and case-insensitive equality
  const spaced = s.replace(/-/g, ' ');
  for (const l of labels) {
    if (String(l).toLowerCase().trim() === spaced) return l;
  }
  return null;
}

export async function loadDirectory(filters: DirectoryFilters): Promise<{
  companies: DirCompany[];
  industries: string[];
  cities: string[];
  countries: string[];
  eligibleTotal: number;
}> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, trading_name, legal_name, industry, city, country, logo_url, short_description, verification_status, trust_score, is_discoverable, is_buyer, settings, email, updated_at'
    )
    .not('trading_name', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(800);

  let rows: Array<Record<string, unknown>> = [];
  if (error) {
    const retry = await supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, industry, city, country, logo_url, verification_status, is_discoverable'
      )
      .not('trading_name', 'is', null)
      .limit(400);
    rows = (retry.data || []) as Array<Record<string, unknown>>;
  } else {
    rows = (data || []) as Array<Record<string, unknown>>;
  }

  return filterAndFacet(rows, filters);
}

function filterAndFacet(
  rows: Array<Record<string, unknown>>,
  filters: DirectoryFilters
): {
  companies: DirCompany[];
  industries: string[];
  cities: string[];
  countries: string[];
  eligibleTotal: number;
} {
  const eligible = rows
    .filter((r) => isEligibleForDiscovery(r).ok)
    .map(
      (r): DirCompany => {
        const settings =
          r.settings && typeof r.settings === 'object'
            ? (r.settings as Record<string, unknown>)
            : {};
        const openTrade =
          settings.open_to_trade === false
            ? false
            : settings.open_to_trade === true
              ? true
              : r.is_buyer !== false;
        return {
          id: Number(r.id),
          trading_name: r.trading_name != null ? String(r.trading_name) : null,
          legal_name: r.legal_name != null ? String(r.legal_name) : null,
          industry: r.industry != null ? String(r.industry) : null,
          city: r.city != null ? String(r.city) : null,
          country: r.country != null ? String(r.country) : null,
          logo_url: r.logo_url != null ? String(r.logo_url) : null,
          short_description:
            r.short_description != null ? String(r.short_description) : null,
          verification_status:
            r.verification_status != null
              ? String(r.verification_status)
              : null,
          trust_score:
            r.trust_score != null && Number.isFinite(Number(r.trust_score))
              ? Number(r.trust_score)
              : null,
          open_to_trade: openTrade,
        };
      }
    )
    .filter((c) => Number.isFinite(c.id) && c.id > 0);

  const q = String(filters.q || '')
    .toLowerCase()
    .trim();
  const industry = String(filters.industry || '').trim();
  const city = String(filters.city || '').trim();
  const country = String(filters.country || '').trim();

  let list = eligible;
  if (industry) {
    list = list.filter(
      (c) => String(c.industry || '').toLowerCase() === industry.toLowerCase()
    );
  }
  if (city) {
    list = list.filter(
      (c) => String(c.city || '').toLowerCase() === city.toLowerCase()
    );
  }
  if (country) {
    list = list.filter(
      (c) => String(c.country || '').toLowerCase() === country.toLowerCase()
    );
  }
  const openOnly =
    filters.openToTrade === true ||
    filters.openToTrade === '1' ||
    filters.openToTrade === 'true' ||
    filters.openToTrade === 'yes';
  if (openOnly) {
    list = list.filter((c) => c.open_to_trade !== false);
  }
  if (q) {
    list = list.filter((c) => {
      const hay = [
        c.trading_name,
        c.legal_name,
        c.industry,
        c.city,
        c.country,
        c.short_description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  const industries = [
    ...new Set(
      eligible.map((c) => c.industry).filter((x): x is string => Boolean(x))
    ),
  ].sort((a, b) => a.localeCompare(b));
  const cities = [
    ...new Set(
      eligible.map((c) => c.city).filter((x): x is string => Boolean(x))
    ),
  ].sort((a, b) => a.localeCompare(b));
  const countries = [
    ...new Set(
      eligible.map((c) => c.country).filter((x): x is string => Boolean(x))
    ),
  ].sort((a, b) => a.localeCompare(b));

  list = [...list].sort((a, b) => {
    const av =
      String(a.verification_status || '').toLowerCase() === 'verified' ? 0 : 1;
    const bv =
      String(b.verification_status || '').toLowerCase() === 'verified' ? 0 : 1;
    if (av !== bv) return av - bv;
    return dirCompanyName(a).localeCompare(dirCompanyName(b));
  });

  return {
    companies: list.slice(0, 200),
    industries,
    cities,
    countries,
    eligibleTotal: eligible.length,
  };
}
