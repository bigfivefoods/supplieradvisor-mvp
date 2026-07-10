import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import type { DiscoverSupplier } from '@/lib/suppliers/types';

/**
 * Deep metadata marketplace search across platform profiles.
 * GET ?companyId=&q=&country=&industry=&cert=&verified=&otifefMin=&trustMin=&continent=&province=&bee=
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
    const limit = Math.min(200, Number(sp.get('limit') || 80));

    const supabase = getSupabaseServer();

    // Prefer discoverable businesses; include relationship_type supplier OR any company with supplier signals
    let query = supabase
      .from('profiles')
      .select(
        `id, trading_name, legal_name, email, industry, sub_industry, category,
         city, province, country, continent, certifications, trust_score, otifef_average,
         bee_level, verification_status, is_verified, wallet_address, website, public_id,
         relationship_type, is_discoverable`
      )
      .order('trust_score', { ascending: false, nullsFirst: false })
      .limit(400);

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

    let rows = (data || []) as DiscoverSupplier[];

    // Prefer suppliers / businesses that look like supply-side
    rows = rows.filter((r) => {
      const rt = String(r.relationship_type || '').toLowerCase();
      if (rt === 'supplier' || rt === 'business' || rt === 'both' || !rt) return true;
      // still allow if they have certs or wallet (real suppliers on platform)
      if ((r.certifications && r.certifications.length) || r.wallet_address) return true;
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

    // Annotate with my-book / connection
    let inBook = new Set<number>();
    let connected = new Set<number>();
    if (companyId && Number.isFinite(companyId)) {
      const [{ data: book }, { data: conns }] = await Promise.all([
        supabase
          .from('srm_suppliers')
          .select('id, linked_profile_id')
          .eq('profile_id', companyId)
          .not('linked_profile_id', 'is', null),
        supabase
          .from('business_connections')
          .select('requestee_profile_id, status')
          .eq('requester_profile_id', companyId)
          .eq('connection_type', 'supplier')
          .eq('status', 'accepted'),
      ]);
      const bookMap = new Map<number, number>();
      for (const b of book || []) {
        if (b.linked_profile_id) {
          inBook.add(Number(b.linked_profile_id));
          bookMap.set(Number(b.linked_profile_id), Number(b.id));
        }
      }
      for (const c of conns || []) {
        connected.add(Number(c.requestee_profile_id));
      }
      rows = rows.map((r) => ({
        ...r,
        in_my_book: inBook.has(Number(r.id)),
        already_connected: connected.has(Number(r.id)),
        srm_supplier_id: bookMap.get(Number(r.id)) || null,
        verified:
          r.is_verified === true ||
          r.verification_status === 'verified' ||
          r.verified === true,
      }));
    }

    // Facets for UI filters
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
