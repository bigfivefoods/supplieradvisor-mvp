import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import { resolveCatalogueContext } from '@/lib/schools/approved-catalogue';
import {
  computeClaimAmount,
  countWeekdays,
} from '@/lib/schools/process';
import {
  applyApprovedProductClaimIncentive,
  CLAIM_APPROVED_MIN_PCT,
  SCHOOL_APPROVED_INCENTIVE_COPY,
} from '@/lib/schools/incentives';

/**
 * W2 claim / funding pack: cost per meal, days fed, claim CSV payload.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const to = sp.get('to') || new Date().toISOString().slice(0, 10);
    const fromDefault = new Date();
    fromDefault.setMonth(fromDefault.getMonth() - 1);
    const from = sp.get('from') || fromDefault.toISOString().slice(0, 10);

    const supabase = getSupabaseServer();
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }
    const schoolId = Number(school.id);
    const catalogue = await resolveCatalogueContext(supabase, companyId, {
      schoolProfileId: schoolId,
    });

    const [feedingRes, ordersRes, receiptsRes, savedRes] = await Promise.all([
      supabase
        .from('school_feeding_days')
        .select('*')
        .eq('school_profile_id', schoolId)
        .gte('feed_date', from)
        .lte('feed_date', to)
        .limit(500),
      supabase
        .from('school_purchase_orders')
        .select('total_amount, order_date, status, compliance_ok')
        .eq('school_profile_id', schoolId)
        .gte('order_date', from)
        .lte('order_date', to)
        .limit(500),
      supabase
        .from('school_kitchen_receipts')
        .select('compliance_ok, lines, received_at')
        .eq('school_profile_id', schoolId)
        .gte('received_at', from)
        .lte('received_at', to)
        .limit(500),
      supabase
        .from('nsnp_claim_packs')
        .select('*')
        .eq('school_profile_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const feeding = feedingRes.data || [];
    const orders = ordersRes.data || [];
    const receipts = receiptsRes.data || [];

    const daysFed = new Set(feeding.map((f) => String(f.feed_date))).size;
    const mealsServed = feeding.reduce(
      (n, f) => n + Number(f.served_meals || 0),
      0
    );
    const presentSum = feeding.reduce(
      (n, f) => n + Number(f.learners_present || 0),
      0
    );
    const avgPresent =
      feeding.length > 0
        ? Math.round((presentSum / feeding.length) * 100) / 100
        : 0;

    const foodSpend = orders.reduce(
      (n, o) => n + Number(o.total_amount || 0),
      0
    );
    const costFromFeed = feeding.reduce(
      (n, f) => n + Number((f as { cost_amount?: number }).cost_amount || 0),
      0
    );
    const spend = costFromFeed > 0 ? costFromFeed : foodSpend;
    const costPerMeal =
      mealsServed > 0 ? Math.round((spend / mealsServed) * 10000) / 10000 : 0;

    let approvedLines = 0;
    let totalLines = 0;
    for (const r of receipts) {
      for (const line of (Array.isArray(r.lines) ? r.lines : []) as Array<{
        approved?: boolean;
      }>) {
        totalLines += 1;
        if (line.approved !== false) approvedLines += 1;
      }
    }
    const approvedBrandPct =
      totalLines > 0
        ? Math.round((approvedLines / totalLines) * 1000) / 10
        : 100;

    const nutritionPassDays = feeding.filter(
      (f) => (f as { nutrition_pass?: boolean }).nutrition_pass === true
    ).length;
    const nutritionPassPct =
      feeding.length > 0
        ? Math.round((nutritionPassDays / feeding.length) * 1000) / 10
        : null;

    // School days = weekdays in range (honest claim completeness)
    const schoolDays = countWeekdays(from, to);
    const feedingCompletenessPct =
      schoolDays > 0
        ? Math.min(100, Math.round((daysFed / schoolDays) * 1000) / 10)
        : 0;

    // Funding model: agency meal tariff (preferred) → school meta → default
    const schoolMeta =
      school.metadata && typeof school.metadata === 'object'
        ? (school.metadata as Record<string, unknown>)
        : {};
    let agencyTariff: number | null = null;
    let agencyClaimsLocked = false;
    let periodLocked = false;
    if (catalogue.agencyProfileId) {
      const { data: ag } = await supabase
        .from('nsnp_agency_profiles')
        .select(
          'meal_tariff_zar, meal_tariff_lunch_zar, claims_locked, profile_id'
        )
        .eq('profile_id', catalogue.agencyProfileId)
        .maybeSingle();
      if (ag) {
        agencyTariff =
          Number(ag.meal_tariff_lunch_zar) > 0
            ? Number(ag.meal_tariff_lunch_zar)
            : Number(ag.meal_tariff_zar) > 0
              ? Number(ag.meal_tariff_zar)
              : null;
        agencyClaimsLocked = ag.claims_locked === true;
      }
      const { data: lock } = await supabase
        .from('nsnp_claim_period_locks')
        .select('id, locked')
        .eq('agency_profile_id', catalogue.agencyProfileId)
        .eq('period_from', from)
        .eq('period_to', to)
        .eq('locked', true)
        .maybeSingle();
      periodLocked = Boolean(lock);
    }
    const schoolTariff =
      Number(schoolMeta.nsnp_meal_tariff_zar) > 0
        ? Number(schoolMeta.nsnp_meal_tariff_zar)
        : null;
    const tariff = agencyTariff ?? schoolTariff;
    const claim = computeClaimAmount({
      mealsServed,
      foodSpend: spend,
      tariffZar: tariff,
    });

    // Funding incentive: only full claim when kitchen buys approved products
    const approvedIncentive = applyApprovedProductClaimIncentive({
      claimAmount: claim.claimAmount,
      approvedBrandPct,
    });

    // Require agency link for full claim eligibility
    const { data: agencyLink } = await supabase
      .from('school_agency_links')
      .select('id, status')
      .eq('school_profile_id', schoolId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    const approvedBlocked = Boolean(approvedIncentive.block_reason);
    const submitBlock =
      periodLocked
        ? 'Agency locked this claim period'
        : agencyClaimsLocked
          ? 'Agency has claims locked'
          : !agencyLink
            ? 'Need active DBE/PEU/DoH association'
            : mealsServed <= 0
              ? 'No meals served in period'
              : approvedBlocked
                ? approvedIncentive.block_reason
                : approvedBrandPct < CLAIM_APPROVED_MIN_PCT
                  ? `Approved foods ${approvedBrandPct}% — need ≥${CLAIM_APPROVED_MIN_PCT}% for full claim submit (order only from department list)`
                  : null;

    const pack = {
      school_name: school.school_name,
      emis: school.emis_number,
      province: school.province,
      district: school.district,
      period: { from, to },
      school_days: schoolDays,
      days_fed: daysFed,
      meals_served: mealsServed,
      learners_avg_present: avgPresent,
      food_spend: Math.round(spend * 100) / 100,
      cost_per_meal: costPerMeal,
      approved_brand_pct: approvedBrandPct,
      nutrition_pass_pct: nutritionPassPct,
      feeding_completeness_pct: feedingCompletenessPct,
      agency: catalogue.agencyName,
      agency_linked: Boolean(agencyLink),
      claim_amount: approvedIncentive.claim_amount,
      claim_amount_full: approvedIncentive.claim_amount_full,
      claim_clawback_pct: approvedIncentive.clawback_pct,
      claim_eligible_full: approvedIncentive.eligible_full,
      claim_tariff_zar: claim.tariff,
      claim_method: claim.method,
      cost_evidence: claim.costEvidence,
      period_locked: periodLocked || agencyClaimsLocked,
      approved_min_pct: CLAIM_APPROVED_MIN_PCT,
      incentive_note: approvedIncentive.incentive_note,
      policy: SCHOOL_APPROVED_INCENTIVE_COPY,
      submit_ready:
        Boolean(agencyLink) &&
        mealsServed > 0 &&
        daysFed > 0 &&
        !periodLocked &&
        !agencyClaimsLocked &&
        approvedBrandPct >= CLAIM_APPROVED_MIN_PCT &&
        !approvedBlocked,
      submit_block_reason: submitBlock,
    };

    return NextResponse.json({
      success: true,
      pack,
      history: savedRes.data || [],
      warning: savedRes.error?.message,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    // Rebuild pack then save
    const from = body.from;
    const to = body.to;
    const url = new URL(request.url);
    url.searchParams.set('companyId', String(companyId));
    if (from) url.searchParams.set('from', from);
    if (to) url.searchParams.set('to', to);

    // Inline recompute (avoid internal fetch)
    const supabase = getSupabaseServer();
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }

    const getRes = await GET(
      new NextRequest(
        `${request.nextUrl.origin}/api/schools/claims?companyId=${companyId}&from=${from || ''}&to=${to || ''}`,
        { headers: request.headers }
      )
    );
    const json = await getRes.json();
    if (!getRes.ok) {
      return NextResponse.json(json, { status: getRes.status });
    }
    const pack = json.pack as Record<string, unknown>;

    if (pack.submit_ready === false) {
      return NextResponse.json(
        {
          error:
            String(pack.submit_block_reason) ||
            'Claim not ready — need active DBE/PEU association and at least one feeding day with meals served',
          pack,
        },
        { status: 400 }
      );
    }

    const catalogue = await resolveCatalogueContext(supabase, companyId, {
      schoolProfileId: Number(school.id),
    });

    const auditEntry = {
      at: new Date().toISOString(),
      by: gate.userId || null,
      action: 'submitted',
      note: 'School submitted claim pack',
    };

    const { data, error: iErr } = await supabase
      .from('nsnp_claim_packs')
      .insert({
        school_profile_id: school.id,
        profile_id: companyId,
        agency_profile_id: catalogue.agencyProfileId,
        period_from: (pack.period as { from: string }).from,
        period_to: (pack.period as { to: string }).to,
        school_days: pack.school_days,
        days_fed: pack.days_fed,
        meals_served: pack.meals_served,
        learners_avg_present: pack.learners_avg_present,
        food_spend: pack.food_spend,
        cost_per_meal: pack.cost_per_meal,
        claim_amount: pack.claim_amount,
        nutrition_pass_pct: pack.nutrition_pass_pct,
        approved_brand_pct: pack.approved_brand_pct,
        status: body.status || 'submitted',
        pack_json: pack,
        tariff_zar: pack.claim_tariff_zar,
        audit_log: [auditEntry],
        created_by: gate.userId || null,
      })
      .select('*')
      .single();

    if (iErr) {
      return NextResponse.json({ error: iErr.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, claim: data, pack });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
