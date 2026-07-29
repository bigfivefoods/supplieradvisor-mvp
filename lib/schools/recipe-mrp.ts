/**
 * NSNP Recipe BOM → MPS (meals) + MRP (product requirements).
 * Portions scale by school NSNP learner count; SP rollup = sum of their schools.
 */

export type RecipeLine = {
  id?: number;
  approved_product_id: number | null;
  product_name: string;
  brand_name?: string | null;
  category?: string | null;
  qty_per_portion: number;
  uom: string;
  wastage_pct?: number;
  sort_order?: number;
  notes?: string | null;
};

export type Recipe = {
  id: number;
  agency_profile_id: number;
  name: string;
  meal_type: string;
  dish_code?: string | null;
  description?: string | null;
  portion_learners: number;
  active?: boolean;
  lines: RecipeLine[];
};

export type CategoryBudget = {
  id?: number;
  category: string;
  period_from: string;
  period_to: string;
  budget_amount_zar: number;
  unit_price_zar?: number | null;
  uom?: string | null;
};

export type SchoolLearners = {
  school_profile_id: number;
  school_name: string;
  emis_number?: string | null;
  district?: string | null;
  learners: number;
  isp_profile_ids?: number[];
};

/** Count feeding days (weekdays by default) inclusive.
 *  When `feedingDates` is provided (from DBE calendar), only those dates count.
 */
export function countFeedingDays(
  from: string,
  to: string,
  includeWeekends = false,
  feedingDates?: Set<string> | null
): number {
  const a = new Date(`${from.slice(0, 10)}T12:00:00`);
  const b = new Date(`${to.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || a > b) return 0;
  let n = 0;
  const d = new Date(a);
  while (d <= b) {
    if (feedingDates) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      if (feedingDates.has(`${y}-${m}-${day}`)) n += 1;
    } else {
      const day = d.getDay();
      if (includeWeekends || (day !== 0 && day !== 6)) n += 1;
    }
    d.setDate(d.getDate() + 1);
  }
  return n;
}

/** qty with wastage: qty * (1 + wastage_pct/100) */
export function qtyWithWastage(qty: number, wastagePct = 0): number {
  const w = Math.max(0, Number(wastagePct) || 0);
  return Math.round(qty * (1 + w / 100) * 1e6) / 1e6;
}

/**
 * Portions of a recipe for a school for the planning window.
 * meals = learners * feedingDays * (how many times recipe is scheduled)
 * scheduleHits = number of (day,meal) slots using this recipe in the period
 * For simple model: each feeding day serves breakfast + lunch once →
 * if recipe is breakfast, hits = feedingDays; if we map recipes per weekday cycle,
 * hits = feedingDays * (slots_per_week / 5) approximately.
 *
 * scheduleHitsPerWeek: how many times this recipe appears Mon–Fri (e.g. 1 for daily lunch, 5 for every day)
 */
export function schoolMealPortions(opts: {
  learners: number;
  feedingDays: number;
  /** times this recipe is served per 5-day school week */
  servesPerWeek?: number;
  portionLearners?: number;
}): number {
  const learners = Math.max(0, Number(opts.learners) || 0);
  const days = Math.max(0, Number(opts.feedingDays) || 0);
  const servesPerWeek = Math.max(0, Number(opts.servesPerWeek ?? 5));
  const base = Math.max(0.0001, Number(opts.portionLearners) || 1);
  // scale week pattern across calendar feeding days
  const weeks = days / 5;
  const servings = learners * servesPerWeek * weeks;
  return Math.round((servings / base) * 100) / 100;
}

export type MrpLine = {
  approved_product_id: number | null;
  product_name: string;
  brand_name: string | null;
  category: string;
  uom: string;
  qty: number;
  estimated_cost_zar: number | null;
};

export type MpsSlice = {
  meal_type: string;
  recipe_id: number;
  recipe_name: string;
  portions: number;
  meals: number; // = portions * portion_learners ≈ learner-meals
};

export function explodeRecipeMrp(
  recipe: Recipe,
  portions: number,
  priceByCategory: Map<string, number>
): MrpLine[] {
  const out: MrpLine[] = [];
  for (const line of recipe.lines || []) {
    const raw =
      Number(line.qty_per_portion || 0) * Math.max(0, portions);
    const qty = qtyWithWastage(raw, line.wastage_pct);
    const cat = String(line.category || 'other').toLowerCase() || 'other';
    const price = priceByCategory.get(cat);
    const cost =
      price != null && Number.isFinite(price)
        ? Math.round(qty * price * 100) / 100
        : null;
    out.push({
      approved_product_id: line.approved_product_id,
      product_name: line.product_name,
      brand_name: line.brand_name || null,
      category: cat,
      uom: line.uom || 'kg',
      qty: Math.round(qty * 1000) / 1000,
      estimated_cost_zar: cost,
    });
  }
  return out;
}

export function mergeMrpLines(lines: MrpLine[]): MrpLine[] {
  const map = new Map<string, MrpLine>();
  for (const l of lines) {
    const key = `${l.approved_product_id || l.product_name}|${l.uom}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...l });
      continue;
    }
    prev.qty = Math.round((prev.qty + l.qty) * 1000) / 1000;
    if (prev.estimated_cost_zar != null || l.estimated_cost_zar != null) {
      prev.estimated_cost_zar =
        Math.round(
          ((prev.estimated_cost_zar || 0) + (l.estimated_cost_zar || 0)) * 100
        ) / 100;
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.product_name.localeCompare(b.product_name)
  );
}

