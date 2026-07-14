/**
 * Container resellers — commission calc + verification fee constants.
 */

export const RESELLER_VERIFY_FEE_ZAR = 50;

export type CommissionType = 'percent' | 'fixed';

export type CommissionRate = {
  product_id?: number | null;
  product_name?: string | null;
  sku?: string | null;
  commission_type: CommissionType;
  commission_value: number;
};

export type SaleLineInput = {
  product_id?: number | null;
  product_name: string;
  sku?: string | null;
  quantity: number;
  unit_price: number;
  unit?: string | null;
  commission_type?: CommissionType;
  commission_value?: number;
};

export type SaleLineComputed = SaleLineInput & {
  line_total: number;
  commission_type: CommissionType;
  commission_value: number;
  commission_amount: number;
};

export function normalizeCommissionType(v: unknown): CommissionType {
  return String(v || '').toLowerCase() === 'fixed' ? 'fixed' : 'percent';
}

/** Commission for one unit sold (or percent of line). */
export function computeLineCommission(opts: {
  quantity: number;
  unit_price: number;
  commission_type: CommissionType;
  commission_value: number;
}): { line_total: number; commission_amount: number } {
  const qty = Math.max(0, Number(opts.quantity) || 0);
  const price = Math.max(0, Number(opts.unit_price) || 0);
  const line_total = round2(qty * price);
  const val = Math.max(0, Number(opts.commission_value) || 0);
  let commission_amount = 0;
  if (opts.commission_type === 'fixed') {
    commission_amount = round2(qty * val);
  } else {
    // percent of line total
    commission_amount = round2((line_total * val) / 100);
  }
  return { line_total, commission_amount };
}

export function computeSaleLines(
  lines: SaleLineInput[],
  rateLookup: (line: SaleLineInput) => CommissionRate | null
): {
  items: SaleLineComputed[];
  subtotal: number;
  commission_total: number;
  total_amount: number;
} {
  const items: SaleLineComputed[] = [];
  let subtotal = 0;
  let commission_total = 0;

  for (const raw of lines) {
    const qty = Math.max(0, Number(raw.quantity) || 0);
    if (qty <= 0 || !raw.product_name) continue;
    const rate = rateLookup(raw);
    const commission_type =
      raw.commission_type != null
        ? normalizeCommissionType(raw.commission_type)
        : rate
          ? normalizeCommissionType(rate.commission_type)
          : 'percent';
    const commission_value =
      raw.commission_value != null && Number.isFinite(Number(raw.commission_value))
        ? Number(raw.commission_value)
        : rate
          ? Number(rate.commission_value)
          : 10;

    const { line_total, commission_amount } = computeLineCommission({
      quantity: qty,
      unit_price: Number(raw.unit_price) || 0,
      commission_type,
      commission_value,
    });

    items.push({
      product_id: raw.product_id ?? null,
      product_name: String(raw.product_name).trim(),
      sku: raw.sku ?? null,
      quantity: qty,
      unit_price: Number(raw.unit_price) || 0,
      unit: raw.unit || 'unit',
      line_total,
      commission_type,
      commission_value,
      commission_amount,
    });
    subtotal += line_total;
    commission_total += commission_amount;
  }

  return {
    items,
    subtotal: round2(subtotal),
    commission_total: round2(commission_total),
    total_amount: round2(subtotal),
  };
}

/** Pick best rate: reseller-specific product → company product → company default by name → 10% */
export function pickCommissionRate(
  rates: Array<Record<string, unknown>>,
  line: SaleLineInput,
  resellerId: number
): CommissionRate | null {
  const pid = line.product_id != null ? Number(line.product_id) : null;
  const name = String(line.product_name || '').toLowerCase().trim();
  const sku = String(line.sku || '').toLowerCase().trim();

  const active = rates.filter((r) => r.is_active !== false);

  const match = (
    pred: (r: Record<string, unknown>) => boolean
  ): CommissionRate | null => {
    const hit = active.find(pred);
    if (!hit) return null;
    return {
      product_id: hit.product_id != null ? Number(hit.product_id) : null,
      product_name: hit.product_name ? String(hit.product_name) : null,
      sku: hit.sku ? String(hit.sku) : null,
      commission_type: normalizeCommissionType(hit.commission_type),
      commission_value: Number(hit.commission_value) || 0,
    };
  };

  // 1) Reseller + product_id
  if (pid) {
    const r = match(
      (x) =>
        Number(x.reseller_id) === resellerId && Number(x.product_id) === pid
    );
    if (r) return r;
  }
  // 2) Reseller + name/sku
  if (name || sku) {
    const r = match((x) => {
      if (Number(x.reseller_id) !== resellerId) return false;
      const pn = String(x.product_name || '')
        .toLowerCase()
        .trim();
      const ps = String(x.sku || '')
        .toLowerCase()
        .trim();
      if (name && pn === name) return true;
      if (sku && ps === sku) return true;
      return false;
    });
    if (r) return r;
  }
  // 3) Company default product_id
  if (pid) {
    const r = match(
      (x) =>
        (x.reseller_id == null || x.reseller_id === '') &&
        Number(x.product_id) === pid
    );
    if (r) return r;
  }
  // 4) Company default by name
  if (name) {
    const r = match(
      (x) =>
        (x.reseller_id == null || x.reseller_id === '') &&
        String(x.product_name || '')
          .toLowerCase()
          .trim() === name
    );
    if (r) return r;
  }
  return {
    commission_type: 'percent',
    commission_value: 10,
    product_name: line.product_name,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function saleNumber() {
  const d = new Date();
  const y = d.getFullYear().toString().slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RS${y}${m}${day}-${r}`;
}

export function transferNumber() {
  const d = new Date();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RT${d.getFullYear().toString().slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}-${r}`;
}
