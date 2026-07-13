/**
 * Container deployment feasibility model.
 *
 * Transparent, editable assumptions for a region:
 * - Demand: catchment → target segment → uptake → meals
 * - POS food sales + marketing uplift + sponsorship + other income
 * - Capex / opex / margin per meal → payback, ROI, score
 */

export type FeasibilityInputs = {
  name: string;
  region_city: string;
  region_province: string;
  region_country: string;
  currency: string;
  notes: string;

  // Demand / people
  catchment_population: number;
  /** Share of population who are potential customers (0–100) */
  target_segment_pct: number;
  /** % of target segment that buys regularly (0–100) */
  uptake_pct: number;
  meals_per_customer_per_month: number;
  avg_meal_price: number;
  /** Cost of goods sold per meal (before opex) */
  cogs_per_meal: number;
  operating_days_per_month: number;

  // Capex (one-off)
  container_cost: number;
  fit_out_cost: number;
  transport_deploy_cost: number;
  site_prep_cost: number;
  equipment_cost: number;
  working_capital_stock: number;
  other_capex: number;

  // Monthly opex
  site_rent_monthly: number;
  utilities_monthly: number;
  /** Operator commission as % of POS food sales */
  operator_commission_pct: number;
  logistics_restock_monthly: number;
  insurance_monthly: number;
  marketing_monthly: number;
  other_opex_monthly: number;

  // Additional income (monthly)
  /** Extra POS sales from marketing / activations (% of base POS) */
  marketing_sales_uplift_pct: number;
  sponsorship_income_monthly: number;
  other_income_monthly: number;

  /** Horizon for cumulative cash (months) */
  projection_months: number;
};

export const DEFAULT_FEASIBILITY_INPUTS: FeasibilityInputs = {
  name: 'New site scenario',
  region_city: '',
  region_province: '',
  region_country: 'South Africa',
  currency: 'ZAR',
  notes: '',

  catchment_population: 15000,
  target_segment_pct: 40,
  uptake_pct: 12,
  meals_per_customer_per_month: 8,
  avg_meal_price: 45,
  cogs_per_meal: 22,
  operating_days_per_month: 26,

  container_cost: 180000,
  fit_out_cost: 85000,
  transport_deploy_cost: 25000,
  site_prep_cost: 15000,
  equipment_cost: 45000,
  working_capital_stock: 35000,
  other_capex: 10000,

  site_rent_monthly: 3500,
  utilities_monthly: 2800,
  operator_commission_pct: 15,
  logistics_restock_monthly: 4500,
  insurance_monthly: 800,
  marketing_monthly: 2000,
  other_opex_monthly: 1500,

  marketing_sales_uplift_pct: 8,
  sponsorship_income_monthly: 2500,
  other_income_monthly: 500,

  projection_months: 24,
};

export type FeasibilityBand = 'not_viable' | 'marginal' | 'viable' | 'strong';

export type FeasibilityResults = {
  // Demand
  target_customers: number;
  active_customers: number;
  meals_per_month: number;
  meals_per_day: number;
  people_served_monthly: number;
  people_served_annual: number;
  uptake_effective_pct: number;

  // Unit economics
  margin_per_meal: number;
  margin_per_meal_pct: number;

  // Monthly P&L
  pos_sales_base: number;
  pos_sales_uplift: number;
  pos_sales_total: number;
  sponsorship_income: number;
  other_income: number;
  total_revenue_monthly: number;
  cogs_monthly: number;
  gross_profit_monthly: number;
  operator_commission: number;
  fixed_opex_monthly: number;
  total_opex_monthly: number;
  contribution_monthly: number;
  net_monthly: number;

  // Capital & returns
  total_capex: number;
  payback_months: number | null;
  roi_year1_pct: number | null;
  cash_year1: number;
  cash_at_horizon: number;
  break_even_meals_per_day: number | null;
  break_even_uptake_pct: number | null;

  // Score
  feasibility_score: number;
  feasibility_band: FeasibilityBand;
  feasibility_label: string;
  drivers: string[];
  risks: string[];
};

function n(v: unknown, fallback = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}

