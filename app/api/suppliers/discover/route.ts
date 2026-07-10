import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import type { DiscoverSupplier } from '@/lib/suppliers/types';

/**
 * Deep metadata marketplace search across platform profiles.
 * GET ?companyId=&q=&country=&industry=&cert=&verified=&otifefMin=&trustMin=&continent=&province=&bee=
 *
 * Lists ALL registered businesses on SupplierAdvisor (except the caller's own company).
 * Multi-company owners see their other entities — required for network trade.
 *
 * Note: production `profiles` uses verification_status (not is_verified). Selecting a
 * missing column made Supabase return an error and the UI showed zero companies.
 */
const DISCOVER_SELECT =
  `id, trading_name, legal_name, email, industry, sub_industry, category,
   city, province, country, continent, certifications, trust_score, otifef_average,
   bee_level, verification_status, wallet_address, website, public_id,
   relationship_type, is_discoverable, is_supplier, is_buyer, supplier_status,
   claimed_at, created_at, logo_url, status`;

const DISCOVER_SELECT_MINIMAL =
  `id, trading_name, legal_name, email, industry, category,
   city, country, certifications, trust_score,
   verification_status, wallet_address, website, public_id,
   relationship_type, supplier_status, created_at`;

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = sp.get('companyId') ? Number(sp.get('companyId')) : null;
    const q = (sp.get('q') || '').trim().toLowerCase();
    const country = sp.get('country') || '';
    const continent = sp.get('continent') || '';
    const province = sp.get('province') || '';
    const industry = sp.get('industry') || '';
    const subIndustry = sp.get('sub_industry') || '';
    const bee = sp.get('bee') || '';
    const cert = sp.get('cert') || ''; // comma-separated, AND match
    const verifiedOnly = sp.get('verified') === '1' || sp.get('verified') === 'true';
    const trustMin = Number(sp.get('trustMin') || 0);
    const otifefMin = Number(sp.get('otifefMin') || 0);
    const includeHidden = sp.get('includeHidden') === '1';
    const limit = Math.min(500, Number(sp.get('limit') || 200));

    const supabase = getSupabaseServer();

    // Prefer full select; fall back if optional columns missing in older schemas
    let rows: Array<
      DiscoverSupplier & {
        supplier_status?: string | null;
        claimed_at?: string | null;
        is_discoverable?: boolean | null;
        is_supplier?: boolean | null;
        is_buyer?: boolean | null;
        status?: string | null;
      }
    > = [];
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
        rows = (data || []) as unknown as typeof rows;
        break;
      }
      selectWarning = error.message;
      console.warn('discover select failed, retrying minimal:', error.message);
    }

    if (!rows.length && selectWarning) {
      // Last resort: absolute minimal so the page never shows zero due to schema drift
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
      rows = (data || []) as unknown as typeof rows;
    }

    // Profiles that have at least one active team membership = fully registered businesses
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

    // Keep every real business on the platform.
    // Drop only incomplete invite shells with no owner membership and never claimed.
    rows = rows.filter((r) => {
      const name = String(r.trading_name || r.legal_name || '').trim();
      if (!name) return false;

      const id = Number(r.id);
      if (registeredIds.has(id)) return true;

      const status = String(r.supplier_status || r.status || '').toLowerCase();
      // Unclaimed invite stubs (no membership) stay out of marketplace noise
      if ((status === 'invited' || status === 'pending') && !r.claimed_at) {
        return false;
      }
      // Everything else with a name is a platform company
      return true;
    });

    // Discoverability opt-out only (null/undefined/true = visible)
    if (!includeHidden) {
      rows = rows.filter((r) => r.is_discoverable !== false);
    }

    // Optional user filters (off by default so all companies show)
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
          ...(r.certifications || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    if (country) rows = rows.filter((r) => r.country === country);
    if (continent) rows = rows.filter((r) => r.continent === continent);
    if (province) rows = rows.filter((r) => r.province === province);
    if (industry) rows = rows.filter((r) => r.industry === industry);
    if (subIndustry) rows = rows.filter((r) => r.sub_industry === subIndustry);
    if (bee) rows = rows.filter((r) => r.bee_level === bee);
    if (verifiedOnly) {
      rows = rows.filter(
        (r) =>
          String(r.verification_status || '').toLowerCase() === 'verified' ||
          r.verified === true
      );
    }
    if (trustMin > 0) {
      rows = rows.filter((r) => Number(r.trust_score || 0) >= trustMin);
    }
    if (otifefMin > 0) {
      rows = rows.filter((r) => Number(r.otifef_average || 0) >= otifefMin);
    }
    if (certsWanted.length) {
      rows = rows.filter((r) => {
        const have = (r.certifications || []).map((c) => String(c).toLowerCase());
        return certsWanted.every((c) => have.includes(c.toLowerCase()));
      });
    }

    // Annotate with my-book / connection (either direction)
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

    // Prefer registered (membership) companies first, then by name
    rows.sort((a, b) => {
      const aReg = registeredIds.has(Number(a.id)) ? 0 : 1;
      const bReg = registeredIds.has(Number(b.id)) ? 0 : 1;
      if (aReg !== bReg) return aReg - bReg;
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

    // Facets for UI filters (from filtered set before limit)
    const facets = {
      countries: uniqueSorted(enriched.map((r) => r.country)),
      continents: uniqueSorted(enriched.map((r) => r.continent)),
      provinces: uniqueSorted(enriched.map((r) => r.province)),
      industries: uniqueSorted(enriched.map((r) => r.industry)),
      certifications: uniqueSorted(enriched.flatMap((r) => r.certifications || [])),
      beeLevels: uniqueSorted(enriched.map((r) => r.bee_level)),
    };

    return NextResponse.json({
      success: true,
      suppliers: enriched.slice(0, limit),
      total: enriched.length,
      facets,
      platform_company_count: registeredIds.size,
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
