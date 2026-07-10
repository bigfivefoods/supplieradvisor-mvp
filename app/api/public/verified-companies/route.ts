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
  badge: 'verified' | 'network';
};

/**
 * Public marketing endpoint — safe profile fields only.
 * Prefers verified companies; falls back to active trading names so the
 * homepage trust section never looks empty.
 */
export async function GET() {
  try {
    const supabase = getSupabaseServer();

    // Prefer verified rows (handle common status spellings)
    type Row = Record<string, unknown>;
    let rows: Row[] = [];

    const full = await supabase
      .from('profiles')
      .select(
        'id, legal_name, trading_name, verification_status, verified_at, business_type, industry, city, country, logo_url'
      )
      .in('verification_status', ['verified', 'Verified', 'approved', 'active_verified'])
      .order('verified_at', { ascending: false, nullsFirst: false })
      .limit(12);

    if (!full.error && full.data) {
      rows = full.data as Row[];
    } else {
      // Retry without optional columns if schema differs
      const retry = await supabase
        .from('profiles')
        .select(
          'id, legal_name, trading_name, verification_status, business_type, industry, city, country'
        )
        .in('verification_status', ['verified', 'Verified', 'approved'])
        .limit(12);
      if (!retry.error && retry.data) rows = retry.data as Row[];
    }

    let companies: PublicCompany[] = rows
      .filter((p) => p.trading_name || p.legal_name)
      .map((p) => ({
        id: Number(p.id),
        legal_name: (p.legal_name as string | null) ?? null,
        trading_name: (p.trading_name as string | null) ?? null,
        verification_status: (p.verification_status as string | null) ?? null,
        verified_at: (p.verified_at as string | null) ?? null,
        business_type: (p.business_type as string | null) ?? null,
        industry: (p.industry as string | null) ?? null,
        city: (p.city as string | null) ?? null,
        country: (p.country as string | null) ?? null,
        logo_url: (p.logo_url as string | null) ?? null,
        badge: 'verified' as const,
      }));

    // Soft fallback: show active companies on the platform (not claimed as fully verified)
    if (companies.length === 0) {
      const { data: network } = await supabase
        .from('profiles')
        .select('id, legal_name, trading_name, verification_status, business_type, industry, city, country')
        .not('trading_name', 'is', null)
        .order('id', { ascending: false })
        .limit(9);

      companies = (network || [])
        .filter((p) => String(p.trading_name || '').trim().length > 1)
        .map((p) => ({
          id: Number(p.id),
          legal_name: p.legal_name ?? null,
          trading_name: p.trading_name ?? null,
          verification_status: p.verification_status ?? null,
          verified_at: null,
          business_type: p.business_type ?? null,
          industry: p.industry ?? null,
          city: p.city ?? null,
          country: p.country ?? null,
          logo_url: null,
          badge:
            String(p.verification_status || '').toLowerCase() === 'verified'
              ? ('verified' as const)
              : ('network' as const),
        }));
    }

    // Deduplicate by trading name
    const seen = new Set<string>();
    companies = companies.filter((c) => {
      const key = (c.trading_name || c.legal_name || String(c.id)).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const verifiedCount = companies.filter((c) => c.badge === 'verified').length;

    return NextResponse.json({
      success: true,
      companies: companies.slice(0, 9),
      counts: {
        shown: Math.min(9, companies.length),
        verified: verifiedCount,
        total: companies.length,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        success: false,
        companies: [],
        counts: { shown: 0, verified: 0, total: 0 },
        error: e instanceof Error ? e.message : 'Error',
      },
      { status: 200 }
    );
  }
}
