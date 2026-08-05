/**
 * Brand fidelity for NSNP: DBE sets category on recipe → school picks brand →
 * SP must buy that brand. Same-category approved substitute = half penalty.
 * Unapproved brands never allowed.
 */
import { normalizeRecipeCategory } from '@/lib/schools/recipe-mrp';

export type BrandFidelity =
  | 'exact'
  /** Approved catalogue product, different brand, same category as ordered */
  | 'approved_substitute'
  /** Not on department approved list */
  | 'unapproved'
  | 'unknown';

/** Credit weight for SP scoring (1 = full, 0.5 = half penalty, 0 = full fail) */
export const BRAND_FIDELITY_CREDIT: Record<BrandFidelity, number> = {
  exact: 1,
  approved_substitute: 0.5,
  unapproved: 0,
  unknown: 0.5, // neutral when we lack ordered product to compare
};

export function scoreBrandFidelity(opts: {
  ordered_product_id?: number | null;
  delivered_product_id?: number | null;
  ordered_category?: string | null;
  delivered_category?: string | null;
  /** Delivered product is on the agency approved catalogue */
  delivered_approved: boolean;
}): BrandFidelity {
  const orderedId =
    opts.ordered_product_id != null && Number(opts.ordered_product_id) > 0
      ? Number(opts.ordered_product_id)
      : null;
  const deliveredId =
    opts.delivered_product_id != null && Number(opts.delivered_product_id) > 0
      ? Number(opts.delivered_product_id)
      : null;

  if (!opts.delivered_approved || !deliveredId) {
    return 'unapproved';
  }

  if (orderedId != null && deliveredId === orderedId) {
    return 'exact';
  }

  // Same category → approved substitute (half credit)
  const oc = normalizeRecipeCategory(opts.ordered_category);
  const dc = normalizeRecipeCategory(opts.delivered_category);
  if (oc && dc && (oc === dc || oc.includes(dc) || dc.includes(oc))) {
    return orderedId != null ? 'approved_substitute' : 'exact';
  }

  // No ordered product / category — only know it's approved
  if (orderedId == null && !oc) {
    return 'unknown';
  }

  // Different category but still approved catalogue (wrong product range)
  // Treat as substitute only if we have no category to compare; else half fail
  if (!oc || !dc) {
    return orderedId != null && deliveredId !== orderedId
      ? 'approved_substitute'
      : 'exact';
  }

  // Different category, approved — not the school's brand range; half credit
  // (still better than unapproved; SP shouldn't ship wrong range)
  return 'approved_substitute';
}

export type ScoredDeliveryLine = {
  approved?: boolean | null;
  approved_product_id?: number | null;
  /** School-ordered / preferred brand product (from PO) */
  ordered_product_id?: number | null;
  ordered_category?: string | null;
  category?: string | null;
  qty_delivered?: number;
  qty_received?: number;
  qty_ordered?: number;
  qty?: number;
  brand_fidelity?: BrandFidelity;
};

/**
 * Score delivery lines for SP incentives.
 * - Unapproved: 0 credit (and flagged)
 * - Exact brand match: full qty credit
 * - Approved same-category substitute: half qty credit (half penalty)
 */
