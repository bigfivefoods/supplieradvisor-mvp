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
import {
  computeFeedingCompletenessPct,
  computeMenuAdherencePct,
} from '@/lib/schools/process';

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
    // Honest denominators: weekdays in period + menu_name logging rate
    const feedingCompletenessPct = computeFeedingCompletenessPct(
      feeding,
      from,
      to
    );
    const menuAdherencePct = computeMenuAdherencePct(feeding);

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
      period,
      score: {
        ...breakdown,
        rank: myRank,
        bands,
      },
      leaderboard,
      bands,
      certificates: certs,
      weights: {
        approvedBrand: 40,
        zeroNonapproved: 15,
        menuAdherence: 15,
        feedingCompleteness: 15,
        stockDiscipline: 10,
        dataQuality: 5,
      },
      fairPlay:
        'Ranks are shown nationally and fairly within province, district, and quintile so Q1 schools compete with peers.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
