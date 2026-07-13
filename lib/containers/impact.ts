/**
 * Food security & jobs impact model for deployed containers.
 *
 * Jobs = direct (operators) + support (attributed logistics/packing).
 * People fed = from sales revenue ÷ avg meal price × people per meal
 *            (or sales transaction count × people per sale).
 *
 * Assumptions are company-configurable; containers may override.
 */

export type ImpactSettings = {
  jobs_direct_default: number;
  jobs_support_default: number;
  avg_meal_price_zar: number;
  people_per_meal: number;
  people_per_sale_txn: number;
  people_method: 'revenue' | 'transactions' | 'both_max';
  currency: string;
  methodology_notes?: string | null;
};

export const DEFAULT_IMPACT_SETTINGS: ImpactSettings = {
  jobs_direct_default: 1,
  jobs_support_default: 0.5,
  avg_meal_price_zar: 45,
  people_per_meal: 1,
  people_per_sale_txn: 2.5,
  people_method: 'revenue',
  currency: 'ZAR',
  methodology_notes:
    'Jobs: 1 operator when staffed + 0.5 support roles attributed per outlet. People fed: sales revenue ÷ average meal price (R45). Transparent assumptions — adjust in impact settings.',
};

export type ContainerImpactInput = {
  id: number;
  name: string;
  container_code?: string | null;
  status?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contractor_id?: number | null;
  assigned_contractor?: string | null;
  impact_jobs_direct?: number | null;
  impact_jobs_support?: number | null;
  impact_people_per_sale?: number | null;
  impact_avg_meal_price?: number | null;
  is_active?: boolean | null;
};

export type SaleAgg = {
  container_id: number;
  gross_amount: number;
  sale_count: number;
  item_qty: number;
};

export type ContainerImpactRow = {
  container_id: number;
  name: string;
  code: string;
  status: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  staffed: boolean;
  contractor_name: string | null;
  jobs_direct: number;
  jobs_support: number;
  jobs_total: number;
  sales_revenue: number;
  sales_count: number;
  item_qty: number;
  people_fed: number;
  people_fed_from_revenue: number;
  people_fed_from_txns: number;
  avg_meal_price: number;
  mapped: boolean;
  /** Live stock-on-hand from container_inventory */
  stock_qty: number;
  stock_skus: number;
  stock_low: number;
  stock_value: number;
  stock_top?: Array<{
    product_name: string;
    sku: string | null;
    qty: number;
    unit: string;
    low: boolean;
  }>;
};

export type ImpactTotals = {
  containers: number;
  staffed: number;
  mapped: number;
  jobs_direct: number;
  jobs_support: number;
  jobs_total: number;
  sales_revenue: number;
  sales_count: number;
  people_fed: number;
  people_fed_per_job: number | null;
  stock_qty: number;
  stock_skus: number;
  stock_low: number;
  stock_value: number;
  containers_with_stock: number;
};

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeSettings(
  row?: Partial<ImpactSettings> | null
): ImpactSettings {
  if (!row) return { ...DEFAULT_IMPACT_SETTINGS };
  const method = String(row.people_method || 'revenue');
  return {
    jobs_direct_default: num(row.jobs_direct_default, 1),
    jobs_support_default: num(row.jobs_support_default, 0.5),
    avg_meal_price_zar: Math.max(1, num(row.avg_meal_price_zar, 45)),
    people_per_meal: Math.max(0, num(row.people_per_meal, 1)),
    people_per_sale_txn: Math.max(0, num(row.people_per_sale_txn, 2.5)),
    people_method:
      method === 'transactions' || method === 'both_max'
        ? method
        : 'revenue',
    currency: row.currency || 'ZAR',
    methodology_notes:
      row.methodology_notes ?? DEFAULT_IMPACT_SETTINGS.methodology_notes,
  };
}