export function scoreDeliveryLinesWithBrandFidelity(
  lines: ScoredDeliveryLine[]
): {
  total_qty: number;
  /** Weighted approved qty (exact=1×, substitute=0.5×) */
  approved_qty: number;
  compliance_pct: number;
  full_compliance: boolean;
  brand_exact_pct: number;
  brand_fidelity_pct: number;
  line_count: number;
  approved_line_count: number;
  exact_line_count: number;
  substitute_line_count: number;
  unapproved_line_count: number;
  lines: Array<ScoredDeliveryLine & { brand_fidelity: BrandFidelity; credit: number }>;
} {
  let total_qty = 0;
  let approved_qty = 0;
  let exact_qty = 0;
  let line_count = 0;
  let approved_line_count = 0;
  let exact_line_count = 0;
  let substitute_line_count = 0;
  let unapproved_line_count = 0;
  const scoredLines: Array<
    ScoredDeliveryLine & { brand_fidelity: BrandFidelity; credit: number }
  > = [];

  for (const l of lines) {
    const qty = Number(
      l.qty_received ?? l.qty_delivered ?? l.qty_ordered ?? l.qty ?? 0
    );
    if (!(qty > 0)) continue;
    line_count += 1;
    total_qty += qty;

    const onCatalogue =
      l.approved === true ||
      (l.approved !== false &&
        l.approved_product_id != null &&
        Number(l.approved_product_id) > 0);

    const fidelity = scoreBrandFidelity({
      ordered_product_id: l.ordered_product_id ?? null,
      delivered_product_id: l.approved_product_id ?? null,
      ordered_category: l.ordered_category ?? l.category,
      delivered_category: l.category,
      delivered_approved: onCatalogue,
    });
    const credit = BRAND_FIDELITY_CREDIT[fidelity];
    const weighted = qty * credit;

    if (fidelity === 'unapproved') {
      unapproved_line_count += 1;
    } else {
      approved_line_count += 1;
      approved_qty += weighted;
      if (fidelity === 'exact' || fidelity === 'unknown') {
        exact_line_count += 1;
        exact_qty += qty;
      } else if (fidelity === 'approved_substitute') {
        substitute_line_count += 1;
      }
    }

    scoredLines.push({
      ...l,
      brand_fidelity: fidelity,
      credit,
      approved: onCatalogue && fidelity !== 'unapproved',
    });
  }

  const compliance_pct =
    total_qty > 0
      ? Math.round((approved_qty / total_qty) * 1000) / 10
      : 100;
  const brand_exact_pct =
    total_qty > 0 ? Math.round((exact_qty / total_qty) * 1000) / 10 : 100;
  const brand_fidelity_pct = compliance_pct;

  return {
    total_qty,
    approved_qty,
    compliance_pct,
    full_compliance:
      line_count > 0 &&
      unapproved_line_count === 0 &&
      substitute_line_count === 0,
    brand_exact_pct,
    brand_fidelity_pct,
    line_count,
    approved_line_count,
    exact_line_count,
    substitute_line_count,
    unapproved_line_count,
    lines: scoredLines,
  };
}

export const BRAND_FIDELITY_COPY = {
  dbe: 'DBE sets the product category on the recipe BOM. Schools pick the brand; SPs supply that brand.',
  school:
    'Choose the approved brand your school will use for each recipe category. Your SP must buy that brand when available.',
  sp: 'Buy the school-selected brand. If it is out of stock, use another approved brand in the same category only — that scores half credit. Commercial/non-approved extras are allowed on the DN but score zero and never enter kitchen stock.',
  substitute_half:
    'Approved same-category substitute: half SP compliance credit (half penalty). Non-approved commercial lines score zero and are not stocked as NSNP.',
};

