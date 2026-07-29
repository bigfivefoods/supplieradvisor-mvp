/**
 * Kitchen stock cover planning for NSNP schools.
 * Demand from programme recipes (qty/learner) × NSNP learners × weekly pattern.
 * Cover days → target holding, reorder point, suggested PO qty.
 */

import type { Recipe } from '@/lib/schools/recipe-mrp';
import { qtyWithWastage } from '@/lib/schools/recipe-mrp';

export type StockCoverPolicy = {
  /** Days of stock the kitchen wants to hold (target cover) */
  cover_days: number;
  /** Reorder when days of cover on hand fall to this or below */
  reorder_cover_days: number;
  /** Optional lead time used for messaging only */
  lead_time_days: number;
};

export const DEFAULT_STOCK_COVER: StockCoverPolicy = {
  cover_days: 14,
  reorder_cover_days: 5,
  lead_time_days: 3,
};

/**
 * Whole-number stock quantities by UOM (kitchen-friendly).
 * - Countable (unit, tin, bag, pack, …): whole pieces (ceil for order/target).
 * - Mass/volume (kg, g, L, ml, …): whole UOM units (ceil for order/target).
 * - On-hand display: nearest whole (not forced up).
 */
export function isCountableUom(uom?: string | null): boolean {
  const u = String(uom || '')
    .trim()
    .toLowerCase();
  if (!u) return false;
  return /^(unit|units|ea|each|pc|pcs|piece|pieces|tin|tins|bag|bags|pack|packs|box|boxes|case|cases|loaf|loaves|tray|trays|bottle|bottles|sachet|sachets|portion|portions|item|items)$/i.test(
    u
  );
}

/** Round stock qty to a whole number for the UOM. mode: floor | round | ceil */
export function roundStockQty(
  qty: number,
  uom?: string | null,
  mode: 'floor' | 'round' | 'ceil' = 'round'
): number {
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) return 0;
  // All kitchen levels/orders use whole UOM units (kg, g, tin, bag, …)
  if (mode === 'ceil') return Math.max(0, Math.ceil(n - 1e-9));
  if (mode === 'floor') return Math.max(0, Math.floor(n + 1e-9));
  return Math.max(0, Math.round(n));
}

/** Format for inputs/display — always whole number string */
export function formatStockQty(
  qty: number | string | null | undefined,
  uom?: string | null,
  mode: 'floor' | 'round' | 'ceil' = 'round'
): string {
  const n = roundStockQty(Number(qty) || 0, uom, mode);
  return String(n);
}

export type ProductDemand = {
  approved_product_id: number;
  product_name: string;
  brand_name: string;
  category: string;
  uom: string;
  /** Average quantity used per feeding day (1 learner portion scale × learners) */
  daily_usage: number;
  weekly_usage: number;
  /** How many times/week product appears via recipes (sum of recipe hits) */
  serves_per_week: number;
};

export type ProductStockPlan = ProductDemand & {
  qty_on_hand: number;
  days_on_hand: number | null;
  target_qty: number;
  reorder_level: number;
  suggested_order_qty: number;
  status: 'ok' | 'reorder' | 'critical' | 'no_demand' | 'overstock';
  message: string;
};

export type KitchenStockPlan = {
  learners: number;
  policy: StockCoverPolicy;
  feeding_days_per_week: number;
  products: ProductStockPlan[];
  summary: {
    products_with_demand: number;
    reorder_count: number;
    critical_count: number;
    suggested_lines: number;
  };
};

/** Serves-per-week for a recipe: weekday → 1; unassigned → share of 5 by meal type */
function servesPerWeekMap(recipes: Recipe[]): Map<number, number> {
  const map = new Map<number, number>();
  const unassigned = new Map<string, Recipe[]>();
  for (const r of recipes) {
    if (r.active === false) continue;
    const wd = r.weekday != null ? Number(r.weekday) : NaN;
    if (Number.isFinite(wd) && wd >= 1 && wd <= 5) {
      map.set(r.id, 1);
    } else {
      const mt = String(r.meal_type || 'lunch').toLowerCase();
      const list = unassigned.get(mt) || [];
      list.push(r);
      unassigned.set(mt, list);
    }
  }
  for (const [, list] of unassigned) {
    const each = list.length ? 5 / list.length : 0;
    for (const r of list) map.set(r.id, each);
  }
  return map;
}

/**
 * Explode active recipes × learners into average daily product usage.
 */
