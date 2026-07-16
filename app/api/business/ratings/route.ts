import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getCompanyMembership } from '@/lib/business/access';
import { logActivity } from '@/lib/customers/access';
import {
  aggregateRatings,
  clampStar,
  RATEE_ROLES,
  type CompanyRatingRow,
  type RateeRole,
} from '@/lib/ratings/company-rating';
import { computeTrustScore } from '@/lib/suppliers/types';
import { afterPeerRatingPublished } from '@/lib/onboarding/checklist';

/**
 * GET ?companyId=&role=supplier|customer|partner|all&direction=given|received|both
 * Peer star ratings (subjective). OTIFEF is separate (PO objective).
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const role = String(request.nextUrl.searchParams.get('role') || 'all');
    const direction = String(request.nextUrl.searchParams.get('direction') || 'both');

    const supabase = getSupabaseServer();
    let q = supabase
      .from('company_ratings')
      .select('*')
      .eq('status', 'published')
      .order('updated_at', { ascending: false })
      .limit(500);

    if (direction === 'given') {
      q = q.eq('rater_profile_id', companyId);
    } else if (direction === 'received') {
      q = q.eq('ratee_profile_id', companyId);
    } else {
      q = q.or(
        `rater_profile_id.eq.${companyId},ratee_profile_id.eq.${companyId}`
      );
    }
    if (role !== 'all' && RATEE_ROLES.includes(role as RateeRole)) {
      q = q.eq('ratee_role', role);
    }

    const { data, error } = await q;
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          ratings: [],
          given: [],
          received: [],
          aggregates: [],
          warning:
            'company_ratings missing — run supabase/migrations/20260712_company_ratings.sql',
          migration_required: true,
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []) as CompanyRatingRow[];
    const given = rows.filter((r) => Number(r.rater_profile_id) === companyId);
    const received = rows.filter((r) => Number(r.ratee_profile_id) === companyId);

    const peerIds = [
      ...new Set([
        ...given.map((r) => Number(r.ratee_profile_id)),
        ...received.map((r) => Number(r.rater_profile_id)),
      ]),
    ].filter((n) => Number.isFinite(n));

    const nameMap: Record<number, string> = {};
    if (peerIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, trading_name, legal_name')
        .in('id', peerIds);
      for (const p of profiles || []) {
        nameMap[Number(p.id)] =
          (p.trading_name as string) ||
          (p.legal_name as string) ||
          `Company ${p.id}`;
      }
    }

    const givenEnriched = given.map((r) => ({
      ...r,
      ratee_name: nameMap[Number(r.ratee_profile_id)] || null,
    }));
    const receivedEnriched = received.map((r) => ({
      ...r,
      rater_name: nameMap[Number(r.rater_profile_id)] || null,
    }));

    const aggregates = aggregateRatings(given, nameMap);

    const givenAvg =
      given.length > 0
        ? Math.round(
            (given.reduce((s, r) => s + Number(r.overall), 0) / given.length) * 10
          ) / 10
        : null;
    const receivedAvg =
      received.length > 0
        ? Math.round(
            (received.reduce((s, r) => s + Number(r.overall), 0) / received.length) *
              10
          ) / 10
        : null;

    return NextResponse.json({
      success: true,
      ratings: rows,
      given: givenEnriched,
      received: receivedEnriched,
      aggregates,
      summary: {
        givenCount: given.length,
        receivedCount: received.length,
        companiesRated: aggregates.length,
        givenAvg,
        receivedAvg,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * POST — upsert peer star rating
 * body: companyId, rateeProfileId, rateeRole, overall, quality?, delivery?, ...
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const rateeProfileId = Number(
      body.rateeProfileId || body.supplierProfileId || body.customerProfileId
    );
    const overall = clampStar(body.overall ?? body.rating);
    const rateeRole = String(body.rateeRole || body.role || 'supplier') as RateeRole;

    if (!Number.isFinite(companyId) || !Number.isFinite(rateeProfileId)) {
      return NextResponse.json(
        { error: 'companyId and rateeProfileId required' },
        { status: 400 }
      );
    }
    if (companyId === rateeProfileId) {
      return NextResponse.json({ error: 'Cannot rate your own company' }, { status: 400 });
    }
    if (overall == null) {
      return NextResponse.json(
        { error: 'overall must be an integer star rating 1–5' },
        { status: 400 }
      );
    }
    if (!RATEE_ROLES.includes(rateeRole)) {
      return NextResponse.json(
        { error: 'rateeRole must be supplier, customer, or partner' },
        { status: 400 }
      );
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request) || body.privyUserId,
    });
    if (!gate.ok) return gate.response;

    const mem = await getCompanyMembership(gate.userId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const now = new Date().toISOString();
    const row = {
      rater_profile_id: companyId,
      ratee_profile_id: rateeProfileId,
      ratee_role: rateeRole,
      overall,
      quality: clampStar(body.quality),
      delivery: clampStar(body.delivery),
      communication: clampStar(body.communication),
      value: clampStar(body.value),
      payment: clampStar(body.payment),
      reliability: clampStar(body.reliability),
      comment: body.comment != null ? String(body.comment).slice(0, 2000) : null,
      status: 'published',
      created_by: gate.userId,
      updated_at: now,
    };

    const supabase = getSupabaseServer();

    // Upsert by unique pair
    const { data: existing } = await supabase
      .from('company_ratings')
      .select('id')
      .eq('rater_profile_id', companyId)
      .eq('ratee_profile_id', rateeProfileId)
      .eq('ratee_role', rateeRole)
      .eq('status', 'published')
      .maybeSingle();

    let data: Record<string, unknown> | null = null;
    let error: { message: string } | null = null;

    if (existing?.id) {
      const res = await supabase
        .from('company_ratings')
        .update(row)
        .eq('id', existing.id)
        .select('*')
        .single();
      data = res.data;
      error = res.error;
    } else {
      const res = await supabase
        .from('company_ratings')
        .insert({ ...row, created_at: now })
        .select('*')
        .single();
      data = res.data;
      error = res.error;
    }

    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json(
          {
            error: 'company_ratings table missing',
            hint: 'Run supabase/migrations/20260712_company_ratings.sql',
            code: 'MIGRATION_REQUIRED',
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sync aggregates to srm_suppliers when rating a supplier
    if (rateeRole === 'supplier') {
      const { data: allForRatee } = await supabase
        .from('company_ratings')
        .select('overall')
        .eq('rater_profile_id', companyId)
        .eq('ratee_profile_id', rateeProfileId)
        .eq('ratee_role', 'supplier')
        .eq('status', 'published');
      const all = allForRatee || [];
      // also all raters for this ratee as supplier? trust for book is what we gave
      const avg =
        all.length > 0
          ? all.reduce((s, r) => s + Number(r.overall), 0) / all.length
          : overall;
      const trust = computeTrustScore({
        otifef: null,
        ratingAvg: avg,
        verified: null,
      });
      await supabase
        .from('srm_suppliers')
        .update({
          rating_avg: Math.round(avg * 10) / 10,
          rating_count: all.length || 1,
          trust_score: trust,
          updated_at: now,
        })
        .eq('profile_id', companyId)
        .eq('linked_profile_id', rateeProfileId);
    }

    void logActivity({
      profile_id: companyId,
      actor_user_id: gate.userId,
      action: 'rating.company_upsert',
      entity_type: 'company_rating',
      entity_id: String(data?.id || ''),
      summary: `Rated company #${rateeProfileId} as ${rateeRole}: ${overall}★`,
      metadata: { rateeProfileId, rateeRole, overall },
    });

    // Complete rating prompts + golden path rate_partner step
    void afterPeerRatingPublished({
      companyId,
      rateeProfileId,
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      rating: data,
      updated: Boolean(existing?.id),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
