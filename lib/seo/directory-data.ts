/**
 * Shared load/filter for public directory + industry/city hub pages.
 * Loads all eligible companies (paginated) so every listed business is findable.
 */
import { isEligibleForDiscovery } from '@/lib/business/completeness';
import { slugifyCompanyName } from '@/lib/seo/company-public';
import {
  loadAllPublicCompanyRows,
  type PublicCompanyRow,
} from '@/lib/seo/load-public-companies';

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

function rowToDirCompany(r: PublicCompanyRow): DirCompany {
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
    open_to_trade: openTrade,
  };
}

/**
 * Load directory with optional filters.
 * @param listLimit max companies returned after filter (default 500 — was 200)
 */
export async function loadDirectory(
  filters: DirectoryFilters,
  opts?: { listLimit?: number }
): Promise<{
  companies: DirCompany[];
  industries: string[];
  cities: string[];
  countries: string[];
  eligibleTotal: number;
}> {
  const rows = await loadAllPublicCompanyRows();
  // Map through discovery filter again in case completeness rules change
  const eligible = rows
    .filter((r) =>
      isEligibleForDiscovery({
        ...r,
        is_discoverable: r.is_discoverable,
      } as Record<string, unknown>).ok
    )
    .map(rowToDirCompany)
    .filter((c) => Number.isFinite(c.id) && c.id > 0);

  return filterAndFacet(eligible, filters, opts?.listLimit ?? 500);
}

function filterAndFacet(
  eligible: DirCompany[],
  filters: DirectoryFilters,
  listLimit: number
): {
  companies: DirCompany[];
  industries: string[];
  cities: string[];
  countries: string[];
  eligibleTotal: number;
} {
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
    companies: list.slice(0, listLimit),
    industries,
    cities,
    countries,
    eligibleTotal: eligible.length,
  };
}

/** Build industry×city pairs that have at least one company (long-tail SEO). */
export function industryCityPairs(
  companies: DirCompany[],
  max = 400
): Array<{ industry: string; city: string; count: number }> {
  const map = new Map<string, { industry: string; city: string; count: number }>();
  for (const c of companies) {
    const industry = String(c.industry || '').trim();
    const city = String(c.city || '').trim();
    if (!industry || !city) continue;
    const key = `${industry.toLowerCase()}::${city.toLowerCase()}`;
    const prev = map.get(key);
    if (prev) prev.count += 1;
    else map.set(key, { industry, city, count: 1 });
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, max);
}
