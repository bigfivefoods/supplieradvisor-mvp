/**
 * Lightweight MRP explosion utilities.
 * Gross requirements → net against on-hand + scheduled receipts → planned orders.
 */

export type BomLineInput = {
  component_product_id: number;
  qty_per: number;
  scrap_pct?: number;
};

export type DemandInput = {
  product_id: number;
  qty: number;
  date?: string;
  source?: string;
};

export type StockMap = Record<number, number>;

export type MrpLineResult = {
  product_id: number;
  gross_req: number;
  on_hand: number;
  scheduled_receipts: number;
  net_req: number;
  planned_order_qty: number;
  action: 'none' | 'make' | 'buy' | 'expedite';
  source: string;
  requirement_date: string | null;
};

/** Explode finished-good demand through BOM lines into component gross requirements. */
export function explodeBom(
  parentQty: number,
  lines: BomLineInput[]
): { product_id: number; gross: number }[] {
  return lines
    .filter((l) => l.component_product_id && l.qty_per > 0)
    .map((l) => {
      const scrap = 1 + (Number(l.scrap_pct) || 0) / 100;
      return {
        product_id: Number(l.component_product_id),
        gross: parentQty * Number(l.qty_per) * scrap,
      };
    });
}

/** Aggregate demands by product_id. */
export function aggregateDemand(demands: DemandInput[]): Map<number, { qty: number; source: string; date: string | null }> {
  const map = new Map<number, { qty: number; source: string; date: string | null }>();
  for (const d of demands) {
    if (!d.product_id || !d.qty) continue;
    const cur = map.get(d.product_id) || { qty: 0, source: d.source || 'demand', date: d.date || null };
    cur.qty += Number(d.qty);
    if (d.source && !cur.source.includes(d.source)) cur.source = `${cur.source}+${d.source}`;
    if (d.date && (!cur.date || d.date < cur.date)) cur.date = d.date;
    map.set(d.product_id, cur);
  }
  return map;
}

export function netRequirements(
  productId: number,
  gross: number,
  onHand: number,
  scheduledReceipts: number,
  hasBom: boolean,
  source: string,
  requirementDate: string | null
): MrpLineResult {
  const available = Math.max(0, onHand) + Math.max(0, scheduledReceipts);
  const net = Math.max(0, gross - available);
  let action: MrpLineResult['action'] = 'none';
  if (net > 0.0001) {
    action = hasBom ? 'make' : 'buy';
    if (onHand <= 0 && scheduledReceipts <= 0) action = hasBom ? 'make' : 'expedite';
  }
  return {
    product_id: productId,
    gross_req: round4(gross),
    on_hand: round4(onHand),
    scheduled_receipts: round4(scheduledReceipts),
    net_req: round4(net),
    planned_order_qty: round4(net),
    action,
    source,
    requirement_date: requirementDate,
  };
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
