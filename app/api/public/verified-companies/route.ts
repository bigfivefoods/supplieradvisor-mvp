import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { SEED_CONTINENTS, SEED_COUNTRIES } from '@/lib/geo/world-seed';
import { continentFromCountry } from '@/lib/geo/continent-from-country';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export type PublicCompany = {
  id: number;
  legal_name: string | null;
  trading_name: string | null;
  verification_status: string | null;
  verified_at: string | null;
  business_type: string | null;
  industry: string | null;
  sub_industry: string | null;
  category: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  continent: string | null;
  logo_url?: string | null;
  website?: string | null;
  short_description?: string | null;
  relationship_type?: string | null;
  bee_level?: string | null;
  certifications?: string[] | null;
  is_supplier?: boolean | null;
  is_buyer?: boolean | null;
  /** 0–100 style trust score when available */
  trust_score?: number | null;
  /** Overall peer star average (1–5) from suppliers & customers */
  star_avg?: number | null;
  star_count?: number;
  /** Stars received when rated as a supplier (by customers/buyers) */
  stars_as_supplier_avg?: number | null;
  stars_as_supplier_count?: number;
  /** Stars received when rated as a customer (by suppliers) */
  stars_as_customer_avg?: number | null;
  stars_as_customer_count?: number;
  /** OTIFEF % (On-Time, In-Full, Error-Free) when available */
  otifef_pct?: number | null;
  otifef_count?: number;
  badge: 'verified' | 'network';
  created_at?: string | null;
  join_rank?: number;
};

const FULL_SELECT =
  'id, legal_name, trading_name, verification_status, verified_at, business_type, industry, sub_industry, category, city, province, country, continent, logo_url, website, short_description, relationship_type, bee_level, certifications, is_supplier, is_buyer, is_discoverable, trust_score, otifef_average, created_at';

const MID_SELECT =
  'id, legal_name, trading_name, verification_status, verified_at, business_type, industry, city, province, country, continent, logo_url, website, is_discoverable, trust_score, otifef_average, created_at';

const MIN_SELECT =
  'id, legal_name, trading_name, verification_status, business_type, industry, city, country, trust_score, created_at';