export function computeContainerImpact(
  c: ContainerImpactInput,
  sales: SaleAgg | undefined,
  settings: ImpactSettings
): ContainerImpactRow {
  const staffed = Boolean(
    c.contractor_id ||
      (c.assigned_contractor && String(c.assigned_contractor).trim())
  );

  const jobs_direct =
    c.impact_jobs_direct != null && Number.isFinite(Number(c.impact_jobs_direct))
      ? Number(c.impact_jobs_direct)
      : staffed
        ? settings.jobs_direct_default
        : 0;

  const jobs_support =
    c.impact_jobs_support != null &&
    Number.isFinite(Number(c.impact_jobs_support))
      ? Number(c.impact_jobs_support)
      : staffed || (c.is_active !== false)
        ? settings.jobs_support_default
        : 0;

  const sales_revenue = sales?.gross_amount || 0;
  const sales_count = sales?.sale_count || 0;
  const item_qty = sales?.item_qty || 0;

  const mealPrice =
    c.impact_avg_meal_price != null &&
    Number(c.impact_avg_meal_price) > 0
      ? Number(c.impact_avg_meal_price)
      : settings.avg_meal_price_zar;

  const peoplePerSale =
    c.impact_people_per_sale != null &&
    Number(c.impact_people_per_sale) >= 0
      ? Number(c.impact_people_per_sale)
      : settings.people_per_sale_txn;

  const people_fed_from_revenue =
    mealPrice > 0
      ? (sales_revenue / mealPrice) * settings.people_per_meal
      : 0;

  const people_fed_from_txns = sales_count * peoplePerSale;

  let people_fed = people_fed_from_revenue;
  if (settings.people_method === 'transactions') {
    people_fed = people_fed_from_txns;
  } else if (settings.people_method === 'both_max') {
    people_fed = Math.max(people_fed_from_revenue, people_fed_from_txns);
  }

  const lat = c.latitude != null ? Number(c.latitude) : null;
  const lng = c.longitude != null ? Number(c.longitude) : null;
  const mapped =
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  return {
    container_id: Number(c.id),
    name: c.name || 'Outlet',
    code: String(c.container_code || ''),
    status: c.status ?? null,
    city: c.city ?? null,
    province: c.province ?? null,
    country: c.country ?? null,
    latitude: mapped ? lat : null,
    longitude: mapped ? lng : null,
    staffed,
    contractor_name: c.assigned_contractor
      ? String(c.assigned_contractor)
      : null,
    jobs_direct: round1(jobs_direct),
    jobs_support: round1(jobs_support),
    jobs_total: round1(jobs_direct + jobs_support),
    sales_revenue: round2(sales_revenue),
    sales_count,
    item_qty: round1(item_qty),
    people_fed: Math.round(people_fed),
    people_fed_from_revenue: Math.round(people_fed_from_revenue),
    people_fed_from_txns: Math.round(people_fed_from_txns),
    avg_meal_price: mealPrice,
    mapped,
    stock_qty: 0,
    stock_skus: 0,
    stock_low: 0,
    stock_value: 0,
  };
}

export function sumImpact(rows: ContainerImpactRow[]): ImpactTotals {
  const jobs_direct = rows.reduce((s, r) => s + r.jobs_direct, 0);
  const jobs_support = rows.reduce((s, r) => s + r.jobs_support, 0);
  const jobs_total = rows.reduce((s, r) => s + r.jobs_total, 0);
  const people_fed = rows.reduce((s, r) => s + r.people_fed, 0);
  const stock_qty = rows.reduce((s, r) => s + (r.stock_qty || 0), 0);
  const stock_skus = rows.reduce((s, r) => s + (r.stock_skus || 0), 0);
  const stock_low = rows.reduce((s, r) => s + (r.stock_low || 0), 0);
  const stock_value = rows.reduce((s, r) => s + (r.stock_value || 0), 0);
  return {
    containers: rows.length,
    staffed: rows.filter((r) => r.staffed).length,
    mapped: rows.filter((r) => r.mapped).length,
    jobs_direct: round1(jobs_direct),
    jobs_support: round1(jobs_support),
    jobs_total: round1(jobs_total),
    sales_revenue: round2(rows.reduce((s, r) => s + r.sales_revenue, 0)),
    sales_count: rows.reduce((s, r) => s + r.sales_count, 0),
    people_fed,
    people_fed_per_job:
      jobs_total > 0 ? Math.round(people_fed / jobs_total) : null,
    stock_qty: round1(stock_qty),
    stock_skus,
    stock_low,
    stock_value: round2(stock_value),
    containers_with_stock: rows.filter((r) => (r.stock_qty || 0) > 0).length,
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Aggregate sales by container from raw sale rows */
export function aggregateSalesByContainer(
  sales: Array<Record<string, unknown>>
): Map<number, SaleAgg> {
  const map = new Map<number, SaleAgg>();
  for (const s of sales) {
    const cid = Number(s.container_id);
    if (!Number.isFinite(cid)) continue;
    if (!map.has(cid)) {
      map.set(cid, {
        container_id: cid,
        gross_amount: 0,
        sale_count: 0,
        item_qty: 0,
      });
    }
    const m = map.get(cid)!;
    m.gross_amount += Number(s.gross_amount || s.net_amount || 0);
    m.sale_count += 1;
    const items = s.items;
    if (Array.isArray(items)) {
      for (const it of items) {
        const q = Number(
          (it as { quantity?: number; qty?: number })?.quantity ??
            (it as { qty?: number })?.qty ??
            0
        );
        if (Number.isFinite(q)) m.item_qty += q;
      }
    }
  }
  return map;
}
