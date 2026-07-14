import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PublicCompany = {
  id: number;
  legal_name: string | null;
  trading_name: string | null;
  verification_status: string | null;
  verified_at: string | null;
  business_type: string | null;
  industry: string | null;
  city: string | null;
  country: string | null;
  logo_url?: string | null;
  trust_score?: number | null;
  star_avg?: number | null;
  star_count?: number;
  badge: 'verified' | 'network';
};

function isVerifiedStatus(status?: string | null): boolean {
  const s = String(status || '').toLowerCase().trim();
  return (
    s === 'verified' ||
    s === 'approved' ||
    s === 'active_verified' ||
    s === 'complete'
  );
}

/**
 * Public marketing endpoint — safe profile fields only.
 * Shows verified + unverified companies that have joined (have a trading name).
 * Includes peer star ratings received and trust score when available.
 */
export async function GET() {
  try {
    const supabase = getSupabaseServer();

    type Row = Record<string, unknown>;
    let rows: Row[] = [];

    // All companies on the platform with a public trading identity
    const full = await supabase
      .from('profiles')
      .select(
        'id, legal_name, trading_name, verification_status, verified_at, business_type, industry, city, country, logo_url, trust_score, created_at'
      )
      .not('trading_name', 'is', null)
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(180);

    if (!full.error && full.data) {
      rows = full.data as Row[];
    } else {
      const retry = await supabase
        .from('profiles')
        .select(
          'id, legal_name, trading_name, verification_status, business_type, industry, city, country, created_at'
        )
        .not('trading_name', 'is', null)
        .order('id', { ascending: false })
        .limit(180);
      if (!retry.error && retry.data) rows = retry.data as Row[];
    }

    // Soft-filter junk / empty names
    rows = rows.filter((p) => String(p.trading_name || p.legal_name || '').trim().length > 1);

    // Sort: verified first, then by trust_score, then recency
    rows.sort((a, b) => {
      const av = isVerifiedStatus(a.verification_status as string) ? 1 : 0;
      const bv = isVerifiedStatus(b.verification_status as string) ? 1 : 0;
      if (bv !== av) return bv - av;
      const at = Number(a.trust_score ?? 0);
      const bt = Number(b.trust_score ?? 0);
      if (bt !== at) return bt - at;
      return Number(b.id) - Number(a.id);
    });

    // Peer star ratings received (ratee = this company)
    const ids = rows.map((p) => Number(p.id)).filter((n) => Number.isFinite(n));
    const starByProfile = new Map<number, { sum: number; count: number }>();

    if (ids.length) {
      const ratingsRes = await supabase
        .from('company_ratings')
        .select('ratee_profile_id, overall, status')
        .in('ratee_profile_id', ids)
        .eq('status', 'published')
        .limit(2000);

      if (!ratingsRes.error && ratingsRes.data) {
        for (const r of ratingsRes.data) {
          const pid = Number(r.ratee_profile_id);
          const overall = Number(r.overall);
          if (!Number.isFinite(pid) || !Number.isFinite(overall) || overall <= 0) {
            continue;
          }
          if (!starByProfile.has(pid)) {
            starByProfile.set(pid, { sum: 0, count: 0 });
          }
          const m = starByProfile.get(pid)!;
          m.sum += overall;
          m.count += 1;
        }
      }
    }

    let companies: PublicCompany[] = rows.map((p) => {
      const id = Number(p.id);
      const verified = isVerifiedStatus(p.verification_status as string);
      const stars = starByProfile.get(id);
      const trustRaw = p.trust_score != null ? Number(p.trust_score) : null;
      return {
        id,
        legal_name: (p.legal_name as string | null) ?? null,
        trading_name: (p.trading_name as string | null) ?? null,
        verification_status: (p.verification_status as string | null) ?? null,
        verified_at: (p.verified_at as string | null) ?? null,
        business_type: (p.business_type as string | null) ?? null,
        industry: (p.industry as string | null) ?? null,
        city: (p.city as string | null) ?? null,
        country: (p.country as string | null) ?? null,
        logo_url: (p.logo_url as string | null) ?? null,
        trust_score:
          trustRaw != null && Number.isFinite(trustRaw)
            ? Math.round(trustRaw * 10) / 10
            : null,
        star_avg:
          stars && stars.count > 0
            ? Math.round((stars.sum / stars.count) * 10) / 10
            : null,
        star_count: stars?.count ?? 0,
        badge: verified ? ('verified' as const) : ('network' as const),
      };
    });

    // Deduplicate by trading name
    const seen = new Set<string>();
    companies = companies.filter((c) => {
      const key = (c.trading_name || c.legal_name || String(c.id)).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const verifiedCount = companies.filter((c) => c.badge === 'verified').length;
    const networkCount = companies.filter((c) => c.badge === 'network').length;

    let platformTotal = companies.length;
    const { count: profileCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('trading_name', 'is', null);
    if (typeof profileCount === 'number' && profileCount > 0) {
      platformTotal = profileCount;
    }

    // Full list for client pagination (homepage shows 9 per page)
    const PAGE_SIZE = 9;
    return NextResponse.json({
      success: true,
      companies,
      pageSize: PAGE_SIZE,
      counts: {
        shown: companies.length,
        verified: verifiedCount,
        network: networkCount,
        total: companies.length,
        platformTotal,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        success: false,
        companies: [],
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
