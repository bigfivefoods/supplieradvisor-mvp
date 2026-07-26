/**
 * NSNP nutrition reporting — school, learner estimate, agency aggregate, benchmarks.
 */

export type FeedingDayNut = {
  feed_date?: string;
  meal_type?: string;
  served_meals?: number | null;
  planned_meals?: number | null;
  learners_present?: number | null;
  waste_meals?: number | null;
  nutrition_energy_kcal?: number | null;
  nutrition_protein_g?: number | null;
  nutrition_pass?: boolean | null;
};

export type SchoolNutritionSummary = {
  period: { from: string; to: string };
  daysFed: number;
  mealsServed: number;
  mealsPlanned: number;
  mealsWaste: number;
  wastePct: number;
  avgPresent: number;
  daysWithNutrition: number;
  nutritionPassDays: number;
  nutritionPassPct: number | null;
  avgEnergyKcal: number | null;
  avgProteinG: number | null;
  totalEstimatedKcalServed: number;
  totalEstimatedProteinServed: number;
  minEnergyKcal: number;
  minProteinG: number;
  daysAboveEnergyNorm: number;
  daysAboveProteinNorm: number;
  score: number; // 0–100 composite
};

export type LearnerNutritionRow = {
  learner_id: number;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string;
  grade?: string | null;
  nsnp_eligible?: boolean;
  verification_status?: string | null;
  /** Estimated meals allocated over period */
  estimated_meals: number;
  estimated_energy_kcal: number;
  estimated_protein_g: number;
  estimated_daily_energy_kcal: number;
  estimated_daily_protein_g: number;
  meets_energy_norm: boolean | null;
  meets_protein_norm: boolean | null;
  overall_ok: boolean | null;
};

export type BenchmarkKpi = {
  key: string;
  label: string;
  school: number | null;
  agencyAvg: number | null;
  delta: number | null;
  unit?: string;
  higherIsBetter?: boolean;
};

export function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

export function summariseSchoolNutrition(
  feeding: FeedingDayNut[],
  opts?: { minEnergyKcal?: number; minProteinG?: number; periodDays?: number }
): SchoolNutritionSummary {
  const minE = opts?.minEnergyKcal ?? 450;
  const minP = opts?.minProteinG ?? 15;
  const days = feeding;
  const daysFed = new Set(
    days.filter((d) => Number(d.served_meals || 0) > 0).map((d) => String(d.feed_date))
  ).size;
  const mealsServed = days.reduce((n, d) => n + Number(d.served_meals || 0), 0);
  const mealsPlanned = days.reduce((n, d) => n + Number(d.planned_meals || 0), 0);
  const mealsWaste = days.reduce((n, d) => n + Number(d.waste_meals || 0), 0);
  const presentSum = days.reduce((n, d) => n + Number(d.learners_present || 0), 0);
  const avgPresent =
    days.length > 0 ? Math.round((presentSum / days.length) * 100) / 100 : 0;

  const withNut = days.filter(
    (d) =>
      d.nutrition_energy_kcal != null ||
      d.nutrition_protein_g != null ||
      d.nutrition_pass != null
  );
  const passDays = withNut.filter((d) => d.nutrition_pass === true).length;
  const energyVals = withNut
    .map((d) => Number(d.nutrition_energy_kcal))
    .filter((n) => Number.isFinite(n) && n > 0);
  const proteinVals = withNut
    .map((d) => Number(d.nutrition_protein_g))
    .filter((n) => Number.isFinite(n) && n > 0);
  const avgEnergy = avg(energyVals);
  const avgProtein = avg(proteinVals);

  // Total nutrients "served" ≈ per-meal estimate × meals (when we have day energy as dish estimate)
  let totalKcal = 0;
  let totalProt = 0;
  let daysAboveE = 0;
  let daysAboveP = 0;
  for (const d of withNut) {
    const e = Number(d.nutrition_energy_kcal || 0);
    const p = Number(d.nutrition_protein_g || 0);
    const m = Number(d.served_meals || 0);
    if (e > 0) totalKcal += e * Math.max(m, 1);
    if (p > 0) totalProt += p * Math.max(m, 1);
    if (e >= minE) daysAboveE += 1;
    if (p >= minP) daysAboveP += 1;
  }

  const nutritionPassPct =
    withNut.length > 0
      ? Math.round((passDays / withNut.length) * 1000) / 10
      : null;

  // Composite score: pass% 50% + energy vs norm 25% + protein vs norm 25%
  let score = 0;
  let parts = 0;
  if (nutritionPassPct != null) {
    score += nutritionPassPct * 0.5;
    parts += 0.5;
  }
  if (avgEnergy != null) {
    score += Math.min(100, (avgEnergy / minE) * 100) * 0.25;
    parts += 0.25;
  }
  if (avgProtein != null) {
    score += Math.min(100, (avgProtein / minP) * 100) * 0.25;
    parts += 0.25;
  }
  if (parts > 0 && parts < 1) score = score / parts;
  score = Math.round(Math.min(100, score) * 10) / 10;

  return {
    period: { from: '', to: '' },
    daysFed,
    mealsServed,
    mealsPlanned,
    mealsWaste,
    wastePct:
      mealsServed > 0
        ? Math.round((mealsWaste / mealsServed) * 1000) / 10
        : 0,
    avgPresent,
    daysWithNutrition: withNut.length,
    nutritionPassDays: passDays,
    nutritionPassPct,
    avgEnergyKcal: avgEnergy,
    avgProteinG: avgProtein,
    totalEstimatedKcalServed: Math.round(totalKcal),
    totalEstimatedProteinServed: Math.round(totalProt * 10) / 10,
    minEnergyKcal: minE,
    minProteinG: minP,
    daysAboveEnergyNorm: daysAboveE,
    daysAboveProteinNorm: daysAboveP,
    score,
  };
}

