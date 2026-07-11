import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import { computeProfileCompleteness } from '@/lib/business/completeness';
import { normalizeProfileRow } from '@/lib/business/types';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * GET ?companyId=&privyUserId= — My Business hub KPIs
 * Profile completeness uses the same shared formula as the dashboard hub card.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();

    const [profileRes, teamRes, riadRes, poRes, docsRes] = await Promise.all([
      // select * so alias columns (street, contact_number, iso_certifications) feed completeness
      supabase.from('profiles').select('*').eq('id', companyId).maybeSingle(),
      supabase
        .from('business_users')
        .select('id, status, role', { count: 'exact' })
        .eq('profile_id', companyId),
      supabase
        .from('riad_logs')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId)
        .in('status', ['open', 'active', 'in_progress', 'on_hold']),
      supabase
        .from('purchase_orders')
        .select('id', { count: 'exact', head: true })
        .eq('buyer_profile_id', companyId),
      // documents may not exist for all tenants
      supabase
        .from('company_documents')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId),
    ]);

    const p = profileRes.data;
    if (profileRes.error || !p) {
      return NextResponse.json({
        success: true,
        summary: emptySummary(),
        warning: profileRes.error?.message || 'Company not found',
      });
    }

    const team = teamRes.data || [];
    const profile = normalizeProfileRow(p as Record<string, unknown>);
    const comp = computeProfileCompleteness(profile as Record<string, unknown>);

    return NextResponse.json({
      success: true,
      summary: {
        trading_name: profile.trading_name || profile.legal_name || 'Your company',
        verification_status:
          profile.verification_status || (profile.is_verified ? 'verified' : 'unverified'),
        is_verified: profile.is_verified === true || profile.verification_status === 'verified',
        is_discoverable: profile.is_discoverable !== false,
        primary_currency: profile.primary_currency || 'ZAR',
        timezone: profile.timezone || 'Africa/Johannesburg',
        teamTotal: teamRes.count ?? team.length,
        teamActive: team.filter((m) => m.status === 'active').length,
        teamInvited: team.filter((m) =>
          ['invited', 'pending'].includes(String(m.status || '').toLowerCase())
        ).length,
        openRiads: riadRes.count || 0,
        purchaseOrders: poRes.error ? 0 : poRes.count || 0,
        documents: docsRes.error ? 0 : docsRes.count || 0,
        profileCompleteness: comp.pct,
        completeness: comp.map,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

function emptySummary() {
  return {
    trading_name: 'Your company',
    verification_status: 'unverified',
    is_verified: false,
    is_discoverable: true,
    primary_currency: 'ZAR',
    timezone: 'Africa/Johannesburg',
    teamTotal: 0,
    teamActive: 0,
    teamInvited: 0,
    openRiads: 0,
    purchaseOrders: 0,
    documents: 0,
    profileCompleteness: 0,
    completeness: {},
  };
}
