import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import type { DiscoverSupplier } from '@/lib/suppliers/types';

/**
 * Deep metadata marketplace search across platform profiles.
 * GET ?companyId=&q=&country=&industry=&cert=&verified=&otifefMin=&trustMin=&continent=&province=&bee=
 *
 * Shows all discoverable platform companies except the caller's own profile.
 * Multi-company owners will see their other companies — required for network trade.
 */
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
    const limit = Math.min(200, Number(sp.get('limit') || 80));

    const supabase = getSupabaseServer();

    // Load a wide pool of platform companies; filter in-memory for soft fields
    let query = supabase
      .from('profiles')
      .select(
        `id, trading_name, legal_name, email, industry, sub_industry, category,
         city, province, country, continent, certifications, trust_score, otifef_average,
         bee_level, verification_status, is_verified, wallet_address, website, public_id,
         relationship_type, is_discoverable, supplier_status, claimed_at, created_at`
      )
      .order('trust_score', { ascending: false, nullsFirst: false })
      .limit(800);

    // Soft filter: not our own company
    if (companyId && Number.isFinite(companyId)) {
      query = query.neq('id', companyId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({
        success: true,
        suppliers: [],
        warning: error.message,
      });
    }

    const certsWanted = cert
      ? cert.split(',').map((c) => c.trim()).filter(Boolean)
      : [];

    let rows = (data || []) as Array<
      DiscoverSupplier & {
        supplier_status?: string | null;
        claimed_at?: string | null;
        is_discoverable?: boolean | null;
      }
    >;

    // Exclude incomplete invite stubs (never claimed, status still invited)
    rows = rows.filter((r) => {
      const status = String(r.supplier_status || '').toLowerCase();
      if (status === 'invited' && !r.claimed_at) return false;
      // Must have a display name
      if (!r.trading_name && !r.legal_name) return false;
      return true;
    });

    // Discoverability: default on (null/undefined/true). Opt-out with false.
    if (!includeHidden) {
      rows = rows.filter((r) => r.is_discoverable !== false);
    }

    // Include any real business entity — buyers, suppliers, both, partners.
    // Only drop pure contractor/internal stubs with no commercial signal.
    rows = rows.filter((r) => {
      const rt = String(r.relationship_type || '').toLowerCase();
      if (
        !rt ||
        rt === 'supplier' ||
        rt === 'business' ||
        rt === 'both' ||
        rt === 'buyer' ||
        rt === 'customer' ||
        rt === 'partner' ||
        rt === 'manufacturer' ||
        rt === 'distributor' ||
        rt === 'retailer'
      ) {
        return true;
      }
      // Still allow if they look like a commercial counterparty
      if ((r.certifications && r.certifications.length) || r.wallet_address) return true;
      if (r.industry || r.city || r.country) return true;
      return false;
    });

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
          r.is_verified === true ||
          r.verification_status === 'verified' ||
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

      rows = rows.map((r) => ({
        ...r,
        in_my_book: bookMap.has(Number(r.id)),
        already_connected: connected.has(Number(r.id)),
        connection_pending_out: pendingOut.has(Number(r.id)),
        connection_pending_in: pendingIn.has(Number(r.id)),
        srm_supplier_id: bookMap.get(Number(r.id)) || null,
        verified:
          r.is_verified === true ||
          r.verification_status === 'verified' ||
          r.verified === true,
      }));
    }

    // Facets for UI filters (from filtered set before limit)
    const facets = {
      countries: uniqueSorted(rows.map((r) => r.country)),
      continents: uniqueSorted(rows.map((r) => r.continent)),
      provinces: uniqueSorted(rows.map((r) => r.province)),
      industries: uniqueSorted(rows.map((r) => r.industry)),
      certifications: uniqueSorted(rows.flatMap((r) => r.certifications || [])),
      beeLevels: uniqueSorted(rows.map((r) => r.bee_level)),
    };

    return NextResponse.json({
      success: true,
      suppliers: rows.slice(0, limit),
      total: rows.length,
      facets,
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
