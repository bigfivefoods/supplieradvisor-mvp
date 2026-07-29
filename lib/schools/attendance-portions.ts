/**
 * Attendance-scaled portions: present learners × recipe BOM (not enrolment).
 */

export type PortionScaleInput = {
  /** Headcount present today (preferred) */
  present?: number | null;
  /** Fallback enrolment / NSNP eligible */
  enrolled?: number | null;
  /** Optional planned meals override */
  planned?: number | null;
};

export type ScaledLine = {
  approved_product_id: number | null;
  product_name: string;
  brand_name?: string | null;
  category?: string | null;
  uom: string;
  qty_per_portion: number;
  wastage_pct?: number;
  /** Portions basis used */
  portions: number;
  /** Gross qty before wastage */
  qty_gross: number;
  /** Qty including wastage */
  qty_with_wastage: number;
};

/**
 * Choose portion count: planned > present > enrolled > 0
 */
export function resolvePortionCount(input: PortionScaleInput): {
  portions: number;
  basis: 'planned' | 'present' | 'enrolled' | 'none';
} {
  const planned = Number(input.planned || 0);
  if (planned > 0) return { portions: Math.round(planned), basis: 'planned' };
  const present = Number(input.present || 0);
  if (present > 0) return { portions: Math.round(present), basis: 'present' };
  const enrolled = Number(input.enrolled || 0);
  if (enrolled > 0) return { portions: Math.round(enrolled), basis: 'enrolled' };
  return { portions: 0, basis: 'none' };
}

export function scaleRecipeLines(
  lines: Array<{
    approved_product_id?: number | null;
    product_name?: string;
    brand_name?: string | null;
    category?: string | null;
    uom?: string | null;
    qty_per_portion?: number;
    wastage_pct?: number;
  }>,
  input: PortionScaleInput
): { lines: ScaledLine[]; portions: number; basis: string } {
  const { portions, basis } = resolvePortionCount(input);
  const out: ScaledLine[] = [];
  for (const l of lines) {
    const per = Number(l.qty_per_portion || 0);
    if (!(per > 0) || !(portions > 0)) {
      out.push({
        approved_product_id: l.approved_product_id != null ? Number(l.approved_product_id) : null,
        product_name: String(l.product_name || 'Ingredient'),
        brand_name: l.brand_name ?? null,
        category: l.category ?? null,
        uom: String(l.uom || 'kg'),
        qty_per_portion: per,
        wastage_pct: Number(l.wastage_pct || 0) || 0,
        portions,
        qty_gross: 0,
        qty_with_wastage: 0,
      });
      continue;
    }
    const gross = Math.round(per * portions * 1000) / 1000;
    const waste = Number(l.wastage_pct || 0) || 0;
    const withWaste =
      Math.round(gross * (1 + Math.max(0, waste) / 100) * 1000) / 1000;
    out.push({
      approved_product_id:
        l.approved_product_id != null ? Number(l.approved_product_id) : null,
      product_name: String(l.product_name || 'Ingredient'),
      brand_name: l.brand_name ?? null,
      category: l.category ?? null,
      uom: String(l.uom || 'kg'),
      qty_per_portion: per,
      wastage_pct: waste,
      portions,
      qty_gross: gross,
      qty_with_wastage: withWaste,
    });
  }
  return { lines: out, portions, basis };
}