/** Live scorecard for SP DN before dispatch/deliver */
export function buildDnScorePreview(lines: ScoredDeliveryLine[]): {
  compliance_pct: number;
  full_compliance: boolean;
  brand_exact_pct: number;
  exact_qty: number;
  substitute_qty: number;
  commercial_qty: number;
  total_qty: number;
  exact_lines: number;
  substitute_lines: number;
  commercial_lines: number;
  line_count: number;
  on_catalogue_pillar_est: number;
  full_compliance_pillar_est: number;
  headline: string;
  tips: string[];
} {
  const sc = scoreDeliveryLinesWithBrandFidelity(lines);
  let exact_qty = 0;
  let substitute_qty = 0;
  let commercial_qty = 0;
  for (const l of sc.lines) {
    const qty = Number(
      l.qty_received ?? l.qty_delivered ?? l.qty_ordered ?? l.qty ?? 0
    );
    if (l.brand_fidelity === 'exact' || l.brand_fidelity === 'unknown') {
      exact_qty += qty;
    } else if (l.brand_fidelity === 'approved_substitute') {
      substitute_qty += qty;
    } else {
      commercial_qty += qty;
    }
  }

  // Pillar estimates (weights from SP scorecard: 50 + 25)
  const on_catalogue_pillar_est =
    Math.round((sc.compliance_pct / 100) * 50 * 10) / 10;
  const full_compliance_pillar_est = sc.full_compliance ? 25 : 0;

  const tips: string[] = [];
  if (sc.substitute_line_count > 0) {
    tips.push(
      `${sc.substitute_line_count} approved same-category OOS substitute line(s) = half credit on those qty`
    );
  }
  if (sc.unapproved_line_count > 0) {
    tips.push(
      `${sc.unapproved_line_count} commercial/non-approved line(s) = 0% credit and will not enter kitchen stock`
    );
  }
  if (sc.full_compliance) {
    tips.push('Full-compliance bonus available if POD is attached and delivery is on time');
  } else if (sc.line_count > 0) {
    tips.push(
      'Full-compliance bonus (25 pts) needs every line exact school brand — no subs, no commercial extras'
    );
  }
  if (sc.line_count === 0) {
    tips.push('Add delivery quantities to see live score impact');
  }

  let headline = 'No lines yet';
  if (sc.line_count > 0) {
    if (sc.full_compliance) {
      headline = `Max brand fidelity — ${sc.compliance_pct}% weighted credit`;
    } else if (sc.unapproved_line_count > 0 && sc.substitute_line_count > 0) {
      headline = `${sc.compliance_pct}% score credit · substitutes + commercial extras`;
    } else if (sc.unapproved_line_count > 0) {
      headline = `${sc.compliance_pct}% score credit · commercial extras score 0`;
    } else if (sc.substitute_line_count > 0) {
      headline = `${sc.compliance_pct}% score credit · OOS substitutes at half`;
    } else {
      headline = `${sc.compliance_pct}% on-catalogue brand fidelity`;
    }
  }

  return {
    compliance_pct: sc.compliance_pct,
    full_compliance: sc.full_compliance,
    brand_exact_pct: sc.brand_exact_pct,
    exact_qty,
    substitute_qty,
    commercial_qty,
    total_qty: sc.total_qty,
    exact_lines: sc.exact_line_count,
    substitute_lines: sc.substitute_line_count,
    commercial_lines: sc.unapproved_line_count,
    line_count: sc.line_count,
    on_catalogue_pillar_est,
    full_compliance_pillar_est,
    headline,
    tips,
  };
}

/** Normalize line lane for UI/API */
export type DnLineLane = 'nsnp' | 'commercial';

export function resolveDnLineLane(l: {
  other_item?: boolean | null;
  approved?: boolean | null;
  line_type?: string | null;
  approved_product_id?: number | null;
}): DnLineLane {
  if (l.line_type === 'commercial' || l.line_type === 'other') return 'commercial';
  if (l.other_item === true || l.approved === false) return 'commercial';
  if (l.line_type === 'nsnp') return 'nsnp';
  if (l.approved_product_id != null && Number(l.approved_product_id) > 0) {
    return 'nsnp';
  }
  return 'commercial';
}

export function applyDnLineLane(
  line: Record<string, unknown>,
  lane: DnLineLane
): Record<string, unknown> {
  if (lane === 'commercial') {
    return {
      ...line,
      line_type: 'commercial',
      other_item: true,
      approved: false,
      // Keep product id if present for reference, but score as commercial
      brand_fidelity: 'unapproved',
    };
  }
  return {
    ...line,
    line_type: 'nsnp',
    other_item: false,
    approved:
      line.approved_product_id != null && Number(line.approved_product_id) > 0
        ? true
        : line.approved,
  };
}
