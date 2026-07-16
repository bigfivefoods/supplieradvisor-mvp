import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import type { DiscoverSupplier } from '@/lib/suppliers/types';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';
import { SEED_COUNTRIES, SEED_CONTINENTS } from '@/lib/geo/world-seed';

/**
 * Deep metadata marketplace search across platform profiles.
 * GET ?companyId=&q=&country=&industry=&cert=&verified=&otifefMin=&trustMin=
 *   &continent=&province=&city=&bee=&sub_industry=&category=&relationship=
 *   &hasWallet=&role=supplier|buyer|both&connection=connected|pending|none
 *   &registeredOnly=&includeHidden=
 *
 * Location filters use case-insensitive match. Continent also matches via
 * country→continent seed map when profile.continent is blank.
 * Facets include full geo reference lists (not only countries already in pool).
 */

/** country name (lower) → continent name */
const COUNTRY_TO_CONTINENT = new Map(
  SEED_COUNTRIES.map((c) => [c.name.trim().toLowerCase(), c.continent])
);

function norm(s: unknown): string {
  return String(s || '')
    .trim()
    .toLowerCase();
}

function profileContinent(r: {
  continent?: string | null;
  country?: string | null;
}): string {
  const direct = String(r.continent || '').trim();
  if (direct) return direct;
  const fromCountry = COUNTRY_TO_CONTINENT.get(norm(r.country));
  return fromCountry || '';
}

function eqLoose(a: unknown, b: string): boolean {
  if (!b) return true;
  return norm(a) === norm(b);
}
const DISCOVER_SELECT =
  `id, trading_name, legal_name, email, industry, sub_industry, category,
   city, province, country, continent, certifications, trust_score, otifef_average,
   bee_level, verification_status, wallet_address, website, public_id,
   relationship_type, is_discoverable, is_supplier, is_buyer, supplier_status,
   claimed_at, created_at, logo_url, status, phone, description, short_description`;

