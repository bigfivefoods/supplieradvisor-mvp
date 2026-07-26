import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import {
  buildBenchmarks,
  estimateLearnerNutrition,
  summariseSchoolNutrition,
  type FeedingDayNut,
} from '@/lib/schools/nutrition-report';
import { pickNorm, type NutritionNorm } from '@/lib/schools/nutrition';
import { countWeekdays } from '@/lib/schools/process';
import { privacyEnabled } from '@/lib/schools/privacy';
import { resolveCatalogueContext } from '@/lib/schools/approved-catalogue';

/**
 * Nutrition reports:
 * - school (default): school summary + learner estimates + vs DBE average
 * - agency: multi-school nutrition roll-up (company must be agency)
 *
 * ?companyId=&from=&to=&mode=school|agency&learners=1
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
    fromDefault.setDate(fromDefault.getDate() - 30);
    const from = sp.get('from') || fromDefault.toISOString().slice(0, 10);
    const mode = String(sp.get('mode') || 'school');
    const includeLearners = sp.get('learners') !== '0';

    const supabase = getSupabaseServer();

    // Norms
    const { data: normsRaw } = await supabase
      .from('nsnp_nutrition_norms')
      .select('*')
      .eq('active', true)
      .limit(50);
    const norms = (normsRaw || []) as NutritionNorm[];
    const lunchNorm = pickNorm(norms, 'lunch', null);

    // ── Agency multi-school ───────────────────────────────────────────
    if (mode === 'agency') {
      const { data: agency } = await supabase
        .from('nsnp_agency_profiles')
        .select('*')
        .eq('profile_id', companyId)
        .maybeSingle();
      if (!agency) {
        return NextResponse.json(
          { error: 'Register as DBE/PEU agency first' },
          { status: 403 }
        );
      }
      const { data: links } = await supabase
        .from('school_agency_links')
        .select('school_profile_id, status')
        .eq('agency_profile_id', companyId)
        .eq('status', 'active')
        .limit(2000);
      const schoolIds = (links || [])
        .map((l) => Number(l.school_profile_id))
        .filter(Boolean);
      if (!schoolIds.length) {
        return NextResponse.json({
          success: true,
          mode: 'agency',
          period: { from, to },
          schools: [],
          aggregate: null,
          norms: lunchNorm,
        });
      }

      const { data: schools } = await supabase
        .from('school_profiles')
        .select(
          'id, school_name, emis_number, province, district, phase, learner_count_enrolled, learner_count_verified, learner_count_nsnp_eligible'
        )
        .in('id', schoolIds);

      const rows: Array<Record<string, unknown>> = [];
      for (let i = 0; i < schoolIds.length; i += 40) {
        const chunk = schoolIds.slice(i, i + 40);
        const { data: feeding } = await supabase
          .from('school_feeding_days')
          .select(
            'school_profile_id, feed_date, meal_type, served_meals, planned_meals, waste_meals, learners_present, nutrition_energy_kcal, nutrition_protein_g, nutrition_pass'
          )
          .in('school_profile_id', chunk)
          .gte('feed_date', from)
          .lte('feed_date', to)
          .limit(20000);
        const bySchool = new Map<number, FeedingDayNut[]>();
        for (const f of feeding || []) {
          const sid = Number(f.school_profile_id);
          if (!bySchool.has(sid)) bySchool.set(sid, []);
          bySchool.get(sid)!.push(f as FeedingDayNut);
        }
        for (const sid of chunk) {
          const sch = (schools || []).find((s) => Number(s.id) === sid);
          const phase = sch?.phase != null ? String(sch.phase) : null;
          const norm = pickNorm(norms, 'lunch', phase) || lunchNorm;
          const sum = summariseSchoolNutrition(bySchool.get(sid) || [], {
            minEnergyKcal: norm?.min_energy_kcal,
            minProteinG: norm?.min_protein_g,
          });
          sum.period = { from, to };
          rows.push({
            school_profile_id: sid,
            school_name: sch?.school_name || `School ${sid}`,
            emis: sch?.emis_number,
            province: sch?.province,
            district: sch?.district,
            learners: sch?.learner_count_enrolled,
            eligible: sch?.learner_count_nsnp_eligible,
            ...sum,
          });
        }
      }

      const scores = rows
        .map((r) => Number(r.score))
        .filter((n) => Number.isFinite(n));
      const passPcts = rows
        .map((r) => r.nutritionPassPct)
        .filter((n): n is number => n != null && Number.isFinite(n));
      const energies = rows
        .map((r) => r.avgEnergyKcal)
        .filter((n): n is number => n != null && Number.isFinite(n));
      const proteins = rows
        .map((r) => r.avgProteinG)
        .filter((n): n is number => n != null && Number.isFinite(n));
      const wastes = rows
        .map((r) => Number(r.wastePct))
        .filter((n) => Number.isFinite(n));

      const aggregate = {
        schools: rows.length,
        totalMealsServed: rows.reduce(
          (n, r) => n + Number(r.mealsServed || 0),
          0
        ),
        avgNutritionScore:
          scores.length > 0
            ? Math.round(
                (scores.reduce((a, b) => a + b, 0) / scores.length) * 10
              ) / 10
            : null,
        avgNutritionPassPct:
          passPcts.length > 0
            ? Math.round(
                (passPcts.reduce((a, b) => a + b, 0) / passPcts.length) * 10
              ) / 10
            : null,
        avgEnergyKcal:
          energies.length > 0
            ? Math.round(
                (energies.reduce((a, b) => a + b, 0) / energies.length) * 10
              ) / 10
            : null,
        avgProteinG:
          proteins.length > 0
            ? Math.round(
                (proteins.reduce((a, b) => a + b, 0) / proteins.length) * 10
              ) / 10
            : null,
        avgWastePct:
          wastes.length > 0
            ? Math.round(
                (wastes.reduce((a, b) => a + b, 0) / wastes.length) * 10
              ) / 10
            : null,
        schoolsBelowNorm: rows.filter(
          (r) =>
            r.nutritionPassPct != null && Number(r.nutritionPassPct) < 70
        ).length,
      };

      rows.sort(
        (a, b) => Number(b.score || 0) - Number(a.score || 0)
      );

      return NextResponse.json({
        success: true,
        mode: 'agency',
        period: { from, to },
        agency: {
          name: agency.agency_name,
          type: agency.agency_type,
        },
        norms: lunchNorm,
        aggregate,
        schools: rows,
      });
    }

    // ── Single school ─────────────────────────────────────────────────
    const { school, error } = await getOrCreateSchoolProfile(
      supabase,
      companyId
    );
    if (error || !school) {
      return NextResponse.json(
        { error: error || 'School not found' },
        { status: 503 }
      );
    }
    const schoolId = Number(school.id);
    const phase = school.phase != null ? String(school.phase) : null;
    const norm = pickNorm(norms, 'lunch', phase) || lunchNorm;

    const [
      feedingRes,
      learnersRes,
      receiptsRes,
      prizeRes,
      surveyRes,
    ] = await Promise.all([
      supabase
        .from('school_feeding_days')
        .select(
          'feed_date, meal_type, served_meals, planned_meals, waste_meals, learners_present, nutrition_energy_kcal, nutrition_protein_g, nutrition_pass, menu_name'
        )
        .eq('school_profile_id', schoolId)
        .gte('feed_date', from)
        .lte('feed_date', to)
        .limit(2000),
      includeLearners
        ? supabase
            .from('school_learners')
            .select(
              'id, first_name, last_name, grade, nsnp_eligible, verification_status, status'
            )
            .eq('school_profile_id', schoolId)
            .eq('status', 'active')
            .limit(5000)
        : Promise.resolve({
            data: [] as Array<{
              id: number;
              first_name?: string | null;
              last_name?: string | null;
              grade?: string | null;
              nsnp_eligible?: boolean | null;
              verification_status?: string | null;
              status?: string | null;
            }>,
          }),
      supabase
        .from('school_kitchen_receipts')
        .select('compliance_ok, lines')
        .eq('school_profile_id', schoolId)
        .gte('received_at', from)
        .lte('received_at', to)
        .limit(500),
      supabase
        .from('nsnp_prize_scores')
        .select('total_score')
        .eq('school_profile_id', schoolId)
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('school_food_surveys')
        .select('avg_rating, response_count')
        .eq('school_profile_id', schoolId)
        .limit(20),
    ]);

    const feeding = (feedingRes.data || []) as FeedingDayNut[];
    const summary = summariseSchoolNutrition(feeding, {
      minEnergyKcal: norm?.min_energy_kcal,
      minProteinG: norm?.min_protein_g,
    });
    summary.period = { from, to };

    // Brand %
    let approvedLines = 0;
    let totalLines = 0;
    for (const r of receiptsRes.data || []) {
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
        : null;

    type LearnerInput = {
      id: number;
      first_name?: string | null;
      last_name?: string | null;
      grade?: string | null;
      nsnp_eligible?: boolean | null;
      verification_status?: string | null;
      status?: string | null;
    };
    const learners: LearnerInput[] = (
      (learnersRes.data || []) as Array<Record<string, unknown>>
    ).map((l) => ({
      id: Number(l.id),
      first_name: (l.first_name as string | null) ?? null,
      last_name: (l.last_name as string | null) ?? null,
      grade: (l.grade as string | null) ?? null,
      nsnp_eligible:
        l.nsnp_eligible === false || l.nsnp_eligible === true
          ? Boolean(l.nsnp_eligible)
          : null,
      verification_status: (l.verification_status as string | null) ?? null,
      status: (l.status as string | null) ?? null,
    }));
    const verified = learners.filter((l) =>
      ['school_verified', 'attested'].includes(String(l.verification_status))
    ).length;
    const verifyPct =
      learners.length > 0
        ? Math.round((verified / learners.length) * 1000) / 10
        : null;

    const surveys = surveyRes.data || [];
    const rated = surveys
      .map((s) => Number(s.avg_rating))
      .filter((n) => Number.isFinite(n) && n > 0);
    const surveyAvg =
      rated.length > 0
        ? Math.round(
            (rated.reduce((a, b) => a + b, 0) / rated.length) * 100
          ) / 100
        : null;

    const privacy = privacyEnabled(
      school as { metadata?: unknown; privacy_mode?: boolean | null }
    );
    const weekdays = countWeekdays(from, to);
    const learnerRows = includeLearners
      ? estimateLearnerNutrition(learners, summary, {
          periodWeekdays: weekdays,
          privacy,
        })
      : [];

    // Agency averages for peer compare
    let agencyAverages: Record<string, number | null> = {};
    let agencyName: string | null = null;
    let peerCount = 0;
    const catalogue = await resolveCatalogueContext(supabase, companyId, {
      schoolProfileId: schoolId,
    });
    if (catalogue.agencyProfileId) {
      agencyName = catalogue.agencyName;
      const { data: links } = await supabase
        .from('school_agency_links')
        .select('school_profile_id')
        .eq('agency_profile_id', catalogue.agencyProfileId)
        .eq('status', 'active')
        .limit(500);
      const peerIds = (links || [])
        .map((l) => Number(l.school_profile_id))
        .filter((id) => id && id !== schoolId);
      peerCount = peerIds.length + 1;

      const peerScores: number[] = [summary.score];
      const peerPass: number[] = [];
      if (summary.nutritionPassPct != null)
        peerPass.push(summary.nutritionPassPct);
      const peerEnergy: number[] = [];
      if (summary.avgEnergyKcal != null)
        peerEnergy.push(summary.avgEnergyKcal);
      const peerProtein: number[] = [];
      if (summary.avgProteinG != null)
        peerProtein.push(summary.avgProteinG);
      const peerWaste: number[] = [summary.wastePct];
      const peerBrand: number[] = [];
      if (approvedBrandPct != null) peerBrand.push(approvedBrandPct);
      const peerVerify: number[] = [];
      if (verifyPct != null) peerVerify.push(verifyPct);

      // Sample peers (cap for performance)
      const sample = peerIds.slice(0, 80);
      for (let i = 0; i < sample.length; i += 40) {
        const chunk = sample.slice(i, i + 40);
        const { data: pf } = await supabase
          .from('school_feeding_days')
          .select(
            'school_profile_id, feed_date, served_meals, planned_meals, waste_meals, learners_present, nutrition_energy_kcal, nutrition_protein_g, nutrition_pass'
          )
          .in('school_profile_id', chunk)
          .gte('feed_date', from)
          .lte('feed_date', to)
          .limit(15000);
        const map = new Map<number, FeedingDayNut[]>();
        for (const f of pf || []) {
          const sid = Number(f.school_profile_id);
          if (!map.has(sid)) map.set(sid, []);
          map.get(sid)!.push(f as FeedingDayNut);
        }
        for (const sid of chunk) {
          const s = summariseSchoolNutrition(map.get(sid) || [], {
            minEnergyKcal: norm?.min_energy_kcal,
            minProteinG: norm?.min_protein_g,
          });
          peerScores.push(s.score);
          if (s.nutritionPassPct != null) peerPass.push(s.nutritionPassPct);
          if (s.avgEnergyKcal != null) peerEnergy.push(s.avgEnergyKcal);
          if (s.avgProteinG != null) peerProtein.push(s.avgProteinG);
          peerWaste.push(s.wastePct);
        }
      }

      const mean = (arr: number[]) =>
        arr.length
          ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) /
            100
          : null;

      agencyAverages = {
        avgNutritionScore: mean(peerScores),
        avgNutritionPassPct: mean(peerPass),
        avgEnergyKcal: mean(peerEnergy),
        avgProteinG: mean(peerProtein),
        avgWastePct: mean(peerWaste),
        avgApprovedBrandPct: mean(peerBrand),
        avgVerifyPct: mean(peerVerify),
        avgPrizeScore:
          prizeRes.data?.total_score != null
            ? Number(prizeRes.data.total_score)
            : null,
        avgSurveyAvg: surveyAvg,
      };
    }

    const benchmarks = buildBenchmarks(
      {
        ...summary,
        approvedBrandPct,
        verifyPct,
        prizeScore:
          prizeRes.data?.total_score != null
            ? Number(prizeRes.data.total_score)
            : null,
        surveyAvg,
      },
      agencyAverages
    );

    // Daily series for charts
    const byDate = new Map<
      string,
      { served: number; energy: number | null; protein: number | null; pass: boolean | null }
    >();
    for (const d of feeding) {
      const key = String(d.feed_date || '');
      if (!key) continue;
      const cur = byDate.get(key) || {
        served: 0,
        energy: null,
        protein: null,
        pass: null,
      };
      cur.served += Number(d.served_meals || 0);
      if (d.nutrition_energy_kcal != null)
        cur.energy = Number(d.nutrition_energy_kcal);
      if (d.nutrition_protein_g != null)
        cur.protein = Number(d.nutrition_protein_g);
      if (d.nutrition_pass != null) cur.pass = Boolean(d.nutrition_pass);
      byDate.set(key, cur);
    }
    const trend = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    const learnersOk = learnerRows.filter((l) => l.overall_ok === true).length;
    const learnersBelow = learnerRows.filter(
      (l) => l.overall_ok === false
    ).length;

    return NextResponse.json({
      success: true,
      mode: 'school',
      period: { from, to },
      school: {
        id: schoolId,
        name: school.school_name,
        emis: school.emis_number,
        province: school.province,
        district: school.district,
        phase: school.phase,
        photo_url: school.photo_url,
      },
      norms: norm,
      summary,
      approvedBrandPct,
      verifyPct,
      surveyAvg,
      prizeScore:
        prizeRes.data?.total_score != null
          ? Number(prizeRes.data.total_score)
          : null,
      agency: {
        name: agencyName,
        peerCount,
        averages: agencyAverages,
      },
      benchmarks,
      trend,
      learners: {
        privacy,
        total: learnerRows.length,
        meetingNorm: learnersOk,
        belowNorm: learnersBelow,
        unknown: learnerRows.filter((l) => l.overall_ok == null).length,
        rows: learnerRows.slice(0, 500),
      },
      methodNote:
        'Learner nutrition is estimated by allocating school meals × average dish nutrients across NSNP-eligible learners when individual meal logs are not captured. Link approved products on menus and complete serve-day for best accuracy.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