export function normalizeFeasibilityInputs(
  raw?: Partial<FeasibilityInputs> | null
): FeasibilityInputs {
  const d = DEFAULT_FEASIBILITY_INPUTS;
  if (!raw) return { ...d };
  return {
    name: String(raw.name ?? d.name).trim() || d.name,
    region_city: String(raw.region_city ?? d.region_city),
    region_province: String(raw.region_province ?? d.region_province),
    region_country: String(raw.region_country ?? d.region_country) || 'South Africa',
    currency: String(raw.currency ?? d.currency) || 'ZAR',
    notes: String(raw.notes ?? d.notes),

    catchment_population: Math.max(0, n(raw.catchment_population, d.catchment_population)),
    target_segment_pct: clamp(n(raw.target_segment_pct, d.target_segment_pct), 0, 100),
    uptake_pct: clamp(n(raw.uptake_pct, d.uptake_pct), 0, 100),
    meals_per_customer_per_month: Math.max(
      0,
      n(raw.meals_per_customer_per_month, d.meals_per_customer_per_month)
    ),
    avg_meal_price: Math.max(0, n(raw.avg_meal_price, d.avg_meal_price)),
    cogs_per_meal: Math.max(0, n(raw.cogs_per_meal, d.cogs_per_meal)),
    operating_days_per_month: Math.max(
      1,
      n(raw.operating_days_per_month, d.operating_days_per_month)
    ),

    container_cost: Math.max(0, n(raw.container_cost, d.container_cost)),
    fit_out_cost: Math.max(0, n(raw.fit_out_cost, d.fit_out_cost)),
    transport_deploy_cost: Math.max(
      0,
      n(raw.transport_deploy_cost, d.transport_deploy_cost)
    ),
    site_prep_cost: Math.max(0, n(raw.site_prep_cost, d.site_prep_cost)),
    equipment_cost: Math.max(0, n(raw.equipment_cost, d.equipment_cost)),
    working_capital_stock: Math.max(
      0,
      n(raw.working_capital_stock, d.working_capital_stock)
    ),
    other_capex: Math.max(0, n(raw.other_capex, d.other_capex)),

    site_rent_monthly: Math.max(0, n(raw.site_rent_monthly, d.site_rent_monthly)),
    utilities_monthly: Math.max(0, n(raw.utilities_monthly, d.utilities_monthly)),
    operator_commission_pct: clamp(
      n(raw.operator_commission_pct, d.operator_commission_pct),
      0,
      100
    ),
    logistics_restock_monthly: Math.max(
      0,
      n(raw.logistics_restock_monthly, d.logistics_restock_monthly)
    ),
    insurance_monthly: Math.max(0, n(raw.insurance_monthly, d.insurance_monthly)),
    marketing_monthly: Math.max(0, n(raw.marketing_monthly, d.marketing_monthly)),
    other_opex_monthly: Math.max(0, n(raw.other_opex_monthly, d.other_opex_monthly)),

    marketing_sales_uplift_pct: clamp(
      n(raw.marketing_sales_uplift_pct, d.marketing_sales_uplift_pct),
      0,
      200
    ),
    sponsorship_income_monthly: Math.max(
      0,
      n(raw.sponsorship_income_monthly, d.sponsorship_income_monthly)
    ),
    other_income_monthly: Math.max(
      0,
      n(raw.other_income_monthly, d.other_income_monthly)
    ),

    projection_months: clamp(
      Math.round(n(raw.projection_months, d.projection_months)),
      1,
      120
    ),
  };
}