const DISCOVER_SELECT_MINIMAL =
  `id, trading_name, legal_name, email, industry, category,
   city, country, certifications, trust_score,
   verification_status, wallet_address, website, public_id,
   relationship_type, supplier_status, created_at`;

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = sp.get('companyId') ? Number(sp.get('companyId')) : null;
    if (!companyId || !Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const _gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!_gate.ok) return _gate.response;

    const q = (sp.get('q') || '').trim().toLowerCase();
    const country = sp.get('country') || '';
    const continent = sp.get('continent') || '';
    const province = sp.get('province') || '';
    const city = sp.get('city') || '';
    const industry = sp.get('industry') || '';
    const subIndustry = sp.get('sub_industry') || '';
    const category = sp.get('category') || '';
    const bee = sp.get('bee') || '';
    const relationship = sp.get('relationship') || '';
    const cert = sp.get('cert') || '';
    const verifiedOnly = sp.get('verified') === '1' || sp.get('verified') === 'true';
    const hasWallet = sp.get('hasWallet') === '1' || sp.get('hasWallet') === 'true';
    const registeredOnly =
      sp.get('registeredOnly') === '1' || sp.get('registeredOnly') === 'true';
    const role = (sp.get('role') || '').toLowerCase(); // supplier | buyer | both
    const connection = (sp.get('connection') || '').toLowerCase(); // connected | pending | none | in_book
    const trustMin = Number(sp.get('trustMin') || 0);
    const trustMax = Number(sp.get('trustMax') || 100);
    const otifefMin = Number(sp.get('otifefMin') || 0);
    const otifefMax = Number(sp.get('otifefMax') || 100);
    const includeHidden = sp.get('includeHidden') === '1';
    const limit = Math.min(500, Number(sp.get('limit') || 200));
    const offset = Math.max(0, Number(sp.get('offset') || 0) || 0);
    const page = Math.max(1, Number(sp.get('page') || 1) || 1);
    // page takes precedence over offset when both present without offset
    const start =
      sp.has('offset')
        ? offset
        : sp.has('page')
          ? (page - 1) * limit
          : 0;

    const supabase = getSupabaseServer();

    type Row = DiscoverSupplier & {
      supplier_status?: string | null;
      claimed_at?: string | null;
      is_discoverable?: boolean | null;
      is_supplier?: boolean | null;
      is_buyer?: boolean | null;
      status?: string | null;
      phone?: string | null;
      description?: string | null;
      short_description?: string | null;
    };

    let rows: Row[] = [];
    let selectWarning: string | undefined;

    for (const select of [DISCOVER_SELECT, DISCOVER_SELECT_MINIMAL]) {
      let query = supabase
        .from('profiles')
        .select(select)
        .order('trading_name', { ascending: true })
        .limit(2000);

      if (companyId && Number.isFinite(companyId)) {
        query = query.neq('id', companyId);
      }

      const { data, error } = await query;
      if (!error) {
        rows = (data || []) as unknown as Row[];
        break;
      }
      selectWarning = error.message;
      console.warn('discover select failed, retrying minimal:', error.message);
    }

    if (!rows.length && selectWarning) {
      let query = supabase
        .from('profiles')
        .select('id, trading_name, legal_name, email, city, country, industry, supplier_status')
        .order('id', { ascending: false })
        .limit(2000);
      if (companyId && Number.isFinite(companyId)) {
        query = query.neq('id', companyId);
      }
      const { data, error } = await query;
      if (error) {
        return NextResponse.json({
          success: true,
          suppliers: [],
          total: 0,
          warning: error.message,
        });
      }
      rows = (data || []) as unknown as Row[];
    }

    const registeredIds = new Set<number>();
    {
      const { data: memberships } = await supabase
        .from('business_users')
        .select('profile_id')
        .eq('status', 'active');
      for (const m of memberships || []) {
        if (m.profile_id) registeredIds.add(Number(m.profile_id));
      }
    }

    const certsWanted = cert
      ? cert.split(',').map((c) => c.trim()).filter(Boolean)
      : [];

    rows = rows.filter((r) => {
      const name = String(r.trading_name || r.legal_name || '').trim();
      if (!name) return false;
      const id = Number(r.id);
      if (registeredIds.has(id)) return true;
      const status = String(r.supplier_status || r.status || '').toLowerCase();
      if ((status === 'invited' || status === 'pending') && !r.claimed_at) {
        return false;
      }
      return true;
    });

    if (!includeHidden) {
      const { isEligibleForDiscovery } = await import(
        '@/lib/business/completeness'
      );
      rows = rows.filter((r) => isEligibleForDiscovery(r as Record<string, unknown>).ok);
    }

    // Facets from full visible pool (before user filters) so deep search stays comprehensive
    const facetPool = [...rows];

    // Connection / book maps
    const bookMap = new Map<number, number>();
    const connected = new Set<number>();
    const pendingOut = new Set<number>();
    const pendingIn = new Set<number>();

    if (companyId && Number.isFinite(companyId)) {
      const [{ data: book }, { data: conns }] = await Promise.all([
        supabase
          .from('srm_suppliers')
          .select('id, linked_profile_id')
          .eq('profile_id', companyId)
          .not('linked_profile_id', 'is', null),
        supabase
          .from('business_connections')
          .select('requester_profile_id, requestee_profile_id, status')
          .or(
            `requester_profile_id.eq.${companyId},requestee_profile_id.eq.${companyId}`
          ),
      ]);

      for (const b of book || []) {
        if (b.linked_profile_id) {
          bookMap.set(Number(b.linked_profile_id), Number(b.id));
        }
      }
      for (const c of conns || []) {
        const a = Number(c.requester_profile_id);
        const b = Number(c.requestee_profile_id);
        const peer = a === companyId ? b : a;
        const status = String(c.status || '');
        if (status === 'accepted') connected.add(peer);
        if (status === 'pending' && a === companyId) pendingOut.add(peer);
        if (status === 'pending' && b === companyId) pendingIn.add(peer);
      }
    }

    // Apply filters
    if (q) {
      rows = rows.filter((r) => {
        const hay = [
          r.trading_name,
          r.legal_name,
          r.email,
          r.industry,
          r.sub_industry,
          r.category,
          r.city,
          r.province,
          r.country,
          r.continent,
          r.bee_level,
          r.relationship_type,
          r.website,
          r.phone,
          r.description,
          r.short_description,
          ...(r.certifications || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    if (country) {
      rows = rows.filter((r) => eqLoose(r.country, country));
    }
    if (continent) {
      const want = norm(continent);
      rows = rows.filter((r) => norm(profileContinent(r)) === want);
    }
    if (province) {
      rows = rows.filter((r) => eqLoose(r.province, province));
    }
    if (city) {
      rows = rows.filter((r) => eqLoose(r.city, city));
    }
    if (industry) rows = rows.filter((r) => r.industry === industry);
    if (subIndustry) rows = rows.filter((r) => r.sub_industry === subIndustry);
    if (category) {
      const cat = category.toLowerCase();
      rows = rows.filter((r) => String(r.category || '').toLowerCase() === cat);
    }
    if (bee) rows = rows.filter((r) => r.bee_level === bee);
    if (relationship) {
      rows = rows.filter(
        (r) =>
          String(r.relationship_type || '').toLowerCase() === relationship.toLowerCase()
      );
    }
    if (verifiedOnly) {
      rows = rows.filter(
        (r) =>
          String(r.verification_status || '').toLowerCase() === 'verified' ||
          r.verified === true
      );
    }
    if (hasWallet) {
      rows = rows.filter((r) => Boolean(r.wallet_address && String(r.wallet_address).length > 8));
    }
    if (registeredOnly) {
      rows = rows.filter((r) => registeredIds.has(Number(r.id)));
    }
    if (role === 'supplier') {
      rows = rows.filter(
        (r) =>
          r.is_supplier === true ||
          String(r.relationship_type || '').toLowerCase().includes('supplier') ||
          String(r.supplier_status || '').length > 0
      );
    } else if (role === 'buyer') {
      rows = rows.filter(
        (r) =>
          r.is_buyer === true ||
          String(r.relationship_type || '').toLowerCase().includes('buyer') ||
          String(r.relationship_type || '').toLowerCase().includes('customer')
      );
    } else if (role === 'both') {
      rows = rows.filter((r) => r.is_supplier === true && r.is_buyer === true);
    }
    if (trustMin > 0 || trustMax < 100) {
      rows = rows.filter((r) => {
        const t = Number(r.trust_score || 0);
        return t >= trustMin && t <= trustMax;
      });
    }
    if (otifefMin > 0 || otifefMax < 100) {
      rows = rows.filter((r) => {
        const o = Number(r.otifef_average || 0);
        return o >= otifefMin && o <= otifefMax;
      });
    }
    if (certsWanted.length) {
      rows = rows.filter((r) => {
        const have = (r.certifications || []).map((c) => String(c).toLowerCase());
        return certsWanted.every((c) => have.includes(c.toLowerCase()));
      });
    }
    if (connection === 'connected') {
      rows = rows.filter((r) => connected.has(Number(r.id)));
    } else if (connection === 'pending') {
      rows = rows.filter(
        (r) => pendingOut.has(Number(r.id)) || pendingIn.has(Number(r.id))
      );
    } else if (connection === 'none') {
      rows = rows.filter(
        (r) =>
          !connected.has(Number(r.id)) &&
          !pendingOut.has(Number(r.id)) &&
          !pendingIn.has(Number(r.id))
      );
    } else if (connection === 'in_book') {
      rows = rows.filter((r) => bookMap.has(Number(r.id)));
    }

    rows.sort((a, b) => {
      const aReg = registeredIds.has(Number(a.id)) ? 0 : 1;
      const bReg = registeredIds.has(Number(b.id)) ? 0 : 1;
      if (aReg !== bReg) return aReg - bReg;
      const aConn = connected.has(Number(a.id)) ? 0 : 1;
      const bConn = connected.has(Number(b.id)) ? 0 : 1;
      if (aConn !== bConn) return aConn - bConn;
      const an = String(a.trading_name || a.legal_name || '');
      const bn = String(b.trading_name || b.legal_name || '');
      return an.localeCompare(bn);
    });

    const enriched = rows.map((r) => {
      const verified =
        String(r.verification_status || '').toLowerCase() === 'verified' ||
        r.verified === true;
      return {
        ...r,
        in_my_book: bookMap.has(Number(r.id)),
        already_connected: connected.has(Number(r.id)),
        connection_pending_out: pendingOut.has(Number(r.id)),
        connection_pending_in: pendingIn.has(Number(r.id)),
        srm_supplier_id: bookMap.get(Number(r.id)) || null,
        verified,
        is_verified: verified,
        is_registered: registeredIds.has(Number(r.id)),
      };
    });

    // Facets from live pool + full geo seed so dropdowns aren't limited to
    // countries already present (e.g. only Kenya).
    const poolCountries = uniqueSorted(facetPool.map((r) => r.country));
    const poolContinents = uniqueSorted(
      facetPool.map((r) => profileContinent(r) || r.continent)
    );
    const allGeoCountries = uniqueSorted(SEED_COUNTRIES.map((c) => c.name));
    const allGeoContinents = uniqueSorted(SEED_CONTINENTS.map((c) => c.name));
    const countriesByContinent: Record<string, string[]> = {};
    for (const c of SEED_COUNTRIES) {
      const cont = c.continent;
      if (!countriesByContinent[cont]) countriesByContinent[cont] = [];
      countriesByContinent[cont].push(c.name);
    }
    for (const k of Object.keys(countriesByContinent)) {
      countriesByContinent[k] = uniqueSorted(countriesByContinent[k]);
    }

    const facets = {
      // Prefer full geo lists so every African (and world) country is selectable
      countries: uniqueSorted([...allGeoCountries, ...poolCountries]),
      continents: uniqueSorted([...allGeoContinents, ...poolContinents]),
      provinces: uniqueSorted(facetPool.map((r) => r.province)),
      cities: uniqueSorted(facetPool.map((r) => r.city)),
      industries: uniqueSorted(facetPool.map((r) => r.industry)),
      subIndustries: uniqueSorted(facetPool.map((r) => r.sub_industry)),
      categories: uniqueSorted(facetPool.map((r) => r.category)),
      certifications: uniqueSorted(facetPool.flatMap((r) => r.certifications || [])),
      beeLevels: uniqueSorted(facetPool.map((r) => r.bee_level)),
      relationships: uniqueSorted(facetPool.map((r) => r.relationship_type)),
      /** Countries present in the discoverable pool (for badges / empty-state hints) */
      countriesInNetwork: poolCountries,
      continentsInNetwork: poolContinents,
      countriesByContinent,
    };

    const connectedMatches = enriched.filter((r) => r.already_connected);
    const otherMatches = enriched.filter((r) => !r.already_connected);

    const paged = enriched.slice(start, start + limit);
    const pageCount = Math.max(1, Math.ceil(enriched.length / Math.max(limit, 1)));
    const pageSafe = Math.min(
      pageCount,
      Math.floor(start / Math.max(limit, 1)) + 1
    );
    const hasMore = start + limit < enriched.length;

    return NextResponse.json({
      success: true,
      suppliers: paged,
      connected: connectedMatches.slice(0, limit),
      others: otherMatches.slice(
        0,
        Math.max(0, limit - Math.min(connectedMatches.length, limit))
      ),
      total: enriched.length,
      connectedTotal: connectedMatches.length,
      offset: start,
      limit,
      page: pageSafe,
      pageCount,
      hasMore,
      facets,
      platform_company_count: registeredIds.size,
      pool_size: facetPool.length,
      warning: selectWarning && !enriched.length ? selectWarning : undefined,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

function uniqueSorted(vals: Array<string | null | undefined>) {
  return Array.from(new Set(vals.filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b)
  );
}