export function rollupMrpByCategory(lines: MrpLine[]): Array<{
  category: string;
  qty: number;
  estimated_cost_zar: number;
}> {
  const map = new Map<string, { qty: number; cost: number }>();
  for (const l of lines) {
    const c = l.category || 'other';
    const prev = map.get(c) || { qty: 0, cost: 0 };
    prev.qty += l.qty;
    prev.cost += l.estimated_cost_zar || 0;
    map.set(c, prev);
  }
  return Array.from(map.entries())
    .map(([category, v]) => ({
      category,
      qty: Math.round(v.qty * 1000) / 1000,
      estimated_cost_zar: Math.round(v.cost * 100) / 100,
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

export type SchoolPlan = {
  school_profile_id: number;
  school_name: string;
  emis_number?: string | null;
  district?: string | null;
  learners: number;
  mps: MpsSlice[];
  total_meals: number;
  mrp: MrpLine[];
  mrp_by_category: Array<{
    category: string;
    qty: number;
    estimated_cost_zar: number;
  }>;
  estimated_cost_zar: number;
};

export type SpPlan = {
  isp_profile_id: number;
  isp_name: string;
  school_count: number;
  learners: number;
  total_meals: number;
  schools: Array<{ school_profile_id: number; school_name: string; learners: number }>;
  mrp: MrpLine[];
  mrp_by_category: Array<{
    category: string;
    qty: number;
    estimated_cost_zar: number;
  }>;
  estimated_cost_zar: number;
};

export type ProgrammePlan = {
  period_from: string;
  period_to: string;
  feeding_days: number;
  /** true when day count came from published/draft DBE calendar */
  feeding_days_from_calendar?: boolean;
  total_learners: number;
  total_meals: number;
  school_count: number;
  mps: MpsSlice[];
  mrp: MrpLine[];
  mrp_by_category: Array<{
    category: string;
    qty: number;
    estimated_cost_zar: number;
    budget_amount_zar?: number;
    variance_zar?: number;
  }>;
  estimated_cost_zar: number;
  budget_total_zar: number;
  budget_variance_zar: number;
  schools: SchoolPlan[];
  service_providers: SpPlan[];
};

/**
 * Build full programme plan from recipes + schedule frequency + schools.
 * recipeSchedule: list of { recipe, servesPerWeek }
 * Prefer DBE feeding calendar dates when provided.
 */
export function buildProgrammePlan(opts: {
  period_from: string;
  period_to: string;
  includeWeekends?: boolean;
  /** ISO dates that are feeding days (from nsnp_feeding_calendar_days) */
  feedingDates?: Set<string> | null;
  recipes: Array<{ recipe: Recipe; servesPerWeek: number }>;
  schools: SchoolLearners[];
  /** isp_profile_id → display name */
  ispNames?: Map<number, string>;
  budgets?: CategoryBudget[];
}): ProgrammePlan {
  const feeding_days = countFeedingDays(
    opts.period_from,
    opts.period_to,
    opts.includeWeekends,
    opts.feedingDates
  );

  const priceByCategory = new Map<string, number>();
  const budgetByCategory = new Map<string, number>();
  for (const b of opts.budgets || []) {
    const cat = String(b.category || '').toLowerCase();
    if (b.unit_price_zar != null) priceByCategory.set(cat, Number(b.unit_price_zar));
    budgetByCategory.set(
      cat,
      (budgetByCategory.get(cat) || 0) + Number(b.budget_amount_zar || 0)
    );
  }

  const schoolPlans: SchoolPlan[] = [];
  for (const s of opts.schools) {
    const mps: MpsSlice[] = [];
    let mrpLines: MrpLine[] = [];
    let totalMeals = 0;
    for (const { recipe, servesPerWeek } of opts.recipes) {
      if (!recipe.active && recipe.active !== undefined) continue;
      const portions = schoolMealPortions({
        learners: s.learners,
        feedingDays: feeding_days,
        servesPerWeek,
        portionLearners: recipe.portion_learners,
      });
      const meals = Math.round(
        portions * Math.max(0.0001, recipe.portion_learners) * 100
      ) / 100;
      totalMeals += meals;
      mps.push({
        meal_type: recipe.meal_type,
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        portions,
        meals,
      });
      mrpLines = mrpLines.concat(
        explodeRecipeMrp(recipe, portions, priceByCategory)
      );
    }
    const mrp = mergeMrpLines(mrpLines);
    const mrp_by_category = rollupMrpByCategory(mrp);
    const estimated_cost_zar =
      Math.round(
        mrp_by_category.reduce((n, c) => n + c.estimated_cost_zar, 0) * 100
      ) / 100;
    schoolPlans.push({
      school_profile_id: s.school_profile_id,
      school_name: s.school_name,
      emis_number: s.emis_number,
      district: s.district,
      learners: s.learners,
      mps,
      total_meals: Math.round(totalMeals * 100) / 100,
      mrp,
      mrp_by_category,
      estimated_cost_zar,
    });
  }

  // Programme totals
  const programmeMrp = mergeMrpLines(schoolPlans.flatMap((s) => s.mrp));
  const programmeMpsMap = new Map<string, MpsSlice>();
  for (const s of schoolPlans) {
    for (const m of s.mps) {
      const key = `${m.recipe_id}`;
      const prev = programmeMpsMap.get(key);
      if (!prev) {
        programmeMpsMap.set(key, { ...m });
      } else {
        prev.portions = Math.round((prev.portions + m.portions) * 100) / 100;
        prev.meals = Math.round((prev.meals + m.meals) * 100) / 100;
      }
    }
  }

  const mrp_by_category_raw = rollupMrpByCategory(programmeMrp);
  const mrp_by_category = mrp_by_category_raw.map((c) => {
    const budget = budgetByCategory.get(c.category) || 0;
    return {
      ...c,
      budget_amount_zar: budget,
      variance_zar: Math.round((budget - c.estimated_cost_zar) * 100) / 100,
    };
  });

  const budget_total_zar =
    Math.round(
      Array.from(budgetByCategory.values()).reduce((a, b) => a + b, 0) * 100
    ) / 100;
  const estimated_cost_zar =
    Math.round(
      mrp_by_category.reduce((n, c) => n + c.estimated_cost_zar, 0) * 100
    ) / 100;

  // SP rollups
  const spMap = new Map<
    number,
    {
      schools: SchoolPlan[];
      name: string;
    }
  >();
  for (const s of opts.schools) {
    for (const ispId of s.isp_profile_ids || []) {
      if (!Number.isFinite(ispId)) continue;
      const bucket = spMap.get(ispId) || {
        schools: [],
        name: opts.ispNames?.get(ispId) || `SP ${ispId}`,
      };
      const plan = schoolPlans.find(
        (p) => p.school_profile_id === s.school_profile_id
      );
      if (plan) bucket.schools.push(plan);
      spMap.set(ispId, bucket);
    }
  }

  const service_providers: SpPlan[] = Array.from(spMap.entries()).map(
    ([isp_profile_id, bucket]) => {
      const mrp = mergeMrpLines(bucket.schools.flatMap((s) => s.mrp));
      const mrp_by_category = rollupMrpByCategory(mrp);
      const estimated_cost_zar =
        Math.round(
          mrp_by_category.reduce((n, c) => n + c.estimated_cost_zar, 0) * 100
        ) / 100;
      return {
        isp_profile_id,
        isp_name: bucket.name,
        school_count: bucket.schools.length,
        learners: bucket.schools.reduce((n, s) => n + s.learners, 0),
        total_meals: Math.round(
          bucket.schools.reduce((n, s) => n + s.total_meals, 0) * 100
        ) / 100,
        schools: bucket.schools.map((s) => ({
          school_profile_id: s.school_profile_id,
          school_name: s.school_name,
          learners: s.learners,
        })),
        mrp,
        mrp_by_category,
        estimated_cost_zar,
      };
    }
  );

  return {
    period_from: opts.period_from,
    period_to: opts.period_to,
    feeding_days,
    feeding_days_from_calendar: Boolean(opts.feedingDates),
    total_learners: opts.schools.reduce((n, s) => n + s.learners, 0),
    total_meals:
      Math.round(
        schoolPlans.reduce((n, s) => n + s.total_meals, 0) * 100
      ) / 100,
    school_count: schoolPlans.length,
    mps: Array.from(programmeMpsMap.values()),
    mrp: programmeMrp,
    mrp_by_category,
    estimated_cost_zar,
    budget_total_zar,
    budget_variance_zar:
      Math.round((budget_total_zar - estimated_cost_zar) * 100) / 100,
    schools: schoolPlans.sort((a, b) =>
      a.school_name.localeCompare(b.school_name)
    ),
    service_providers: service_providers.sort((a, b) =>
      a.isp_name.localeCompare(b.isp_name)
    ),
  };
}

export function schoolLearnerCount(row: Record<string, unknown>): number {
  const candidates = [
    row.final_nsnp_approved_enrol,
    row.learner_count_nsnp_eligible,
    row.learner_count_enrolled,
    row.learner_count_verified,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return 0;
}
