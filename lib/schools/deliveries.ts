/**
 * NSNP delivery lifecycle — SP supplies, school receives, both attach docs.
 */

export const DELIVERY_STATUSES = [
  { value: 'draft', label: 'Draft', role: 'isp' },
  { value: 'confirmed', label: 'Confirmed', role: 'isp' },
  { value: 'dispatched', label: 'On the way', role: 'isp' },
  { value: 'delivered', label: 'Delivered (SP)', role: 'isp' },
  { value: 'received', label: 'Received (school)', role: 'school' },
  { value: 'disputed', label: 'Disputed', role: 'school' },
  { value: 'cancelled', label: 'Cancelled', role: 'both' },
] as const;

export const FILE_KINDS = [
  { value: 'pod', label: 'Proof of delivery (POD)' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'packing_list', label: 'Packing list' },
  { value: 'photo', label: 'Photo' },
  { value: 'credit_note', label: 'Credit note' },
  { value: 'other', label: 'Other' },
] as const;

export type DeliveryLine = {
  approved_product_id?: number | null;
  product_name: string;
  brand_name: string;
  qty_ordered?: number;
  qty_delivered?: number;
  qty_received?: number;
  uom?: string;
};

export function deliveryStatusClass(status?: string | null) {
  const s = String(status || 'draft').toLowerCase();
  if (s === 'received') return 'bg-emerald-100 text-emerald-900 border-emerald-200';
  if (s === 'delivered' || s === 'dispatched')
    return 'bg-sky-100 text-sky-900 border-sky-200';
  if (s === 'disputed') return 'bg-rose-100 text-rose-900 border-rose-200';
  if (s === 'cancelled') return 'bg-slate-100 text-slate-600 border-slate-200';
  if (s === 'confirmed') return 'bg-violet-100 text-violet-900 border-violet-200';
  return 'bg-amber-50 text-amber-900 border-amber-200';
}

export function fileKindLabel(kind?: string | null) {
  const k = FILE_KINDS.find((f) => f.value === kind);
  return k?.label || kind || 'File';
}

/** Qty variance thresholds (absolute % vs ordered) */
export const QTY_VARIANCE_GREEN_PCT = 0; // exact match only for green
export const QTY_VARIANCE_AMBER_PCT = 10; // ≤10% short/over → amber; >10% → red

export type QtyVarianceTone = 'green' | 'amber' | 'red' | 'neutral';

export type QtyVariance = {
  ordered: number;
  actual: number;
  /** Absolute percentage variance vs ordered (0 if ordered=0) */
  variance_pct: number;
  /** Signed %: negative = short, positive = over */
  signed_pct: number;
  tone: QtyVarianceTone;
  label: string;
};

/**
 * Compare planned/actual delivery qty to ordered.
 * Green = perfect match; amber ≤ 10% off; red > 10% short or over.
 */
export function qtyVariance(
  ordered: number,
  actual: number,
  opts?: { greenPct?: number; amberPct?: number }
): QtyVariance {
  const o = Number(ordered) || 0;
  const a = Number(actual) || 0;
  const greenMax = opts?.greenPct ?? QTY_VARIANCE_GREEN_PCT;
  const amberMax = opts?.amberPct ?? QTY_VARIANCE_AMBER_PCT;

  if (!(o > 0) && !(a > 0)) {
    return {
      ordered: o,
      actual: a,
      variance_pct: 0,
      signed_pct: 0,
      tone: 'neutral',
      label: 'No qty',
    };
  }
  if (!(o > 0) && a > 0) {
    return {
      ordered: o,
      actual: a,
      variance_pct: 100,
      signed_pct: 100,
      tone: 'amber',
      label: 'Extra (not on PO)',
    };
  }

  const signed = ((a - o) / o) * 100;
  const abs = Math.abs(signed);
  // Treat near-zero float noise as perfect
  const isPerfect = abs <= Math.max(greenMax, 0.05);

  let tone: QtyVarianceTone = 'green';
  let label = 'Perfect match';
  if (!isPerfect && abs <= amberMax) {
    tone = 'amber';
    label =
      signed < 0
        ? `${abs.toFixed(0)}% short`
        : `${abs.toFixed(0)}% over`;
  } else if (!isPerfect) {
    tone = 'red';
    label =
      signed < 0
        ? `${abs.toFixed(0)}% short`
        : `${abs.toFixed(0)}% over`;
  }

  return {
    ordered: o,
    actual: a,
    variance_pct: Math.round(abs * 10) / 10,
    signed_pct: Math.round(signed * 10) / 10,
    tone,
    label,
  };
}

export function qtyVarianceClass(tone: QtyVarianceTone): string {
  if (tone === 'green')
    return 'bg-emerald-50 border-emerald-200 text-emerald-900';
  if (tone === 'amber') return 'bg-amber-50 border-amber-200 text-amber-950';
  if (tone === 'red') return 'bg-rose-50 border-rose-200 text-rose-900';
  return 'bg-slate-50 border-slate-200 text-slate-600';
}

export function qtyVarianceDotClass(tone: QtyVarianceTone): string {
  if (tone === 'green') return 'bg-emerald-500';
  if (tone === 'amber') return 'bg-amber-500';
  if (tone === 'red') return 'bg-rose-500';
  return 'bg-slate-300';
}

/** Whole-delivery roll-up: worst line tone wins */
export function deliveryQtyTone(
  lines: Array<{
    qty_ordered?: number;
    qty_delivered?: number;
    qty_received?: number;
  }>,
  field: 'delivered' | 'received' = 'delivered'
): QtyVarianceTone {
  let worst: QtyVarianceTone = 'green';
  let any = false;
  for (const l of lines) {
    const ordered = Number(l.qty_ordered ?? 0);
    const actual =
      field === 'received'
        ? Number(l.qty_received ?? l.qty_delivered ?? ordered)
        : Number(l.qty_delivered ?? ordered);
    if (!(ordered > 0) && !(actual > 0)) continue;
    any = true;
    const v = qtyVariance(ordered, actual);
    if (v.tone === 'red') return 'red';
    if (v.tone === 'amber') worst = 'amber';
  }
  return any ? worst : 'neutral';
}
