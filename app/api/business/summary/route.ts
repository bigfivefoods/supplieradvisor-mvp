import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';

/**
 * GET ?companyId=&privyUserId= — My Business hub KPIs
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertCompanyMember(privyUserId, companyId);
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();

    const [profileRes, teamRes, riadRes, poRes, docsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'id, trading_name, legal_name, email, contact_name, contact_phone, phone, website, industry, country, city, address, registration_number, vat_number, certifications, verification_status, is_verified, is_discoverable, wallet_address, primary_currency, timezone, settings'
        )
        .eq('id', companyId)
        .maybeSingle(),
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
    const completeness = {
      trading_name: !!p.trading_name,
      legal_name: !!p.legal_name,
      email: !!p.email,
      contact: !!(p.contact_name || p.contact_phone || p.phone),
      industry: !!p.industry,
      location: !!(p.country && p.city),
      address: !!p.address,
      registration: !!(p.registration_number || p.vat_number),
      certs: Array.isArray(p.certifications) && p.certifications.length > 0,
      wallet: !!p.wallet_address,
    };
    const done = Object.values(completeness).filter(Boolean).length;
    const total = Object.keys(completeness).length;

    return NextResponse.json({
      success: true,
      summary: {
        trading_name: p.trading_name || p.legal_name || 'Your company',
        verification_status: p.verification_status || (p.is_verified ? 'verified' : 'unverified'),
        is_verified: p.is_verified === true || p.verification_status === 'verified',
        is_discoverable: p.is_discoverable !== false,
        primary_currency: p.primary_currency || 'ZAR',
        timezone: p.timezone || 'Africa/Johannesburg',
        teamTotal: teamRes.count ?? team.length,
        teamActive: team.filter((m) => m.status === 'active').length,
        teamInvited: team.filter((m) =>
          ['invited', 'pending'].includes(String(m.status || '').toLowerCase())
        ).length,
        openRiads: riadRes.count || 0,
        purchaseOrders: poRes.error ? 0 : poRes.count || 0,
        documents: docsRes.error ? 0 : docsRes.count || 0,
        profileCompleteness: Math.round((done / total) * 100),
        completeness,
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
