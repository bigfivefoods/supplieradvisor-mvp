/**
 * Build school kitchen reorder PO lines from the stock plan.
 * - need: only products below reorder / critical cover (gap to target)
 * - weekly / monthly: standard period demand net of on-hand (only what is short)
 */
import {
  requiredOrderQty,
  roundStockQty,
  type ProductStockPlan,
} from '@/lib/schools/kitchen-stock-plan';

export type ReorderPoMode = 'need' | 'weekly' | 'monthly';

export type ReorderPoLine = {
  approved_product_id: number;
  product_name: string;
  brand_name: string;
  category: string;
  qty: number;
  uom: string;
  unit_price: number;
  /** Why this line is on the PO */
  reason: string;
  cover_status?: string;
};

export type BuildReorderPoResult = {
  mode: ReorderPoMode;
  lines: ReorderPoLine[];
  label: string;
  notes: string;
  feeding_days: number;
};

const MODE_META: Record<
  ReorderPoMode,
  { label: string; feedingDays: number; notes: string }
> = {
  need: {
    label: 'Suggested reorder (need only)',
    feedingDays: 0,
    notes:
      'Auto-built from kitchen cover: only products at/below reorder or critical. Qty = restore target cover days.',
  },
  weekly: {
    label: 'Weekly standard reorder',
    feedingDays: 5,
    notes:
      'Standard weekly reorder: products on the DBE menu with a shortfall for ~5 feeding days (weekly use − on hand).',
  },
  monthly: {
    label: 'Monthly standard reorder',
    feedingDays: 20,
    notes:
      'Standard monthly reorder: products on the DBE menu with a shortfall for ~20 feeding days (4 weeks − on hand).',
  },
};

function periodDemandQty(
  p: ProductStockPlan,
  feedingDays: number
): number {
  const uom = p.uom || 'kg';
  if (feedingDays <= 5 && p.weekly_usage > 0) {
    return roundStockQty(p.weekly_usage, uom, 'ceil');
  }
  // Scale from weekly when available (more accurate than daily alone)
  if (p.weekly_usage > 0) {
    const weeks = feedingDays / 5;
    return roundStockQty(p.weekly_usage * weeks, uom, 'ceil');
  }
  const daily = Number(p.daily_usage) || 0;
  if (daily <= 0) return 0;
  return roundStockQty(daily * feedingDays, uom, 'ceil');
}

/** Optional kitchen stock row when plan missed a low-stock product */
export type ExtraLowStockRow = {
  approved_product_id: number;
  product_name: string;
  brand_name?: string | null;
  category?: string | null;
  uom?: string | null;
  qty_on_hand: number;
  reorder_level?: number | null;
  target_level?: number | null;
  daily_usage?: number | null;
  low_stock?: boolean;
  cover_status?: string | null;
};

/**
 * Build PO lines for a reorder mode. Empty when nothing needed.
 * Never includes ok / overstock for "need". Period modes only include
 * products with demand and a positive net shortfall.
 */
export function buildReorderPoLines(
  products: ProductStockPlan[],
  mode: ReorderPoMode,
  opts?: { extraLowStock?: ExtraLowStockRow[] }
): BuildReorderPoResult {
  const meta = MODE_META[mode];
  const lines: ReorderPoLine[] = [];
  const seen = new Set<number>();

  if (mode === 'need') {
    for (const p of products) {
      const need =
        p.status === 'reorder' ||
        p.status === 'critical' ||
        (p.reorder_level > 0 && p.qty_on_hand <= p.reorder_level);
      if (!need) continue;
      const qty = requiredOrderQty({
        qty_on_hand: p.qty_on_hand,
        target_qty: p.target_qty,
        reorder_level: p.reorder_level,
        daily_usage: p.daily_usage,
        status: p.status,
        uom: p.uom,
      });
      if (!(qty > 0)) continue;
      seen.add(p.approved_product_id);
      lines.push({
        approved_product_id: p.approved_product_id,
        product_name: p.product_name,
        brand_name: p.brand_name || '',
        category: p.category || 'other',
        qty,
        uom: p.uom || 'kg',
        unit_price: 0,
        reason: p.status === 'critical' ? 'critical' : 'reorder',
        cover_status: p.status,
      });
    }
    // Manual low-stock / reorder levels not fully represented on plan
    for (const e of opts?.extraLowStock || []) {
      const pid = Number(e.approved_product_id);
      if (!Number.isFinite(pid) || seen.has(pid)) continue;
      const status = String(e.cover_status || '').toLowerCase();
      const low =
        e.low_stock ||
        status === 'reorder' ||
        status === 'critical' ||
        (Number(e.reorder_level) > 0 &&
          Number(e.qty_on_hand) <= Number(e.reorder_level));
      if (!low) continue;
      const qty = requiredOrderQty({
        qty_on_hand: e.qty_on_hand,
        target_qty: e.target_level,
        reorder_level: e.reorder_level,
        daily_usage: e.daily_usage,
        status: status || 'reorder',
        uom: e.uom,
      });
      if (!(qty > 0)) continue;
      seen.add(pid);
      lines.push({
        approved_product_id: pid,
        product_name: e.product_name,
        brand_name: e.brand_name || '',
        category: e.category || 'other',
        qty,
        uom: e.uom || 'kg',
        unit_price: 0,
        reason: status === 'critical' ? 'critical' : 'reorder',
        cover_status: status || 'reorder',
      });
    }
  } else {
    const days = meta.feedingDays;
    for (const p of products) {
      const demand = periodDemandQty(p, days);
      if (!(demand > 0)) continue;
      const onHand = Math.max(0, Number(p.qty_on_hand) || 0);
      const qty = roundStockQty(
        Math.max(0, demand - onHand),
        p.uom || 'kg',
        'ceil'
      );
      if (!(qty > 0)) continue;
      lines.push({
        approved_product_id: p.approved_product_id,
        product_name: p.product_name,
        brand_name: p.brand_name || '',
        category: p.category || 'other',
        qty,
        uom: p.uom || 'kg',
        unit_price: 0,
        reason: mode === 'weekly' ? 'weekly_standard' : 'monthly_standard',
        cover_status: p.status,
      });
    }
  }

  lines.sort((a, b) => {
    const ca = a.category.localeCompare(b.category);
    if (ca !== 0) return ca;
    return a.product_name.localeCompare(b.product_name);
  });

  return {
    mode,
    lines,
    label: meta.label,
    notes: meta.notes,
    feeding_days: meta.feedingDays,
  };
}

export function parseReorderPoMode(raw: unknown): ReorderPoMode | null {
  const s = String(raw || '')
    .toLowerCase()
    .trim();
  if (s === 'need' || s === 'reorder' || s === 'suggested') return 'need';
  if (s === 'weekly' || s === 'week') return 'weekly';
  if (s === 'monthly' || s === 'month') return 'monthly';
  return null;
}
