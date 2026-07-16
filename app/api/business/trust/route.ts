import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { explainTrustComponents, TRUST_PUBLIC_COPY } from '@/lib/trust/score-explainer';

function isVerifiedStatus(status?: string | null): boolean {
  const s = String(status || '').toLowerCase();
  return (
    s === 'verified' ||
    s === 'approved' ||
    s === 'active_verified' ||
    s === 'complete'
  );
}

/**
 * GET ?companyId= — trust score breakdown + how to improve
 * Public-safe explainer when ?public=1&profileId=
 */
export async function GET(request: NextRequest) {
  try {
    const publicMode = request.nextUrl.searchParams.get('public') === '1';
    const companyId = Number(
      request.nextUrl.searchParams.get('companyId') ||
        request.nextUrl.searchParams.get('profileId')
    );
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json(
        { error: 'companyId or profileId required' },
        { status: 400 }
      );
    }

    if (!publicMode) {
      const gate = await requireCompanyAccess(request, companyId, {
        legacyPrivyUserId: legacyPrivyFrom(request),
      });
      if (!gate.ok) return gate.response;
    }

    const supabase = getSupabaseServer();
    const { data: profile } = await supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, verification_status, trust_score, otifef_average'
      )
      .eq('id', companyId)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { data: ratings } = await supabase
      .from('company_ratings')
      .select('overall, ratee_role')
      .eq('ratee_profile_id', companyId)
      .eq('status', 'published')
      .limit(500);

    let starSum = 0;
    let starCount = 0;
    let asSupplier = 0;
    let asCustomer = 0;
    for (const r of ratings || []) {
      const o = Number(r.overall);
      if (!Number.isFinite(o) || o <= 0) continue;
      starSum += o;
      starCount += 1;
      const role = String(r.ratee_role || '');
      if (role === 'supplier') asSupplier += 1;
      if (role === 'customer') asCustomer += 1;
    }
    const starAvg = starCount > 0 ? Math.round((starSum / starCount) * 10) / 10 : null;

    const verified = isVerifiedStatus(profile.verification_status);

    const explainer = explainTrustComponents({
      otifef: profile.otifef_average != null ? Number(profile.otifef_average) : null,
      starAvg,
      starCount,
      verified,
      trustScore:
        profile.trust_score != null ? Number(profile.trust_score) : null,
    });

    return NextResponse.json({
      success: true,
      companyId,
      name: profile.trading_name || profile.legal_name,
      publicCopy: TRUST_PUBLIC_COPY,
      peerBreakdown: {
        asSupplierRatings: asSupplier,
        asCustomerRatings: asCustomer,
        total: starCount,
      },
      ...explainer,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