/**
 * Allocate school meal nutrition across learners (eligible preferred).
 * Honest estimate when individual meal logs do not exist.
 */
export function estimateLearnerNutrition(
  learners: Array<{
    id: number;
    first_name?: string | null;
    last_name?: string | null;
    grade?: string | null;
    nsnp_eligible?: boolean | null;
    verification_status?: string | null;
    status?: string | null;
  }>,
  schoolSum: SchoolNutritionSummary,
  opts?: { periodWeekdays?: number; privacy?: boolean }
): LearnerNutritionRow[] {
  const active = learners.filter(
    (l) => String(l.status || 'active') === 'active'
  );
  const eligible = active.filter((l) => l.nsnp_eligible !== false);
  const pool = eligible.length > 0 ? eligible : active;
  const n = Math.max(pool.length, 1);
  const mealsEach =
    Math.round((schoolSum.mealsServed / n) * 100) / 100;
  const avgMealKcal = schoolSum.avgEnergyKcal ?? 0;
  const avgMealProt = schoolSum.avgProteinG ?? 0;
  const weekdays = Math.max(opts?.periodWeekdays || schoolSum.daysFed || 1, 1);
  const minE = schoolSum.minEnergyKcal;
  const minP = schoolSum.minProteinG;

  return pool.map((l) => {
    const energy = Math.round(mealsEach * avgMealKcal * 10) / 10;
    const protein = Math.round(mealsEach * avgMealProt * 10) / 10;
    const dailyE =
      weekdays > 0 ? Math.round((energy / weekdays) * 10) / 10 : 0;
    const dailyP =
      weekdays > 0 ? Math.round((protein / weekdays) * 10) / 10 : 0;
    const hasData = avgMealKcal > 0 || avgMealProt > 0;
    const meetsE = hasData ? dailyE >= minE * 0.7 : null; // soft daily share of norm
    const meetsP = hasData ? dailyP >= minP * 0.7 : null;
    const display = opts?.privacy
      ? `${String(l.first_name || '?')[0]}. ${String(l.last_name || '?')[0]}.`
      : [l.first_name, l.last_name].filter(Boolean).join(' ') || `Learner ${l.id}`;

    return {
      learner_id: Number(l.id),
      first_name: l.first_name,
      last_name: l.last_name,
      display_name: display,
      grade: l.grade,
      nsnp_eligible: l.nsnp_eligible !== false,
      verification_status: l.verification_status,
      estimated_meals: mealsEach,
      estimated_energy_kcal: energy,
      estimated_protein_g: protein,
      estimated_daily_energy_kcal: dailyE,
      estimated_daily_protein_g: dailyP,
      meets_energy_norm: meetsE,
      meets_protein_norm: meetsP,
      overall_ok:
        meetsE == null || meetsP == null ? null : meetsE && meetsP,
    };
  });
}

export function buildBenchmarks(
  school: Partial<SchoolNutritionSummary> & {
    approvedBrandPct?: number | null;
    verifyPct?: number | null;
    prizeScore?: number | null;
    surveyAvg?: number | null;
  },
  agency: {
    avgNutritionScore?: number | null;
    avgNutritionPassPct?: number | null;
    avgEnergyKcal?: number | null;
    avgProteinG?: number | null;
    avgApprovedBrandPct?: number | null;
    avgVerifyPct?: number | null;
    avgPrizeScore?: number | null;
    avgWastePct?: number | null;
    avgSurveyAvg?: number | null;
  }
): BenchmarkKpi[] {
  const row = (
    key: string,
    label: string,
    schoolVal: number | null | undefined,
    agencyVal: number | null | undefined,
    unit?: string,
    higherIsBetter = true
  ): BenchmarkKpi => {
    const s = schoolVal != null && Number.isFinite(Number(schoolVal)) ? Number(schoolVal) : null;
    const a = agencyVal != null && Number.isFinite(Number(agencyVal)) ? Number(agencyVal) : null;
    const delta =
      s != null && a != null ? Math.round((s - a) * 100) / 100 : null;
    return { key, label, school: s, agencyAvg: a, delta, unit, higherIsBetter };
  };

  return [
    row('nutrition_score', 'Nutrition score', school.score, agency.avgNutritionScore, '/100'),
    row(
      'nutrition_pass',
      'Nutrition pass %',
      school.nutritionPassPct,
      agency.avgNutritionPassPct,
      '%'
    ),
    row('energy', 'Avg energy / meal', school.avgEnergyKcal, agency.avgEnergyKcal, 'kcal'),
    row('protein', 'Avg protein / meal', school.avgProteinG, agency.avgProteinG, 'g'),
    row(
      'waste',
      'Waste %',
      school.wastePct,
      agency.avgWastePct,
      '%',
      false
    ),
    row(
      'approved_brand',
      'Approved brand %',
      school.approvedBrandPct,
      agency.avgApprovedBrandPct,
      '%'
    ),
    row('verify', 'Learner verify %', school.verifyPct, agency.avgVerifyPct, '%'),
    row('prize', 'Prize score', school.prizeScore, agency.avgPrizeScore, ''),
    row('survey', 'Food survey ★', school.surveyAvg, agency.avgSurveyAvg, '★'),
  ];
}