export function buildProductDemand(opts: {
  recipes: Recipe[];
  learners: number;
}): ProductDemand[] {
  const learners = Math.max(0, Math.round(Number(opts.learners) || 0));
  const spw = servesPerWeekMap(opts.recipes);
  const byProduct = new Map<
    number,
    {
      product_name: string;
      brand_name: string;
      category: string;
      uom: string;
      weekly: number;
      serves: number;
    }
  >();

  for (const recipe of opts.recipes) {
    if (recipe.active === false) continue;
    const hits = spw.get(recipe.id) ?? 0;
    if (!(hits > 0)) continue;
    const portionBase = Math.max(0.0001, Number(recipe.portion_learners) || 1);
    // portions per week for the school
    const portionsPerWeek = (learners * hits) / portionBase;

    for (const line of recipe.lines || []) {
      const pid = Number(line.approved_product_id);
      if (!Number.isFinite(pid) || pid <= 0) continue;
      const raw = Number(line.qty_per_portion || 0) * portionsPerWeek;
      const qty = qtyWithWastage(raw, line.wastage_pct);
      const prev = byProduct.get(pid);
      if (!prev) {
        byProduct.set(pid, {
          product_name: String(line.product_name || 'Product'),
          brand_name: String(line.brand_name || ''),
          category: String(line.category || 'other'),
          uom: String(line.uom || 'kg'),
          weekly: qty,
          serves: hits,
        });
      } else {
        prev.weekly += qty;
        prev.serves += hits;
        if (!prev.brand_name && line.brand_name) {
          prev.brand_name = String(line.brand_name);
        }
      }
    }
  }

  const out: ProductDemand[] = [];
  for (const [pid, v] of byProduct) {
    const weekly = Math.round(v.weekly * 1000) / 1000;
    const daily = Math.round((weekly / 5) * 1000) / 1000;
    out.push({
      approved_product_id: pid,
      product_name: v.product_name,
      brand_name: v.brand_name,
      category: v.category,
      uom: v.uom,
      daily_usage: daily,
      weekly_usage: weekly,
      serves_per_week: Math.round(v.serves * 100) / 100,
    });
  }
  return out.sort((a, b) =>
    a.product_name.localeCompare(b.product_name)
  );
}

export function normalizeCoverPolicy(
  raw?: Partial<StockCoverPolicy> | null
): StockCoverPolicy {
  const cover = Math.max(
    1,
    Math.min(90, Math.round(Number(raw?.cover_days) || DEFAULT_STOCK_COVER.cover_days))
  );
  let reorder = Math.max(
    0,
    Math.min(
      cover,
      Math.round(
        Number(raw?.reorder_cover_days) ?? DEFAULT_STOCK_COVER.reorder_cover_days
      )
    )
  );
  if (reorder > cover) reorder = cover;
  const lead = Math.max(
    0,
    Math.min(
      30,
      Math.round(
        Number(raw?.lead_time_days) ?? DEFAULT_STOCK_COVER.lead_time_days
      )
    )
  );
  return {
    cover_days: cover,
    reorder_cover_days: reorder,
    lead_time_days: lead,
  };
}

/**
 * Combine demand + on-hand into cover plan and suggested order quantities.
 */
