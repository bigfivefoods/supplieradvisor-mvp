/**
 * Live stock-on-hand rollups from container_inventory (Supabase).
 * Dynamic: re-query whenever the UI refreshes or polls.
 */

export type InventoryLine = {
  container_id: number;
  product_name?: string | null;
  sku?: string | null;
  qty_on_hand?: number | null;
  unit?: string | null;
  reorder_level?: number | null;
  unit_cost?: number | null;
};

export type ContainerStockSummary = {
  container_id: number;
  /** Total units across all SKUs */
  total_qty: number;
  /** Distinct product lines */
  sku_count: number;
  /** Lines at or below reorder_level (and reorder > 0) */
  low_stock_count: number;
  /** Estimated inventory value (qty × unit_cost) */
  stock_value: number;
  /** Top lines for tooltips (max 5) */
  top_lines: Array<{
    product_name: string;
    sku: string | null;
    qty: number;
    unit: string;
    low: boolean;
  }>;
};

export type NetworkStockTotals = {
  containers_with_stock: number;
  total_qty: number;
  sku_lines: number;
  low_stock_count: number;
  stock_value: number;
};

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Aggregate raw inventory rows by container_id */
export function aggregateStockByContainer(
  lines: InventoryLine[]
): Map<number, ContainerStockSummary> {
  const map = new Map<number, ContainerStockSummary>();

  for (const line of lines) {
    const cid = Number(line.container_id);
    if (!Number.isFinite(cid)) continue;

    if (!map.has(cid)) {
      map.set(cid, {
        container_id: cid,
        total_qty: 0,
        sku_count: 0,
        low_stock_count: 0,
        stock_value: 0,
        top_lines: [],
      });
    }

    const m = map.get(cid)!;
    const qty = Math.max(0, num(line.qty_on_hand));
    const reorder = num(line.reorder_level);
    const cost = num(line.unit_cost);
    const low = reorder > 0 && qty <= reorder;

    m.total_qty += qty;
    m.sku_count += 1;
    m.stock_value += qty * cost;
    if (low) m.low_stock_count += 1;

    m.top_lines.push({
      product_name: String(line.product_name || 'Item').trim() || 'Item',
      sku: line.sku != null ? String(line.sku) : null,
      qty: round1(qty),
      unit: String(line.unit || 'unit'),
      low,
    });
  }

  for (const m of map.values()) {
    m.total_qty = round1(m.total_qty);
    m.stock_value = round2(m.stock_value);
    // Highest qty first for popup
    m.top_lines.sort((a, b) => b.qty - a.qty);
    m.top_lines = m.top_lines.slice(0, 5);
  }

  return map;
}

export function emptyStock(containerId: number): ContainerStockSummary {
  return {
    container_id: containerId,
    total_qty: 0,
    sku_count: 0,
    low_stock_count: 0,
    stock_value: 0,
    top_lines: [],
  };
}

export function sumNetworkStock(
  byContainer: Map<number, ContainerStockSummary>
): NetworkStockTotals {
  let total_qty = 0;
  let sku_lines = 0;
  let low_stock_count = 0;
  let stock_value = 0;
  let containers_with_stock = 0;

  for (const s of byContainer.values()) {
    total_qty += s.total_qty;
    sku_lines += s.sku_count;
    low_stock_count += s.low_stock_count;
    stock_value += s.stock_value;
    if (s.total_qty > 0) containers_with_stock += 1;
  }

  return {
    containers_with_stock,
    total_qty: round1(total_qty),
    sku_lines,
    low_stock_count,
    stock_value: round2(stock_value),
  };
}

/** Format units for UI */
export function formatQty(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (Number.isInteger(n)) return n.toLocaleString('en-ZA');
  return n.toLocaleString('en-ZA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}
