import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import {
  computePrizeScore,
  currentQuarterPeriod,
} from '@/lib/schools/prize';
import { computeFeedingCompletenessPct } from '@/lib/schools/process';
import { schoolMenuAdherenceForPeriod } from '@/lib/schools/agency-menu';
import {
  SCHOOL_PRIZE_CRITERIA,
  SCHOOL_PRIZE_SUMMARY,
  SP_PRIZE_CRITERIA,
  SP_PRIZE_SUMMARY,
  POD_PHOTO_TIP,
} from '@/lib/schools/prize-criteria';
import {
  computeIspIncentive,
  scoreDeliveryLines,
} from '@/lib/schools/incentives';
import { PRIZE_WEIGHTS } from '@/lib/schools/types';

async function ensurePeriod(
  supabase: ReturnType<typeof getSupabaseServer>
) {
  const q = currentQuarterPeriod();
  const { data: existing } = await supabase
    .from('nsnp_prize_periods')
    .select('*')
    .eq('year', q.year)
    .eq('quarter', q.quarter)
    .eq('period_type', 'quarterly')
    .maybeSingle();
  if (existing) return existing;

  const { data: created } = await supabase
    .from('nsnp_prize_periods')
    .insert({
      name: q.name,
      period_type: 'quarterly',
      year: q.year,
      quarter: q.quarter,
      starts_on: q.starts_on,
      ends_on: q.ends_on,
      status: 'open',
      prize_description:
        'Quarterly headmaster prize for approved-brand NSNP compliance',
    })
    .select('*')
    .single();
  return created;
}

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

    const supabase = getSupabaseServer();

    // ── SP prize scorecard ────────────────────────────────────────────
    const { data: myIsp } = await supabase
      .from('nsnp_isp_profiles')
      .select('profile_id, trading_name')
      .eq('profile_id', companyId)
      .maybeSingle();

    if (myIsp) {
      const q = currentQuarterPeriod();
      const from = q.starts_on;
      const to = q.ends_on;

      const { data: deliveries } = await supabase
        .from('school_nsnp_deliveries')
        .select('id, status, otif, metadata, lines, expected_date')
        .eq('isp_profile_id', companyId)
        .gte('created_at', `${from}T00:00:00`)
        .lte('created_at', `${to}T23:59:59`)
        .limit(500);

      const { data: receipts } = await supabase
        .from('school_kitchen_receipts')
        .select('id, compliance_ok, lines')
        .eq('isp_profile_id', companyId)
        .gte('received_at', from)
        .lte('received_at', to)
        .limit(500);

      const dels = deliveries || [];
      let approved_ok = 0;
      let wrong_brand = 0;
      let full_compliance_deliveries = 0;
      let deliveries_with_pod = 0;
      let otif_ok = 0;
      let otif_known = 0;

      for (const d of dels) {
        const meta = (d.metadata || {}) as Record<string, unknown>;
        if (meta.has_pod_photo) deliveries_with_pod += 1;
        if (d.otif === true) {
          otif_known += 1;
          otif_ok += 1;
        } else if (d.otif === false) {
          otif_known += 1;
        }
        if (meta.full_compliance === true) full_compliance_deliveries += 1;
        else if (Array.isArray(d.lines)) {
          const sc = scoreDeliveryLines(
            d.lines as Array<Record<string, unknown>>
          );
          if (sc.full_compliance) full_compliance_deliveries += 1;
        }
      }

      // Prefer receipt-level compliance for approved_ok counts
      const recs = receipts || [];
      if (recs.length) {
        for (const r of recs) {
          if (r.compliance_ok === false) wrong_brand += 1;
          else approved_ok += 1;
        }
      } else {
        // Fallback: delivery metadata / line score
        for (const d of dels) {
          const meta = (d.metadata || {}) as Record<string, unknown>;
          if (meta.full_compliance === true || Number(meta.compliance_pct) >= 99.9) {
            approved_ok += 1;
          } else if (meta.compliance_pct != null) {
            if (Number(meta.compliance_pct) >= 80) approved_ok += 1;
            else wrong_brand += 1;
          } else {
            approved_ok += 1;
          }
        }
      }

      // POD files count (if metadata missing)
      if (dels.length && deliveries_with_pod === 0) {
        const delIds = dels.map((d) => Number(d.id)).filter(Boolean);
        if (delIds.length) {
          const { data: pods } = await supabase
            .from('school_nsnp_delivery_files')
            .select('delivery_id, kind')
            .in('delivery_id', delIds.slice(0, 200))
            .in('kind', ['pod', 'photo']);
          const withPod = new Set(
            (pods || []).map((p) => Number(p.delivery_id))
          );
          deliveries_with_pod = withPod.size;
        }
      }

      const totalDel = Math.max(recs.length, dels.length, 1);
      const incentive = computeIspIncentive({
        deliveries: recs.length || dels.length,
        approved_ok,
        wrong_brand,
        full_compliance_deliveries,
        deliveries_with_pod,
        otif_ok,
        otif_known,
      });

      return NextResponse.json({
        success: true,
        role: 'isp',
        period: {
          name: q.name,
          starts_on: from,
          ends_on: to,
          year: q.year,
          quarter: q.quarter,
        },
        score: {
          total: incentive.score,
          ...incentive.pillars,
          compliance_pct: incentive.compliance_pct,
          status: incentive.status,
          badge: incentive.badge,
        },
        incentive,
        stats: {
          deliveries: recs.length || dels.length,
          full_compliance_deliveries,
          deliveries_with_pod,
          otif_ok,
          otif_known,
          approved_ok,
          wrong_brand,
        },
        criteria: SP_PRIZE_CRITERIA,
        summary: SP_PRIZE_SUMMARY,
        pod_tip: POD_PHOTO_TIP,
        fairPlay:
          'Other items may appear on a delivery note, but full-compliance (100% DBE-approved) DNs earn the full-compliance pillar. Photo POD on every drop raises POD points.',
      });
    }

    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }

    const period = await ensurePeriod(supabase);
    if (!period) {
      return NextResponse.json({
        success: true,
        period: currentQuarterPeriod(),
        score: null,
        leaderboard: [],
        warning: 'Prize tables missing — run schools migration',
      });
    }

    // Live compute score for this school
    const from = period.starts_on;
    const to = period.ends_on;

    const [receiptsRes, feedingRes, learnersRes] = await Promise.all([
      supabase
        .from('school_kitchen_receipts')
        .select('compliance_ok, lines, received_at')
        .eq('school_profile_id', school.id)
        .gte('received_at', from)
        .lte('received_at', to)
        .limit(500),
      supabase
        .from('school_feeding_days')
        .select('feed_date, served_meals, planned_meals, menu_name')
        .eq('school_profile_id', school.id)
        .gte('feed_date', from)
        .lte('feed_date', to)
        .limit(500),
      supabase
        .from('school_learners')
        .select('verification_status, status')
        .eq('school_profile_id', school.id)
        .eq('status', 'active')
        .limit(5000),
    ]);

    const receipts = receiptsRes.data || [];
    let approvedLines = 0;
    let totalLines = 0;
    let nonApprovedEvents = 0;
    for (const r of receipts) {
      if (r.compliance_ok === false) nonApprovedEvents += 1;
      const lines = Array.isArray(r.lines) ? r.lines : [];
      for (const l of lines as Array<{ approved?: boolean }>) {
        totalLines += 1;
        if (l.approved !== false) approvedLines += 1;
      }
    }
    const approvedBrandPct =
      totalLines > 0 ? (approvedLines / totalLines) * 100 : 100;

    const feeding = feedingRes.data || [];
    // Honest denominators: weekdays in period
    const feedingCompletenessPct = computeFeedingCompletenessPct(
      feeding,
      from,
      to
    );
    // Rate against department-mandated menu (dish / products for that weekday)
    const menuScore = await schoolMenuAdherenceForPeriod(
      supabase,
      companyId,
      Number(school.id),
      from,
      to
    );
    const menuAdherencePct =
      menuScore.menu && menuScore.total > 0
        ? menuScore.pct
        : // No department menu yet — do not penalise
          100;

    const learners = learnersRes.data || [];
    const verified = learners.filter((l) =>
      ['school_verified', 'attested'].includes(String(l.verification_status))
    ).length;
    const dataQualityPct =
      learners.length > 0 ? (verified / learners.length) * 100 : 0;

    const breakdown = computePrizeScore({
      approvedBrandPct,
      nonApprovedEvents,
      menuAdherencePct,
      feedingCompletenessPct,
      stockDisciplinePct: nonApprovedEvents === 0 ? 100 : 70,
      dataQualityPct,
    });

    // Kitchen food safety (R638 / CoA) — non-compliant kitchens blocked from prizes
    let kitchenSafety: {
      band: string;
      label: string;
      prizes_blocked: boolean;
      reasons: string[];
    } | null = null;
    try {
      const {
        readKitchenPassport,
        evaluateKitchenRisk,
      } = await import('@/lib/schools/kitchen-safety');
      const smeta =
        school.metadata && typeof school.metadata === 'object'
          ? (school.metadata as Record<string, unknown>)
          : {};
      const risk = evaluateKitchenRisk(readKitchenPassport(smeta));
      kitchenSafety = {
        band: risk.band,
        label: risk.label,
        prizes_blocked: risk.prizes_blocked,
        reasons: risk.reasons,
      };
      if (risk.prizes_blocked) {
        breakdown.total = 0;
      }
    } catch {
      /* soft */
    }

    // Persist snapshot
    await supabase.from('nsnp_prize_scores').upsert(
      {
        period_id: period.id,
        school_profile_id: school.id,
        profile_id: companyId,
        approved_brand_pct: breakdown.inputs.approvedBrandPct,
        zero_nonapproved_score: breakdown.zeroNonapproved,
        menu_adherence_pct: breakdown.inputs.menuAdherencePct,
        feeding_completeness_pct: breakdown.inputs.feedingCompletenessPct,
        stock_discipline_pct: breakdown.inputs.stockDisciplinePct,
        data_quality_pct: breakdown.inputs.dataQualityPct,
        total_score: breakdown.total,
        province: school.province || null,
        district: school.district || null,
        quintile: school.quintile || null,
        breakdown,
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'period_id,school_profile_id' }
    );

    // Leaderboard
    const { data: board } = await supabase
      .from('nsnp_prize_scores')
      .select(
        'school_profile_id, total_score, province, district, approved_brand_pct, profile_id'
      )
      .eq('period_id', period.id)
      .order('total_score', { ascending: false })
      .limit(50);

    const schoolIds = (board || []).map((b) => Number(b.school_profile_id));
    let names: Record<number, string> = {};
    if (schoolIds.length) {
      const { data: schools } = await supabase
        .from('school_profiles')
        .select('id, school_name')
        .in('id', schoolIds);
      for (const s of schools || []) {
        names[Number(s.id)] = String(s.school_name);
      }
    }

    // Enrich names + quintile for fair bands
    const boardSchoolIds = (board || []).map((b) => Number(b.school_profile_id));
    let metaById: Record<
      number,
      { name: string; province: string | null; district: string | null; quintile: number | null }
    > = {};
    if (boardSchoolIds.length) {
      const { data: schools } = await supabase
        .from('school_profiles')
        .select('id, school_name, province, district, quintile')
        .in('id', boardSchoolIds);
      for (const s of schools || []) {
        metaById[Number(s.id)] = {
          name: String(s.school_name),
          province: s.province != null ? String(s.province) : null,
          district: s.district != null ? String(s.district) : null,
          quintile: s.quintile != null ? Number(s.quintile) : null,
        };
      }
    }

    const leaderboard = (board || []).map((b, i) => {
      const meta = metaById[Number(b.school_profile_id)];
      return {
        rank: i + 1,
        school_profile_id: b.school_profile_id,
        school_name:
          meta?.name ||
          names[Number(b.school_profile_id)] ||
          `School ${b.school_profile_id}`,
        total_score: b.total_score,
        approved_brand_pct: b.approved_brand_pct,
        province: meta?.province || b.province,
        district: meta?.district || b.district,
        quintile: meta?.quintile ?? null,
        is_me: Number(b.school_profile_id) === Number(school.id),
      };
    });

    // Fair bands: rank within province and quintile
    const myId = Number(school.id);
    const myMeta = metaById[myId] || {
      province: school.province != null ? String(school.province) : null,
      district: school.district != null ? String(school.district) : null,
      quintile: school.quintile != null ? Number(school.quintile) : null,
      name: String(school.school_name),
    };

    function bandRank(
      pred: (row: (typeof leaderboard)[0]) => boolean
    ): number | null {
      const band = leaderboard.filter(pred);
      const idx = band.findIndex((r) => r.is_me);
      return idx >= 0 ? idx + 1 : null;
    }

    const bands = {
      national: leaderboard.find((l) => l.is_me)?.rank || null,
      province: myMeta.province
        ? bandRank((r) => r.province === myMeta.province)
        : null,
      district: myMeta.district
        ? bandRank((r) => r.district === myMeta.district)
        : null,
      quintile:
        myMeta.quintile != null
          ? bandRank((r) => r.quintile === myMeta.quintile)
          : null,
    };

    // Issue / refresh certificates for top ranks in each band (soft)
    const certs: Array<Record<string, unknown>> = [];
    try {
      if (period?.id && bands.national && bands.national <= 10) {
        const code = `NSNP-Q${period.quarter}-${period.year}-NAT-${bands.national}`;
        await supabase.from('nsnp_prize_certificates').insert({
          period_id: period.id,
          school_profile_id: school.id,
          profile_id: companyId,
          band: 'national',
          band_key: 'national',
          rank: bands.national,
          total_score: breakdown.total,
          certificate_code: code,
          title: `National Top ${bands.national} — ${period.name}`,
          body: `Awarded for approved-brand NSNP compliance and operational excellence.`,
          issued_at: new Date().toISOString(),
        });
      }
      const { data: myCerts } = await supabase
        .from('nsnp_prize_certificates')
        .select('*')
        .eq('school_profile_id', school.id)
        .order('issued_at', { ascending: false })
        .limit(10);
      certs.push(...((myCerts || []) as Array<Record<string, unknown>>));
    } catch {
      /* soft if cert table/unique missing */
    }

    const myRank = bands.national;

    return NextResponse.json({
      success: true,
      role: 'school',
      period,
      score: {
        ...breakdown,
        rank: myRank,
        bands,
        prizes_blocked: kitchenSafety?.prizes_blocked === true,
      },
      kitchen_safety: kitchenSafety,
      leaderboard,
      bands,
      certificates: certs,
      weights: { ...PRIZE_WEIGHTS },
      criteria: SCHOOL_PRIZE_CRITERIA,
      summary: SCHOOL_PRIZE_SUMMARY,
      sp_criteria: SP_PRIZE_CRITERIA,
      sp_summary: SP_PRIZE_SUMMARY,
      pod_tip: POD_PHOTO_TIP,
      fairPlay:
        'Ranks are shown nationally and fairly within province, district, and quintile so Q1 schools compete with peers. Prefer SPs with full-compliance deliveries and photo POD.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