export function buildKitchenStockPlan(opts: {
  recipes: Recipe[];
  learners: number;
  policy?: Partial<StockCoverPolicy> | null;
  /** on-hand by approved_product_id */
  onHandByProduct?: Map<number, number> | Record<number, number>;
  /** optional product list to include zero-demand catalogue rows */
  catalogue?: Array<{
    id: number;
    name: string;
    brand_name?: string | null;
    category?: string | null;
    uom?: string | null;
  }>;
}): KitchenStockPlan {
  const policy = normalizeCoverPolicy(opts.policy);
  const learners = Math.max(0, Math.round(Number(opts.learners) || 0));
  const demand = buildProductDemand({
    recipes: opts.recipes,
    learners,
  });

  const onHand = new Map<number, number>();
  if (opts.onHandByProduct instanceof Map) {
    for (const [k, v] of opts.onHandByProduct) onHand.set(k, Number(v) || 0);
  } else if (opts.onHandByProduct) {
    for (const [k, v] of Object.entries(opts.onHandByProduct)) {
      onHand.set(Number(k), Number(v) || 0);
    }
  }

  const demandById = new Map(demand.map((d) => [d.approved_product_id, d]));

  // Ensure catalogue products appear even with no demand
  if (opts.catalogue?.length) {
    for (const p of opts.catalogue) {
      if (demandById.has(p.id)) continue;
      demandById.set(p.id, {
        approved_product_id: p.id,
        product_name: p.name,
        brand_name: String(p.brand_name || ''),
        category: String(p.category || 'other'),
        uom: String(p.uom || 'kg'),
        daily_usage: 0,
        weekly_usage: 0,
        serves_per_week: 0,
      });
    }
  }

  const products: ProductStockPlan[] = [];
  for (const d of [...demandById.values()].sort((a, b) =>
    a.product_name.localeCompare(b.product_name)
  )) {
    const uom = d.uom || 'kg';
    // On-hand: whole UOM (nearest); targets/orders: whole UOM rounded up
    const qty = roundStockQty(
      Math.max(0, Number(onHand.get(d.approved_product_id)) || 0),
      uom,
      'round'
    );
    const dailyRaw = d.daily_usage;
    // Keep a small daily precision for days-left maths, then whole levels
    const daily = dailyRaw > 0 ? dailyRaw : 0;
    const target_qty =
      daily > 0
        ? roundStockQty(daily * policy.cover_days, uom, 'ceil')
        : 0;
    const reorder_level =
      daily > 0
        ? roundStockQty(daily * policy.reorder_cover_days, uom, 'ceil')
        : 0;
    // Never let reorder sit above target
    const reorderAdj =
      target_qty > 0 ? Math.min(reorder_level, target_qty) : reorder_level;
    const days_on_hand =
      daily > 0 ? Math.round((qty / daily) * 10) / 10 : null;
    let suggested = 0;
    if (daily > 0) {
      suggested = roundStockQty(
        Math.max(0, target_qty - qty),
        uom,
        'ceil'
      );
    }

    // Whole daily usage for display/messages (1 decimal if tiny, else whole)
    const dailyDisplay =
      daily <= 0
        ? 0
        : daily < 1
          ? Math.round(daily * 10) / 10
          : roundStockQty(daily, uom, 'ceil') ||
            Math.max(1, Math.round(daily));

    let status: ProductStockPlan['status'] = 'no_demand';
    let message = 'Not on current recipe menu — no estimated daily use';
    if (daily > 0) {
      if (days_on_hand != null && days_on_hand <= Math.max(1, policy.lead_time_days)) {
        status = 'critical';
        message = `Only ~${days_on_hand} day(s) left — order urgently (lead time ${policy.lead_time_days}d)`;
      } else if (
        qty <= reorderAdj ||
        (days_on_hand != null && days_on_hand <= policy.reorder_cover_days)
      ) {
        status = 'reorder';
        message = `At/below ${policy.reorder_cover_days}-day reorder cover — suggested order ${suggested} ${uom}`;
      } else if (target_qty > 0 && qty > target_qty * 1.25) {
        status = 'overstock';
        message = `Above ${policy.cover_days}-day target holding`;
      } else {
        status = 'ok';
        message = `~${days_on_hand} day(s) on hand · target ${policy.cover_days} days (${target_qty} ${uom})`;
      }
    } else if (qty > 0) {
      status = 'ok';
      message = 'On hand but no recipe demand this week';
    }

    products.push({
      ...d,
      daily_usage: dailyDisplay,
      weekly_usage: roundStockQty(d.weekly_usage, uom, 'ceil'),
      qty_on_hand: qty,
      days_on_hand,
      target_qty,
      reorder_level: reorderAdj,
      suggested_order_qty: suggested,
      status,
      message,
    });
  }

  const reorder_count = products.filter(
    (p) => p.status === 'reorder' || p.status === 'critical'
  ).length;
  const critical_count = products.filter((p) => p.status === 'critical').length;
  const withDemand = products.filter((p) => p.daily_usage > 0).length;
  const suggested_lines = products.filter((p) => p.suggested_order_qty > 0).length;

  return {
    learners,
    policy,
    feeding_days_per_week: 5,
    products,
    summary: {
      products_with_demand: withDemand,
      reorder_count,
      critical_count,
      suggested_lines,
    },
  };
}

/** Read cover policy from school_profiles.metadata or columns */
export function policyFromSchool(school: Record<string, unknown> | null): StockCoverPolicy {
  const meta =
    school?.metadata && typeof school.metadata === 'object'
      ? (school.metadata as Record<string, unknown>)
      : {};
  return normalizeCoverPolicy({
    cover_days:
      school?.kitchen_stock_cover_days != null
        ? Number(school.kitchen_stock_cover_days)
        : meta.kitchen_stock_cover_days != null
          ? Number(meta.kitchen_stock_cover_days)
          : undefined,
    reorder_cover_days:
      school?.kitchen_reorder_cover_days != null
        ? Number(school.kitchen_reorder_cover_days)
        : meta.kitchen_reorder_cover_days != null
          ? Number(meta.kitchen_reorder_cover_days)
          : undefined,
    lead_time_days:
      school?.kitchen_lead_time_days != null
        ? Number(school.kitchen_lead_time_days)
        : meta.kitchen_lead_time_days != null
          ? Number(meta.kitchen_lead_time_days)
          : undefined,
  });
}
