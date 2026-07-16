import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { explainTrustComponents } from '@/lib/trust/score-explainer';

/**
 * GET ?companyId= — CSV trust pack (OTIFEF, peer stars, verification, recent ratings)
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data: profile } = await supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, verification_status, trust_score, otifef_average, city, country, industry'
      )
      .eq('id', companyId)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { data: ratings } = await supabase
      .from('company_ratings')
      .select(
        'id, overall, ratee_role, rater_profile_id, quality, delivery, communication, comment, created_at, updated_at'
      )
      .eq('ratee_profile_id', companyId)
      .eq('status', 'published')
      .order('updated_at', { ascending: false })
      .limit(200);

    let starSum = 0;
    let starCount = 0;
    let asSupplier = 0;
    let asCustomer = 0;
    for (const r of ratings || []) {
      const o = Number(r.overall);
      if (!Number.isFinite(o) || o <= 0) continue;
      starSum += o;
      starCount += 1;
      if (String(r.ratee_role) === 'supplier') asSupplier += 1;
      if (String(r.ratee_role) === 'customer') asCustomer += 1;
    }
    const starAvg =
      starCount > 0 ? Math.round((starSum / starCount) * 10) / 10 : null;
    const verified = ['verified', 'approved', 'active_verified', 'complete'].includes(
      String(profile.verification_status || '').toLowerCase()
    );
    const otifef =
      profile.otifef_average != null
        ? Number(profile.otifef_average)
        : null;
    const explained = explainTrustComponents({
      otifef,
      starAvg,
      starCount,
      verified,
      trustScore:
        profile.trust_score != null ? Number(profile.trust_score) : null,
    });

    const stamp = new Date().toISOString().slice(0, 10);
    const lines: string[] = [];
    lines.push('# SupplierAdvisor Trust Pack');
    lines.push(`# Generated,${stamp}`);
    lines.push(
      `company_id,${csv(profile.id)}`,
      `trading_name,${csv(profile.trading_name)}`,
      `legal_name,${csv(profile.legal_name)}`,
      `city,${csv(profile.city)}`,
      `country,${csv(profile.country)}`,
      `industry,${csv(profile.industry)}`,
      `verification_status,${csv(profile.verification_status)}`,
      `verified,${verified ? 'yes' : 'no'}`,
      `otifef_average_pct,${otifef ?? ''}`,
      `peer_star_avg,${starAvg ?? ''}`,
      `peer_star_count,${starCount}`,
      `ratings_as_supplier,${asSupplier}`,
      `ratings_as_customer,${asCustomer}`,
      `stored_trust_score,${profile.trust_score ?? ''}`,
      `computed_trust_score,${explained.computed ?? ''}`,
      `contrib_otifef,${explained.contributions?.otifef ?? ''}`,
      `contrib_peer_stars,${explained.contributions?.peerStars ?? ''}`,
      `contrib_verification,${explained.contributions?.verification ?? ''}`,
      '',
      '# Recent peer ratings (received)',
      'rating_id,overall,ratee_role,rater_profile_id,quality,delivery,communication,comment,updated_at'
    );

    for (const r of ratings || []) {
      lines.push(
        [
          r.id,
          r.overall,
          r.ratee_role,
          r.rater_profile_id,
          r.quality,
          r.delivery,
          r.communication,
          r.comment,
          r.updated_at || r.created_at,
        ]
          .map(csv)
          .join(',')
      );
    }

    const body = lines.join('\n');
    const safeName = String(profile.trading_name || companyId)
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .slice(0, 40);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="trust-pack-${safeName}-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

function csv(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