function isVerifiedStatus(status?: string | null): boolean {
  const s = String(status || '').toLowerCase().trim();
  return (
    s === 'verified' ||
    s === 'approved' ||
    s === 'active_verified' ||
    s === 'complete'
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function uniqSorted(values: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const s = String(v || '').trim();
    if (s) set.add(s);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function asStringArray(v: unknown): string[] | null {
  if (Array.isArray(v)) {
    return v.map((x) => String(x)).filter(Boolean);
  }
  if (typeof v === 'string' && v.trim()) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x)).filter(Boolean);
    } catch {
      return v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return null;
}

/**
 * Public marketing endpoint — safe profile fields only.
 * Supports optional metadata filters for directory search.
 *
 * GET ?q=&industry=&country=&city=&province=&continent=&business_type=
 *     &badge=verified|network&role=supplier|buyer|both
 *     &minStars=&minTrust=&minOtifef=&cert=&bee=
 *     &sort=joined|name|stars|trust|otifef
 */
export async function GET(request: NextRequest) {
  try {
    const { rateLimit, clientIp } = await import('@/lib/http/rate-limit');
    const ip = clientIp(request);
    const rl = rateLimit(`public-directory:${ip}`, {
      limit: 120,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfterSec: rl.retryAfterSec },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      );
    }

    const sp = request.nextUrl.searchParams;
    const q = (sp.get('q') || '').trim().toLowerCase();
    const industry = (sp.get('industry') || '').trim().toLowerCase();
    const subIndustry = (sp.get('sub_industry') || '').trim().toLowerCase();
    const country = (sp.get('country') || '').trim().toLowerCase();
    const city = (sp.get('city') || '').trim().toLowerCase();
    const province = (sp.get('province') || '').trim().toLowerCase();
    const continent = (sp.get('continent') || '').trim().toLowerCase();
    const businessType = (sp.get('business_type') || '').trim().toLowerCase();
    const badge = (sp.get('badge') || '').trim().toLowerCase();
    const role = (sp.get('role') || '').trim().toLowerCase();
    const cert = (sp.get('cert') || '').trim().toLowerCase();
    const bee = (sp.get('bee') || '').trim().toLowerCase();
    const minStars = Number(sp.get('minStars') || 0);
    const minTrust = Number(sp.get('minTrust') || 0);
    const minOtifef = Number(sp.get('minOtifef') || 0);
    const sort = (sp.get('sort') || 'joined').trim().toLowerCase();
    const includeHidden = sp.get('includeHidden') === '1';    const page = Math.max(1, Number(sp.get('page') || 1) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(sp.get('pageSize') || 9) || 9));

    const supabase = getSupabaseServer();

    type Row = Record<string, unknown>;
    let rows: Row[] = [];

    for (const select of [FULL_SELECT, MID_SELECT, MIN_SELECT]) {
      let query = supabase
        .from('profiles')
        .select(select)
        .not('trading_name', 'is', null)
        .order('created_at', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true })
        .limit(800);

      const { data, error } = await query;
      if (!error && data) {
        rows = data as unknown as Row[];
        break;
      }
    }

    rows = rows.filter(
      (p) => String(p.trading_name || p.legal_name || '').trim().length > 1
    );

    // Hide companies that opted out OR lack minimum profile completeness
    if (!includeHidden) {
      const { isEligibleForDiscovery } = await import(
        '@/lib/business/completeness'
      );
      rows = rows.filter((p) => isEligibleForDiscovery(p).ok);
    }

    rows.sort((a, b) => {
      const ac = a.created_at ? new Date(String(a.created_at)).getTime() : 0;
      const bc = b.created_at ? new Date(String(b.created_at)).getTime() : 0;
      if (ac !== bc) return ac - bc;
      return Number(a.id) - Number(b.id);
    });

    const ids = rows.map((p) => Number(p.id)).filter((n) => Number.isFinite(n));

    type StarBucket = { sum: number; count: number };
    const starsAll = new Map<number, StarBucket>();
    const starsAsSupplier = new Map<number, StarBucket>();
    const starsAsCustomer = new Map<number, StarBucket>();

    const addStar = (
      map: Map<number, StarBucket>,
      pid: number,
      overall: number
    ) => {
      if (!map.has(pid)) map.set(pid, { sum: 0, count: 0 });
      const m = map.get(pid)!;
      m.sum += overall;
      m.count += 1;
    };

    if (ids.length) {
      const ratingsRes = await supabase
        .from('company_ratings')
        .select('ratee_profile_id, overall, ratee_role, status')
        .in('ratee_profile_id', ids)
        .eq('status', 'published')
        .limit(4000);

      if (!ratingsRes.error && ratingsRes.data) {
        for (const r of ratingsRes.data) {
          const pid = Number(r.ratee_profile_id);
          const overall = Number(r.overall);
          if (!Number.isFinite(pid) || !Number.isFinite(overall) || overall <= 0) {
            continue;
          }
          addStar(starsAll, pid, overall);
          const roleR = String(r.ratee_role || '').toLowerCase();
          if (roleR === 'supplier') addStar(starsAsSupplier, pid, overall);
          if (roleR === 'customer') addStar(starsAsCustomer, pid, overall);
        }
      }
    }

    const otifefByProfile = new Map<number, { sum: number; count: number }>();
    if (ids.length) {
      const fb = await supabase
        .from('invoice_feedback')
        .select('profile_id, otifef_score')
        .in('profile_id', ids)
        .not('otifef_score', 'is', null)
        .limit(4000);
      if (!fb.error && fb.data) {
        for (const row of fb.data) {
          const pid = Number(row.profile_id);
          const score = Number(row.otifef_score);
          if (!Number.isFinite(pid) || !Number.isFinite(score)) continue;
          if (!otifefByProfile.has(pid)) {
            otifefByProfile.set(pid, { sum: 0, count: 0 });
          }
          const m = otifefByProfile.get(pid)!;
          m.sum += score;
          m.count += 1;
        }
      }
    }

    const avgFrom = (m: StarBucket | undefined): number | null => {
      if (!m || m.count <= 0) return null;
      return round1(m.sum / m.count);
    };

    let companies: PublicCompany[] = rows.map((p) => {
      const id = Number(p.id);
      const verified = isVerifiedStatus(p.verification_status as string);
      const stars = starsAll.get(id);
      const asSup = starsAsSupplier.get(id);
      const asCust = starsAsCustomer.get(id);
      const trustRaw = p.trust_score != null ? Number(p.trust_score) : null;

      const profileOtifef =
        p.otifef_average != null ? Number(p.otifef_average) : null;
      const fbOtifef = otifefByProfile.get(id);
      let otifef_pct: number | null = null;
      let otifef_count = 0;
      if (fbOtifef && fbOtifef.count > 0) {
        otifef_pct = round1(fbOtifef.sum / fbOtifef.count);
        otifef_count = fbOtifef.count;
      } else if (
        profileOtifef != null &&
        Number.isFinite(profileOtifef) &&
        profileOtifef > 0
      ) {
        otifef_pct = round1(profileOtifef);
        otifef_count = 1;
      }

      return {
        id,
        legal_name: (p.legal_name as string | null) ?? null,
        trading_name: (p.trading_name as string | null) ?? null,
        verification_status: (p.verification_status as string | null) ?? null,
        verified_at: (p.verified_at as string | null) ?? null,
        business_type: (p.business_type as string | null) ?? null,
        industry: (p.industry as string | null) ?? null,
        sub_industry: (p.sub_industry as string | null) ?? null,
        category: (p.category as string | null) ?? null,
        city: (p.city as string | null) ?? null,
        province: (p.province as string | null) ?? null,
        country: (p.country as string | null) ?? null,
        continent: (p.continent as string | null) ?? null,
        logo_url: (p.logo_url as string | null) ?? null,
        website: (p.website as string | null) ?? null,
        short_description: (p.short_description as string | null) ?? null,
        relationship_type: (p.relationship_type as string | null) ?? null,
        bee_level: (p.bee_level as string | null) ?? null,
        certifications: asStringArray(p.certifications),
        is_supplier:
          p.is_supplier == null ? null : Boolean(p.is_supplier),
        is_buyer: p.is_buyer == null ? null : Boolean(p.is_buyer),
        trust_score:
          trustRaw != null && Number.isFinite(trustRaw)
            ? round1(trustRaw)
            : null,
        star_avg: avgFrom(stars),
        star_count: stars?.count ?? 0,
        stars_as_supplier_avg: avgFrom(asSup),
        stars_as_supplier_count: asSup?.count ?? 0,
        stars_as_customer_avg: avgFrom(asCust),
        stars_as_customer_count: asCust?.count ?? 0,
        otifef_pct,
        otifef_count,
        badge: verified ? ('verified' as const) : ('network' as const),
        created_at: (p.created_at as string | null) ?? null,
      };
    });

    const seen = new Set<string>();
    companies = companies.filter((c) => {
      const key = (c.trading_name || c.legal_name || String(c.id)).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    companies = companies.map((c, i) => ({ ...c, join_rank: i + 1 }));

    // Facets: full geo seed + network values so country is never "only Kenya"
    const poolCountries = uniqSorted(companies.map((c) => c.country));
    const poolContinents = uniqSorted(
      companies.map(
        (c) => c.continent || continentFromCountry(c.country) || null
      )
    );
    const countriesByContinent: Record<string, string[]> = {};
    for (const c of SEED_COUNTRIES) {
      if (!countriesByContinent[c.continent]) {
        countriesByContinent[c.continent] = [];
      }
      countriesByContinent[c.continent].push(c.name);
    }
    for (const k of Object.keys(countriesByContinent)) {
      countriesByContinent[k] = uniqSorted(countriesByContinent[k]);
    }

    const facets = {
      industries: uniqSorted(companies.map((c) => c.industry)),
      subIndustries: uniqSorted(companies.map((c) => c.sub_industry)),
      countries: uniqSorted([
        ...SEED_COUNTRIES.map((c) => c.name),
        ...poolCountries,
      ]),
      cities: uniqSorted(companies.map((c) => c.city)),
      provinces: uniqSorted(companies.map((c) => c.province)),
      continents: uniqSorted([
        ...SEED_CONTINENTS.map((c) => c.name),
        ...poolContinents,
      ]),
      businessTypes: uniqSorted(companies.map((c) => c.business_type)),
      categories: uniqSorted(companies.map((c) => c.category)),
      beeLevels: uniqSorted(companies.map((c) => c.bee_level)),
      certifications: uniqSorted(
        companies.flatMap((c) => c.certifications || [])
      ),
      countriesInNetwork: poolCountries,
      continentsInNetwork: poolContinents,
      countriesByContinent,
    };

    // Apply filters
    if (q) {
      companies = companies.filter((c) => {
        const hay = [
          c.trading_name,
          c.legal_name,
          c.industry,
          c.sub_industry,
          c.category,
          c.city,
          c.province,
          c.country,
          c.continent,
          c.business_type,
          c.short_description,
          c.bee_level,
          ...(c.certifications || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    if (industry) {
      companies = companies.filter((c) =>
        String(c.industry || '')
          .toLowerCase()
          .includes(industry)
      );
    }
    if (subIndustry) {
      companies = companies.filter((c) =>
        String(c.sub_industry || '')
          .toLowerCase()
          .includes(subIndustry)
      );
    }
    if (country) {
      companies = companies.filter(
        (c) => String(c.country || '').toLowerCase() === country
      );
    }
    if (city) {
      companies = companies.filter((c) =>
        String(c.city || '')
          .toLowerCase()
          .includes(city)
      );
    }
    if (province) {
      companies = companies.filter((c) =>
        String(c.province || '')
          .toLowerCase()
          .includes(province)
      );
    }
    if (continent) {
      companies = companies.filter((c) => {
        const direct = String(c.continent || '').toLowerCase();
        if (direct === continent) return true;
        const inferred = String(
          continentFromCountry(c.country) || ''
        ).toLowerCase();
        return inferred === continent;
      });
    }
    if (businessType) {
      companies = companies.filter((c) =>
        String(c.business_type || '')
          .toLowerCase()
          .includes(businessType)
      );
    }
    if (badge === 'verified') {
      companies = companies.filter((c) => c.badge === 'verified');
    } else if (badge === 'network') {
      companies = companies.filter((c) => c.badge === 'network');
    }
    if (role === 'supplier') {
      companies = companies.filter((c) => c.is_supplier !== false);
    } else if (role === 'buyer') {
      companies = companies.filter((c) => c.is_buyer !== false);
    } else if (role === 'both') {
      companies = companies.filter(
        (c) => c.is_supplier !== false && c.is_buyer !== false
      );
    }
    if (cert) {
      companies = companies.filter((c) =>
        (c.certifications || []).some((x) =>
          String(x).toLowerCase().includes(cert)
        )
      );
    }
    if (bee) {
      companies = companies.filter((c) =>
        String(c.bee_level || '')
          .toLowerCase()
          .includes(bee)
      );
    }
    if (minStars > 0) {
      companies = companies.filter(
        (c) => c.star_avg != null && c.star_avg >= minStars
      );
    }
    if (minTrust > 0) {
      companies = companies.filter(
        (c) => c.trust_score != null && c.trust_score >= minTrust
      );
    }
    if (minOtifef > 0) {
      companies = companies.filter(
        (c) => c.otifef_pct != null && c.otifef_pct >= minOtifef
      );
    }

    // Sort
    if (sort === 'name') {
      companies.sort((a, b) =>
        String(a.trading_name || a.legal_name || '').localeCompare(
          String(b.trading_name || b.legal_name || '')
        )
      );
    } else if (sort === 'stars') {
      companies.sort(
        (a, b) => (b.star_avg ?? 0) - (a.star_avg ?? 0) || (b.star_count ?? 0) - (a.star_count ?? 0)
      );
    } else if (sort === 'trust') {
      companies.sort((a, b) => (b.trust_score ?? 0) - (a.trust_score ?? 0));
    } else if (sort === 'otifef') {
      companies.sort((a, b) => (b.otifef_pct ?? 0) - (a.otifef_pct ?? 0));
    } else {
      // joined (default) — keep join_rank order
      companies.sort((a, b) => (a.join_rank ?? 0) - (b.join_rank ?? 0));
    }

    const verifiedCount = companies.filter((c) => c.badge === 'verified').length;
    const networkCount = companies.filter((c) => c.badge === 'network').length;
    const filteredTotal = companies.length;

    let platformTotal = companies.length;
    const { count: profileCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('trading_name', 'is', null);
    if (typeof profileCount === 'number' && profileCount > 0) {
      platformTotal = profileCount;
    }

    // Server pagination when ?page= is provided; otherwise full filtered set
    // (marketing client still paginates in-browser for facets).
    const wantsPage = sp.has('page') || sp.has('pageSize');
    const pageCount = Math.max(1, Math.ceil(filteredTotal / pageSize));
    const pageSafe = Math.min(page, pageCount);
    const start = (pageSafe - 1) * pageSize;
    const paged = wantsPage
      ? companies.slice(start, start + pageSize)
      : companies;

    return NextResponse.json({
      success: true,
      companies: paged,
      allCount: filteredTotal,
      facets,
      page: wantsPage ? pageSafe : 1,
      pageSize: wantsPage ? pageSize : filteredTotal || pageSize,
      pageCount: wantsPage ? pageCount : 1,
      feedbackLoop:
        'Companies are rated by their suppliers and customers — a continuous loop of feedback that helps every business improve.',
      counts: {
        shown: paged.length,
        verified: verifiedCount,
        network: networkCount,
        total: filteredTotal,
        platformTotal,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        success: false,
        companies: [],
        facets: {
          industries: [],
          subIndustries: [],
          countries: [],
          cities: [],
          provinces: [],
          continents: [],
          businessTypes: [],
          categories: [],
          beeLevels: [],
          certifications: [],
        },
        counts: {
          shown: 0,
          verified: 0,
          network: 0,
          total: 0,
          platformTotal: 0,
        },
        error: e instanceof Error ? e.message : 'Error',
      },
      { status: 200 }
    );
  }
}
