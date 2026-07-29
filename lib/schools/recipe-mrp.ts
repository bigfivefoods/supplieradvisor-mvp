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
  /** 1=Mon … 5=Fri; null = unassigned / any day */
  weekday?: number | null;
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

/** ISO weekday: 1=Mon … 7=Sun */
export function isoWeekdayFromIsoDate(iso: string): number {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  const js = d.getDay(); // 0=Sun
  return js === 0 ? 7 : js;
}

/**
 * List every feeding day (YYYY-MM-DD) in [from, to] inclusive.
 * When `feedingDates` is provided (DBE calendar), only those dates count.
 * Otherwise weekdays Mon–Fri (or all days if includeWeekends).
 */
export function listFeedingDayDates(
  from: string,
  to: string,
  includeWeekends = false,
  feedingDates?: Set<string> | null
): string[] {
  const a = new Date(`${from.slice(0, 10)}T12:00:00`);
  const b = new Date(`${to.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || a > b) {
    return [];
  }
  const out: string[] = [];
  const d = new Date(a);
  while (d <= b) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${day}`;
    if (feedingDates) {
      if (feedingDates.has(key)) out.push(key);
    } else {
      const wd = d.getDay();
      if (includeWeekends || (wd !== 0 && wd !== 6)) out.push(key);
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Count feeding days (weekdays by default) inclusive. */
export function countFeedingDays(
  from: string,
  to: string,
  includeWeekends = false,
  feedingDates?: Set<string> | null
): number {
  return listFeedingDayDates(from, to, includeWeekends, feedingDates).length;
}

/** How many feeding days fall on a given ISO weekday (1=Mon … 5=Fri). */
export function countWeekdayHits(
  feedingDays: string[],
  weekday: number
): number {
  if (!(weekday >= 1 && weekday <= 7)) return 0;
  let n = 0;
  for (const iso of feedingDays) {
    if (isoWeekdayFromIsoDate(iso) === weekday) n += 1;
  }
  return n;
}

/**
 * Integer service days for each recipe in the period.
 * - Weekday-assigned: count matching weekdays among feeding days
 * - Unassigned (same meal type): split feeding days as whole numbers (sum = feeding days)
 */
export function assignRecipeServiceDays(
  recipes: Recipe[],
  feedingDayList: string[]
): Map<number, number> {
  const totalDays = feedingDayList.length;
  const result = new Map<number, number>();
  const unassignedByMeal = new Map<string, Recipe[]>();

  for (const r of recipes) {
    if (r.active === false) continue;
    const wd = r.weekday != null ? Number(r.weekday) : NaN;
    if (Number.isFinite(wd) && wd >= 1 && wd <= 5) {
      result.set(r.id, countWeekdayHits(feedingDayList, wd));
    } else {
      const mt = String(r.meal_type || 'lunch').toLowerCase();
      const list = unassignedByMeal.get(mt) || [];
      list.push(r);
      unassignedByMeal.set(mt, list);
    }
  }

  for (const [, list] of unassignedByMeal) {
    const n = list.length;
    if (!n) continue;
    // Equal whole-number shares; remainder to first recipes so sum === totalDays
    const base = Math.floor(totalDays / n);
    let rem = totalDays % n;
    for (const r of list) {
      const days = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem -= 1;
      result.set(r.id, days);
    }
  }

  return result;
}

/** qty with wastage: qty * (1 + wastage_pct/100) */
export function qtyWithWastage(qty: number, wastagePct = 0): number {
  const w = Math.max(0, Number(wastagePct) || 0);
  return Math.round(qty * (1 + w / 100) * 1e6) / 1e6;
}

/**
 * Recipe portions for a school in the planning window.
 * meals (learner-servings) = learners × serviceDays (always whole when portion_learners = 1).
 * serviceDays = integer times this recipe is served in the period (not days/5).
 */
export function schoolMealPortions(opts: {
  learners: number;
  /** Integer: how many times this recipe is plated in the period */
  serviceDays: number;
  /** @deprecated use serviceDays — kept for call-site migration */
  feedingDays?: number;
  /** @deprecated use serviceDays */
  servesPerWeek?: number;
  portionLearners?: number;
}): number {
  const learners = Math.max(0, Math.round(Number(opts.learners) || 0));
  let serviceDays = opts.serviceDays;
  if (serviceDays == null || !Number.isFinite(Number(serviceDays))) {
    // Legacy fallback: never leave fractional meals when possible
    const days = Math.max(0, Number(opts.feedingDays) || 0);
    const spw = Math.max(0, Number(opts.servesPerWeek ?? 5));
    serviceDays = Math.round((days * spw) / 5);
  }
  serviceDays = Math.max(0, Math.round(Number(serviceDays) || 0));
  const base = Math.max(0.0001, Number(opts.portionLearners) || 1);
  // Whole learner-meals, then portions if recipe feeds >1 learner per batch
  const learnerMeals = learners * serviceDays;
  if (base === 1) return learnerMeals;
  return Math.round((learnerMeals / base) * 100) / 100;
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
  meals: number; // whole learner-meals = learners × service_days (when portion=1)
  /** How many times this recipe is served in the period (integer) */
  service_days?: number;
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
 * Build full programme plan from recipes + schools.
 * Meals = learners × integer service days per recipe (never fractional weeks).
 * Prefer DBE feeding calendar dates when provided.
 */
export function buildProgrammePlan(opts: {
  period_from: string;
  period_to: string;
  includeWeekends?: boolean;
  /** ISO dates that are feeding days (from nsnp_feeding_calendar_days) */
  feedingDates?: Set<string> | null;
  /** Prefer serviceDays; servesPerWeek kept for backward compatibility */
  recipes: Array<{
    recipe: Recipe;
    serviceDays?: number;
    servesPerWeek?: number;
  }>;
  schools: SchoolLearners[];
  /** isp_profile_id → display name */
  ispNames?: Map<number, string>;
  budgets?: CategoryBudget[];
}): ProgrammePlan {
  const feedingDayList = listFeedingDayDates(
    opts.period_from,
    opts.period_to,
    opts.includeWeekends,
    opts.feedingDates
  );
  const feeding_days = feedingDayList.length;

  // Auto-assign integer service days from weekdays when not provided
  const autoDays = assignRecipeServiceDays(
    opts.recipes.map((x) => x.recipe),
    feedingDayList
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
    for (const entry of opts.recipes) {
      const { recipe } = entry;
      if (!recipe.active && recipe.active !== undefined) continue;
      let serviceDays =
        entry.serviceDays != null
          ? Math.max(0, Math.round(Number(entry.serviceDays) || 0))
          : autoDays.get(recipe.id);
      if (serviceDays == null && entry.servesPerWeek != null) {
        serviceDays = Math.round(
          (feeding_days * Number(entry.servesPerWeek)) / 5
        );
      }
      serviceDays = Math.max(0, Math.round(Number(serviceDays) || 0));

      const portions = schoolMealPortions({
        learners: s.learners,
        serviceDays,
        portionLearners: recipe.portion_learners,
      });
      // Whole learner-meals
      const meals = Math.round(
        portions * Math.max(0.0001, recipe.portion_learners)
      );
      totalMeals += meals;
      mps.push({
        meal_type: recipe.meal_type,
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        portions,
        meals,
        service_days: serviceDays,
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
      total_meals: Math.round(totalMeals),
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
        prev.meals = Math.round(prev.meals + m.meals);
        if (m.service_days != null) {
          // service_days is calendar days for the recipe (same for each school) — keep first
          prev.service_days = prev.service_days ?? m.service_days;
        }
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
    total_meals: Math.round(
      schoolPlans.reduce((n, s) => n + s.total_meals, 0)
    ),
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