export function computeFeasibility(
  raw: Partial<FeasibilityInputs> | FeasibilityInputs
): { inputs: FeasibilityInputs; results: FeasibilityResults } {
  const inputs = normalizeFeasibilityInputs(raw);

  const target_customers = Math.round(
    (inputs.catchment_population * inputs.target_segment_pct) / 100
  );
  const active_customers = Math.round(
    (target_customers * inputs.uptake_pct) / 100
  );
  const meals_per_month =
    active_customers * inputs.meals_per_customer_per_month;
  const meals_per_day =
    meals_per_month / Math.max(1, inputs.operating_days_per_month);

  // People served ≈ active customers (regular buyers); meals measure food volume
  const people_served_monthly = active_customers;
  const people_served_annual = active_customers; // unique regulars; volume is meals

  const margin_per_meal = inputs.avg_meal_price - inputs.cogs_per_meal;
  const margin_per_meal_pct =
    inputs.avg_meal_price > 0
      ? (margin_per_meal / inputs.avg_meal_price) * 100
      : 0;

  const pos_sales_base = meals_per_month * inputs.avg_meal_price;
  const pos_sales_uplift =
    (pos_sales_base * inputs.marketing_sales_uplift_pct) / 100;
  const pos_sales_total = pos_sales_base + pos_sales_uplift;

  const sponsorship_income = inputs.sponsorship_income_monthly;
  const other_income = inputs.other_income_monthly;
  const total_revenue_monthly =
    pos_sales_total + sponsorship_income + other_income;

  // COGS only on food (base + uplift meals)
  const meals_with_uplift =
    meals_per_month * (1 + inputs.marketing_sales_uplift_pct / 100);
  const cogs_monthly = meals_with_uplift * inputs.cogs_per_meal;
  const gross_profit_monthly = pos_sales_total - cogs_monthly;

  const operator_commission =
    (pos_sales_total * inputs.operator_commission_pct) / 100;

  const fixed_opex_monthly =
    inputs.site_rent_monthly +
    inputs.utilities_monthly +
    inputs.logistics_restock_monthly +
    inputs.insurance_monthly +
    inputs.marketing_monthly +
    inputs.other_opex_monthly;

  const total_opex_monthly = fixed_opex_monthly + operator_commission;

  // Contribution after food COGS + opex, before capex recovery
  const contribution_monthly =
    total_revenue_monthly - cogs_monthly - total_opex_monthly;
  const net_monthly = contribution_monthly;

  const total_capex =
    inputs.container_cost +
    inputs.fit_out_cost +
    inputs.transport_deploy_cost +
    inputs.site_prep_cost +
    inputs.equipment_cost +
    inputs.working_capital_stock +
    inputs.other_capex;

  const payback_months =
    net_monthly > 0 ? total_capex / net_monthly : null;

  const cash_year1 = net_monthly * 12 - total_capex;
  const cash_at_horizon =
    net_monthly * inputs.projection_months - total_capex;

  const roi_year1_pct =
    total_capex > 0 ? (cash_year1 / total_capex) * 100 : null;

  // Break-even: meals/day so that net = 0
  // net = (meals * price * (1+uplift) - meals*(1+uplift)*cogs - meals*price*(1+uplift)*comm/100) - fixed_opex + sponsorship + other
  // Let u = 1 + uplift/100
  // net = meals * u * (price - cogs - price*comm/100) + sponsorship + other - fixed_opex
  const u = 1 + inputs.marketing_sales_uplift_pct / 100;
  const unit_contrib =
    u *
    (inputs.avg_meal_price -
      inputs.cogs_per_meal -
      (inputs.avg_meal_price * inputs.operator_commission_pct) / 100);
  const fixed_net_of_other =
    fixed_opex_monthly - sponsorship_income - other_income;

  let break_even_meals_per_day: number | null = null;
  let break_even_uptake_pct: number | null = null;
  if (unit_contrib > 0) {
    const beMealsMonth = fixed_net_of_other / unit_contrib;
    break_even_meals_per_day = Math.max(
      0,
      beMealsMonth / Math.max(1, inputs.operating_days_per_month)
    );
    if (
      target_customers > 0 &&
      inputs.meals_per_customer_per_month > 0
    ) {
      const beActive = beMealsMonth / inputs.meals_per_customer_per_month;
      break_even_uptake_pct = clamp(
        (beActive / target_customers) * 100,
        0,
        100
      );
    }
  }

  // Score 0–100 from weighted factors
  let score = 50;
  const drivers: string[] = [];
  const risks: string[] = [];

  if (margin_per_meal_pct >= 45) {
    score += 12;
    drivers.push('Strong gross margin per meal');
  } else if (margin_per_meal_pct >= 30) {
    score += 6;
    drivers.push('Healthy meal margin');
  } else if (margin_per_meal_pct < 20) {
    score -= 15;
    risks.push('Thin margin per meal — check pricing or COGS');
  }

  if (payback_months != null) {
    if (payback_months <= 12) {
      score += 18;
      drivers.push(`Payback under 12 months (${round1(payback_months)} mo)`);
    } else if (payback_months <= 18) {
      score += 12;
      drivers.push(`Payback within 18 months (${round1(payback_months)} mo)`);
    } else if (payback_months <= 24) {
      score += 6;
      drivers.push(`Payback within 2 years (${round1(payback_months)} mo)`);
    } else if (payback_months <= 36) {
      score -= 5;
      risks.push(`Long payback (${round1(payback_months)} months)`);
    } else {
      score -= 18;
      risks.push(`Payback over 3 years (${round1(payback_months)} months)`);
    }
  } else {
    score -= 25;
    risks.push('Negative monthly cash flow — does not recover capex');
  }

  if (inputs.uptake_pct >= 15) {
    score += 8;
    drivers.push('Solid assumed uptake');
  } else if (inputs.uptake_pct < 8) {
    score -= 8;
    risks.push('Low uptake assumption — validate footfall / demand');
  }

  if (people_served_monthly >= 500) {
    score += 6;
    drivers.push('Meaningful food security reach');
  } else if (people_served_monthly < 100) {
    score -= 6;
    risks.push('Limited people served at current uptake');
  }

  if (sponsorship_income + other_income > 0) {
    score += 4;
    drivers.push('Non-POS income diversifies returns');
  }

  if (net_monthly > 0 && fixed_opex_monthly > 0) {
    const coverage = (gross_profit_monthly + sponsorship_income + other_income) /
      (total_opex_monthly || 1);
    if (coverage >= 1.5) {
      score += 6;
      drivers.push('Comfortable opex coverage from gross + other income');
    } else if (coverage < 1) {
      score -= 10;
      risks.push('Gross + other income does not cover operating costs');
    }
  }

  if (inputs.catchment_population < 5000) {
    score -= 5;
    risks.push('Small catchment population');
  }

  score = clamp(Math.round(score), 0, 100);

  let feasibility_band: FeasibilityBand;
  let feasibility_label: string;
  if (score >= 75) {
    feasibility_band = 'strong';
    feasibility_label = 'Strong deploy case';
  } else if (score >= 55) {
    feasibility_band = 'viable';
    feasibility_label = 'Viable — proceed with diligence';
  } else if (score >= 40) {
    feasibility_band = 'marginal';
    feasibility_label = 'Marginal — improve uptake, margin, or cost';
  } else {
    feasibility_band = 'not_viable';
    feasibility_label = 'Not viable under current assumptions';
  }

  const results: FeasibilityResults = {
    target_customers,
    active_customers,
    meals_per_month: round1(meals_per_month),
    meals_per_day: round1(meals_per_day),
    people_served_monthly,
    people_served_annual,
    uptake_effective_pct: round2(
      inputs.catchment_population > 0
        ? (active_customers / inputs.catchment_population) * 100
        : 0
    ),

    margin_per_meal: round2(margin_per_meal),
    margin_per_meal_pct: round1(margin_per_meal_pct),

    pos_sales_base: round2(pos_sales_base),
    pos_sales_uplift: round2(pos_sales_uplift),
    pos_sales_total: round2(pos_sales_total),
    sponsorship_income: round2(sponsorship_income),
    other_income: round2(other_income),
    total_revenue_monthly: round2(total_revenue_monthly),
    cogs_monthly: round2(cogs_monthly),
    gross_profit_monthly: round2(gross_profit_monthly),
    operator_commission: round2(operator_commission),
    fixed_opex_monthly: round2(fixed_opex_monthly),
    total_opex_monthly: round2(total_opex_monthly),
    contribution_monthly: round2(contribution_monthly),
    net_monthly: round2(net_monthly),

    total_capex: round2(total_capex),
    payback_months:
      payback_months != null ? round1(payback_months) : null,
    roi_year1_pct:
      roi_year1_pct != null ? round1(roi_year1_pct) : null,
    cash_year1: round2(cash_year1),
    cash_at_horizon: round2(cash_at_horizon),
    break_even_meals_per_day:
      break_even_meals_per_day != null
        ? round1(break_even_meals_per_day)
        : null,
    break_even_uptake_pct:
      break_even_uptake_pct != null
        ? round1(break_even_uptake_pct)
        : null,

    feasibility_score: score,
    feasibility_band,
    feasibility_label,
    drivers,
    risks,
  };

  return { inputs, results };
}

export function formatMoney(v: number, currency = 'ZAR'): string {
  const prefix = currency === 'ZAR' ? 'R' : `${currency} `;
  const abs = Math.abs(v);
  const formatted = abs.toLocaleString('en-ZA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return v < 0 ? `-${prefix}${formatted}` : `${prefix}${formatted}`;
}
