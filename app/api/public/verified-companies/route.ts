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

/**
 * Public marketing endpoint — safe profile fields only.
 * Join order first → latest. Includes trust score, OTIFEF, and peer stars
 * (suppliers ↔ customers continuous feedback).
 */
export async function GET() {
  try {
    const supabase = getSupabaseServer();

    type Row = Record<string, unknown>;
    let rows: Row[] = [];

    const full = await supabase
      .from('profiles')
      .select(
        'id, legal_name, trading_name, verification_status, verified_at, business_type, industry, city, country, logo_url, trust_score, otifef_average, created_at'
      )
      .not('trading_name', 'is', null)
      .order('created_at', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .limit(500);

    if (!full.error && full.data) {
      rows = full.data as Row[];
    } else {
      // Retry without optional columns (older DBs)
      const retry = await supabase
        .from('profiles')
        .select(
          'id, legal_name, trading_name, verification_status, business_type, industry, city, country, trust_score, created_at'
        )
        .not('trading_name', 'is', null)
        .order('id', { ascending: true })
        .limit(500);
      if (!retry.error && retry.data) rows = retry.data as Row[];
    }

    rows = rows.filter(
      (p) => String(p.trading_name || p.legal_name || '').trim().length > 1
    );

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
          const role = String(r.ratee_role || '').toLowerCase();
          if (role === 'supplier') addStar(starsAsSupplier, pid, overall);
          if (role === 'customer') addStar(starsAsCustomer, pid, overall);
        }
      }
    }

    // OTIFEF from invoice feedback (customer → seller loop) + profile.otifef_average
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
        city: (p.city as string | null) ?? null,
        country: (p.country as string | null) ?? null,
        logo_url: (p.logo_url as string | null) ?? null,
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

    return NextResponse.json({
      success: true,
      companies,
      pageSize: 9,
      feedbackLoop:
        'Companies are rated by their suppliers and customers — a continuous loop of feedback that helps every business improve.',
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
