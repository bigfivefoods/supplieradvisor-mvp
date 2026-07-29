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
import {
  claimReviewUrl,
  generateClaimApprovalToken,
  sendDbeClaimSubmittedEmail,
} from '@/lib/schools/claim-dbe-email';

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
            ? 'Need active DBE/PEU association'
            : mealsServed <= 0
              ? 'No meals served in period'
              : approvedBlocked
                ? approvedIncentive.block_reason
                : approvedBrandPct < CLAIM_APPROVED_MIN_PCT
                  ? `Approved foods ${approvedBrandPct}% — need ≥${CLAIM_APPROVED_MIN_PCT}% for full claim submit (order only from department list)`
                  : null;

    // Priority 3 — three-way match cleanliness for one-click claim
    let matchSummary: {
      pos: number;
      matched: number;
      partial: number;
      gaps: number;
      funding_path_ready: boolean;
      clean: boolean;
    } | null = null;
    try {
      const { data: posMatch } = await supabase
        .from('school_purchase_orders')
        .select('id')
        .eq('school_profile_id', schoolId)
        .gte('order_date', from)
        .lte('order_date', to)
        .limit(100);
      const poIds = (posMatch || []).map((p) => Number(p.id));
      let matched = 0;
      let partial = 0;
      let gaps = 0;
      if (poIds.length) {
        const { data: dels } = await supabase
          .from('school_nsnp_deliveries')
          .select('id, po_id, status, metadata')
          .eq('school_profile_id', schoolId)
          .in('po_id', poIds.slice(0, 100))
          .limit(100);
        const { data: grns } = await supabase
          .from('school_kitchen_receipts')
          .select('id, po_id, compliance_ok')
          .eq('school_profile_id', schoolId)
          .in('po_id', poIds.slice(0, 100))
          .limit(100);
        const delByPo = new Map<
          number,
          { metadata?: unknown; status?: string }
        >();
        for (const d of dels || []) {
          if (d.po_id) {
            delByPo.set(Number(d.po_id), {
              metadata: d.metadata,
              status: d.status != null ? String(d.status) : undefined,
            });
          }
        }
        const grnByPo = new Map<number, { compliance_ok?: boolean | null }>();
        for (const g of grns || []) {
          if (g.po_id) {
            grnByPo.set(Number(g.po_id), {
              compliance_ok: g.compliance_ok as boolean | null | undefined,
            });
          }
        }
        for (const id of poIds) {
          const d = delByPo.get(id);
          const g = grnByPo.get(id);
          const hasPod = Boolean(
            (d?.metadata as { has_pod_photo?: boolean } | undefined)
              ?.has_pod_photo
          );
          const dnOk = Boolean(d);
          const grnOk = Boolean(g);
          const grnClean = g ? g.compliance_ok !== false : false;
          const score =
            (dnOk ? 1 : 0) +
            (hasPod ? 1 : 0) +
            (grnOk ? 1 : 0) +
            (grnClean ? 1 : 0);
          if (score >= 4) matched += 1;
          else if (score >= 2) partial += 1;
          else gaps += 1;
        }
      }
      const clean =
        poIds.length === 0
          ? true
          : matched === poIds.length && gaps === 0;
      matchSummary = {
        pos: poIds.length,
        matched,
        partial,
        gaps,
        funding_path_ready: clean && daysFed > 0 && mealsServed > 0,
        clean,
      };
    } catch {
      matchSummary = null;
    }

    const baseSubmitReady =
      Boolean(agencyLink) &&
      mealsServed > 0 &&
      daysFed > 0 &&
      !periodLocked &&
      !agencyClaimsLocked &&
      approvedBrandPct >= CLAIM_APPROVED_MIN_PCT &&
      !approvedBlocked;

    const matchBlocks =
      matchSummary &&
      matchSummary.pos > 0 &&
      !matchSummary.clean
        ? `Three-way match not clean (${matchSummary.matched}/${matchSummary.pos} matched, ${matchSummary.gaps} gap(s)) — fix POD/GRN first`
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
      match: matchSummary,
      match_clean: matchSummary?.clean ?? null,
      one_click_ready: baseSubmitReady && (matchSummary?.clean !== false),
      submit_ready: baseSubmitReady && !matchBlocks,
      submit_block_reason: submitBlock || matchBlocks,
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
    const action = String(body.action || 'submit').toLowerCase();
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

    // Priority 3 — one-click from clean match still requires declaration
    const oneClick =
      action === 'one_click' ||
      action === 'submit_from_match' ||
      body.one_click === true;

    // Auto draft claim when match clean (no declaration yet — principal signs later)
    if (action === 'draft_from_match' || action === 'auto_draft') {
      if (!pack.one_click_ready && pack.submit_ready === false) {
        return NextResponse.json(
          {
            error:
              String(pack.submit_block_reason) ||
              'Cannot draft claim — fix match, feed days, or approved brands first',
            pack,
          },
          { status: 400 }
        );
      }
      const catalogueDraft = await resolveCatalogueContext(supabase, companyId, {
        schoolProfileId: Number(school.id),
      });
      if (!catalogueDraft.agencyProfileId) {
        return NextResponse.json(
          { error: 'No DBE agency linked' },
          { status: 400 }
        );
      }
      const nowDraft = new Date().toISOString();
      const draftRow: Record<string, unknown> = {
        school_profile_id: school.id,
        profile_id: companyId,
        agency_profile_id: catalogueDraft.agencyProfileId,
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
        status: 'draft',
        pack_json: {
          ...pack,
          draft_reason: 'auto_from_clean_match',
          drafted_at: nowDraft,
        },
        tariff_zar: pack.claim_tariff_zar,
        audit_log: [
          {
            at: nowDraft,
            by: gate.userId || null,
            action: 'auto_draft',
            note: 'Draft created because three-way match and funding gates look ready. Principal must declare and submit.',
          },
        ],
        created_by: gate.userId || null,
      };
      const { data: draft, error: dErr } = await supabase
        .from('nsnp_claim_packs')
        .insert(draftRow)
        .select('*')
        .single();
      if (dErr) {
        // Soft fallback without audit columns
        const retry = await supabase
          .from('nsnp_claim_packs')
          .insert({
            school_profile_id: school.id,
            profile_id: companyId,
            agency_profile_id: catalogueDraft.agencyProfileId,
            period_from: (pack.period as { from: string }).from,
            period_to: (pack.period as { to: string }).to,
            days_fed: pack.days_fed,
            meals_served: pack.meals_served,
            claim_amount: pack.claim_amount,
            approved_brand_pct: pack.approved_brand_pct,
            status: 'draft',
            pack_json: pack,
          })
          .select('*')
          .single();
        if (retry.error) {
          return NextResponse.json(
            { error: retry.error.message || dErr.message },
            { status: 400 }
          );
        }
        return NextResponse.json({
          success: true,
          claim: retry.data,
          message:
            'Draft claim ready — open Claims, declare, then submit to DBE',
          pack,
        });
      }
      return NextResponse.json({
        success: true,
        claim: draft,
        message:
          'Draft claim ready — open Claims, declare, then submit to DBE',
        pack,
      });
    }

    if (pack.submit_ready === false) {
      return NextResponse.json(
        {
          error:
            String(pack.submit_block_reason) ||
            'Claim not ready — need active DBE association and at least one feeding day with meals served',
          pack,
        },
        { status: 400 }
      );
    }

    if (
      oneClick &&
      pack.match &&
      typeof pack.match === 'object' &&
      (pack.match as { clean?: boolean }).clean === false
    ) {
      return NextResponse.json(
        {
          error:
            'One-click claim blocked — three-way match is not clean for this period',
          pack,
          match: pack.match,
        },
        { status: 400 }
      );
    }

    // Strong control: principal / school declaration required before submit
    const declared = body.declaration === true || body.school_declaration === true;
    const declarationName = String(
      body.declaration_name || body.principal_name || ''
    ).trim();
    if (!declared || declarationName.length < 2) {
      return NextResponse.json(
        {
          error:
            'Confirm the school declaration and type the principal / claim officer full name before submitting to DBE.',
        },
        { status: 400 }
      );
    }

    const catalogue = await resolveCatalogueContext(supabase, companyId, {
      schoolProfileId: Number(school.id),
    });
    if (!catalogue.agencyProfileId) {
      return NextResponse.json(
        { error: 'No DBE agency linked — cannot submit claim' },
        { status: 400 }
      );
    }

    // Load DBE contact email (required for strong approval)
    const { data: agencyRow } = await supabase
      .from('nsnp_agency_profiles')
      .select('agency_name, contact_email, profile_id')
      .eq('profile_id', catalogue.agencyProfileId)
      .maybeSingle();
    const dbeEmail = agencyRow?.contact_email
      ? String(agencyRow.contact_email).trim()
      : '';
    if (!dbeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dbeEmail)) {
      return NextResponse.json(
        {
          error:
            'DBE contact email is not set. The department must record an official email on Schools → DBE desk before claims can be submitted for approval.',
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const approvalToken = generateClaimApprovalToken();
    const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const auditEntry = {
      at: now,
      by: gate.userId || null,
      action: 'submitted',
      note: `School submitted claim pack. Declaration by ${declarationName}. Awaiting DBE email approval (${dbeEmail}).`,
    };

    const insertRow: Record<string, unknown> = {
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
      status: 'submitted',
      pack_json: {
        ...pack,
        school_declaration_name: declarationName,
        submitted_at: now,
      },
      tariff_zar: pack.claim_tariff_zar,
      audit_log: [auditEntry],
      created_by: gate.userId || null,
      approval_token: approvalToken,
      approval_token_expires_at: expires,
      dbe_notified_email: dbeEmail,
      school_declaration: true,
      school_declaration_name: declarationName,
      school_declaration_at: now,
    };

    let data: Record<string, unknown> | null = null;
    let iErr: { message: string } | null = null;
    {
      const res = await supabase
        .from('nsnp_claim_packs')
        .insert(insertRow)
        .select('*')
        .single();
      data = res.data as Record<string, unknown> | null;
      iErr = res.error;
    }

    // Fallback if new claim columns not migrated yet
    if (iErr && /column|schema cache|does not exist/i.test(iErr.message)) {
      const retry = await supabase
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
          status: 'submitted',
          pack_json: {
            ...pack,
            school_declaration_name: declarationName,
            approval_token: approvalToken,
          },
          tariff_zar: pack.claim_tariff_zar,
          audit_log: [auditEntry],
          created_by: gate.userId || null,
        })
        .select('*')
        .single();
      data = retry.data as Record<string, unknown> | null;
      iErr = retry.error;
    }

    if (iErr || !data) {
      return NextResponse.json(
        { error: iErr?.message || 'Insert failed' },
        { status: 400 }
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      request.nextUrl.origin ||
      'https://www.supplieradvisor.com';
    const token = String(
      data.approval_token ||
        (data.pack_json as { approval_token?: string } | null)?.approval_token ||
        approvalToken
    );
    const reviewUrl = claimReviewUrl({ origin, token });
    const approveUrl = claimReviewUrl({
      origin,
      token,
      action: 'approve',
    });
    const rejectUrl = claimReviewUrl({ origin, token, action: 'reject' });

    const emailResult = await sendDbeClaimSubmittedEmail({
      to: dbeEmail,
      agencyName: String(agencyRow?.agency_name || catalogue.agencyName || 'DBE'),
      pack: {
        id: Number(data.id),
        school_name: String(school.school_name || `School ${school.id}`),
        emis:
          (school as { emis_number?: string; natemis?: string }).emis_number ||
          (school as { natemis?: string }).natemis ||
          null,
        district: school.district != null ? String(school.district) : null,
        province: school.province != null ? String(school.province) : null,
        period_from: String((pack.period as { from: string }).from),
        period_to: String((pack.period as { to: string }).to),
        meals_served: Number(pack.meals_served || 0),
        days_fed: Number(pack.days_fed || 0),
        claim_amount: Number(pack.claim_amount || 0),
        approved_brand_pct:
          pack.approved_brand_pct != null
            ? Number(pack.approved_brand_pct)
            : null,
        tariff_zar:
          pack.claim_tariff_zar != null ? Number(pack.claim_tariff_zar) : null,
      },
      approveUrl,
      rejectUrl,
      reviewUrl,
    });

    if (emailResult.ok) {
      try {
        await supabase
          .from('nsnp_claim_packs')
          .update({ dbe_notified_at: now, dbe_notified_email: dbeEmail })
          .eq('id', Number(data.id));
      } catch {
        /* soft */
      }
    }

    return NextResponse.json({
      success: true,
      claim: data,
      pack,
      dbe_notified: emailResult.ok,
      dbe_email: dbeEmail,
      dbe_email_error: emailResult.ok ? null : emailResult.error,
      message: emailResult.ok
        ? `Claim submitted. DBE notified at ${dbeEmail} — claim stays pending until DBE email approval.`
        : `Claim submitted but email to DBE failed (${emailResult.error}). DBE can still approve in Claims inbox.`,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
