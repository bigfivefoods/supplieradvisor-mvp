/**
 * Foolproof school → SP order & deliver process helpers.
 * Readiness checklist, status trail, substitute validation.
 */
import { normalizeRecipeCategory } from '@/lib/schools/recipe-mrp';
import {
  scoreBrandFidelity,
  type BrandFidelity,
} from '@/lib/schools/brand-fidelity';

export type ReadinessCheck = {
  id: string;
  label: string;
  ok: boolean;
  required: boolean;
  detail?: string;
  href?: string;
};

export type StatusTrailEvent = {
  at: string;
  status: string;
  label: string;
  by_role?: 'school' | 'isp' | 'system';
  note?: string | null;
};

/** Canonical PO lifecycle for both school and SP */
export const PO_LIFECYCLE: Array<{
  status: string;
  label: string;
  who: 'school' | 'isp' | 'shared';
}> = [
  { status: 'submitted', label: 'PO sent to SP', who: 'school' },
  { status: 'accepted', label: 'SP accepted', who: 'isp' },
  { status: 'fulfilling', label: 'SP buying / packing', who: 'isp' },
  { status: 'dispatched', label: 'On the road (DN)', who: 'isp' },
  { status: 'delivered', label: 'Delivered at school', who: 'isp' },
  { status: 'received', label: 'School GRN / closed', who: 'school' },
];

export function trailLabel(status: string): string {
  const hit = PO_LIFECYCLE.find((s) => s.status === status);
  if (hit) return hit.label;
  const map: Record<string, string> = {
    draft: 'Draft',
    submitted: 'PO sent to SP',
    accepted: 'SP accepted',
    confirmed: 'Confirmed',
    fulfilling: 'SP buying / packing',
    dispatched: 'Dispatched',
    delivered: 'Delivered',
    received: 'Received (GRN)',
    partially_received: 'Partially received',
    closed: 'Closed',
    cancelled: 'Cancelled',
    disputed: 'Disputed',
  };
  return map[status] || status;
}

export function appendStatusTrail(
  metadata: Record<string, unknown> | null | undefined,
  event: Omit<StatusTrailEvent, 'at'> & { at?: string }
): Record<string, unknown> {
  const meta = { ...(metadata && typeof metadata === 'object' ? metadata : {}) };
  const trail = Array.isArray(meta.status_trail)
    ? [...(meta.status_trail as StatusTrailEvent[])]
    : [];
  trail.push({
    at: event.at || new Date().toISOString(),
    status: event.status,
    label: event.label || trailLabel(event.status),
    by_role: event.by_role,
    note: event.note ?? null,
  });
  // Keep last 40 events
  meta.status_trail = trail.slice(-40);
  meta.last_status = event.status;
  meta.last_status_at = event.at || new Date().toISOString();
  return meta;
}

export function readStatusTrail(
  metadata: Record<string, unknown> | null | undefined
): StatusTrailEvent[] {
  if (!metadata || typeof metadata !== 'object') return [];
  return Array.isArray(metadata.status_trail)
    ? (metadata.status_trail as StatusTrailEvent[])
    : [];
}

/** School-side readiness before PO submit */
export function buildPoReadiness(opts: {
  hasAgency: boolean;
  activeSpLinks: number;
  lines: Array<{ approved_product_id?: number; qty?: number }>;
  ispProfileId?: number | null;
  expectedDate?: string | null;
  minDate?: string | null;
  brandPickOk?: boolean | null;
}): { ok: boolean; checks: ReadinessCheck[]; score: number } {
  const today = opts.minDate || new Date().toISOString().slice(0, 10);
  const lines = opts.lines || [];
  const validLines = lines.filter(
    (l) => Number(l.approved_product_id) > 0 && Number(l.qty) > 0
  );
  const checks: ReadinessCheck[] = [
    {
      id: 'agency',
      label: 'Linked to DBE / PEU programme',
      ok: opts.hasAgency,
      required: true,
      detail: opts.hasAgency
        ? 'Department catalogue available'
        : 'Join and get approved by DBE/PEU first',
      href: '/dashboard/schools/join',
    },
    {
      id: 'sp_link',
      label: 'Active service provider link',
      ok: opts.activeSpLinks > 0,
      required: true,
      detail:
        opts.activeSpLinks > 0
          ? `${opts.activeSpLinks} SP link(s)`
          : 'Accept an SP claim or link a preferred SP',
      href: '/dashboard/schools/isps',
    },
    {
      id: 'lines',
      label: 'Approved product lines with qty',
      ok: validLines.length > 0,
      required: true,
      detail:
        validLines.length > 0
          ? `${validLines.length} line(s)`
          : 'Add catalogue products (e.g. from Kitchen suggested PO)',
      href: '/dashboard/schools/kitchen',
    },
    {
      id: 'isp',
      label: 'Service provider selected',
      ok: Number(opts.ispProfileId) > 0,
      required: true,
      detail: Number(opts.ispProfileId) > 0 ? 'SP selected' : 'Pick your SP',
    },
    {
      id: 'date',
      label: 'Required delivery date set',
      ok: Boolean(
        opts.expectedDate &&
          /^\d{4}-\d{2}-\d{2}$/.test(opts.expectedDate) &&
          opts.expectedDate >= today
      ),
      required: true,
      detail: opts.expectedDate
        ? opts.expectedDate >= today
          ? opts.expectedDate
          : 'Date cannot be in the past'
        : 'Required for OTIF scoring',
    },
    {
      id: 'brands',
      label: 'Brand picks for multi-brand recipe lines',
      ok: opts.brandPickOk !== false,
      required: false,
      detail:
        opts.brandPickOk === false
          ? 'Optional defaults — PO products auto-apply brands on submit'
          : 'Ready (or will auto-apply from PO products)',
      href: '/dashboard/schools/recipes',
    },
  ];

  const required = checks.filter((c) => c.required);
  const ok = required.every((c) => c.ok);
  const score = Math.round(
    (checks.filter((c) => c.ok).length / Math.max(1, checks.length)) * 100
  );
  return { ok, checks, score };
}

export type SubstituteResult =
  | {
      ok: true;
      fidelity: BrandFidelity;
      credit: number;
      message: string;
      line: Record<string, unknown>;
    }
  | { ok: false; error: string };

/**
 * SP marks a PO/DN line as OOS and substitutes an approved same-category brand.
 * Unapproved products are rejected.
 */
export function applyOosSubstitute(opts: {
  line: Record<string, unknown>;
  substitute_product_id: number;
  substitute_product: {
    id: number;
    name: string;
    brand_name?: string | null;
    category?: string | null;
    uom?: string | null;
    active?: boolean | null;
  } | null;
  reason?: string | null;
}): SubstituteResult {
  const line = { ...opts.line };
  const orderedId =
    Number(line.ordered_product_id ?? line.approved_product_id) || null;
  const orderedCat = String(
    line.ordered_category || line.category || ''
  );

  if (!opts.substitute_product || opts.substitute_product.active === false) {
    return {
      ok: false,
      error:
        'Substitute must be an active product on the department approved list. Unapproved brands are not allowed.',
    };
  }

  const sub = opts.substitute_product;
  const subCat = String(sub.category || '');
  const fidelity = scoreBrandFidelity({
    ordered_product_id: orderedId,
    delivered_product_id: Number(sub.id),
    ordered_category: orderedCat,
    delivered_category: subCat,
    delivered_approved: true,
  });

  if (fidelity === 'unapproved') {
    return {
      ok: false,
      error: 'Unapproved brands cannot be delivered on NSNP notes.',
    };
  }

  // Require same category for deliberate OOS substitute
  const oc = normalizeRecipeCategory(orderedCat);
  const dc = normalizeRecipeCategory(subCat);
  if (oc && dc && !(oc === dc || oc.includes(dc) || dc.includes(oc))) {
    return {
      ok: false,
      error: `Substitute must be the same product category (“${orderedCat || 'ordered'}”). Cross-category swaps are not allowed.`,
    };
  }

  const credit = fidelity === 'exact' ? 1 : 0.5;
  const next = {
    ...line,
    ordered_product_id: orderedId,
    ordered_category: orderedCat || subCat,
    approved_product_id: Number(sub.id),
    product_name: String(sub.name),
    brand_name: String(sub.brand_name || ''),
    category: subCat || orderedCat,
    uom: String(sub.uom || line.uom || 'kg'),
    approved: true,
    other_item: false,
    brand_fidelity: fidelity,
    oos_substitute: fidelity !== 'exact',
    substitute_reason: opts.reason || 'Out of stock — approved same-category brand',
    original_ordered_product_id: orderedId,
  };

  return {
    ok: true,
    fidelity,
    credit,
    message:
      fidelity === 'exact'
        ? 'Same brand as ordered'
        : 'Approved same-category substitute — half SP compliance credit',
    line: next,
  };
}

/** Map delivery + PO status into a simple progress index 0..n */
export function lifecycleProgress(opts: {
  poStatus?: string | null;
  deliveryStatus?: string | null;
}): { step: number; total: number; label: string } {
  const po = String(opts.poStatus || '').toLowerCase();
  const dn = String(opts.deliveryStatus || '').toLowerCase();
  const total = PO_LIFECYCLE.length;
  if (['received', 'closed', 'complete', 'partially_received'].includes(po) || dn === 'received') {
    return { step: total, total, label: trailLabel('received') };
  }
  if (dn === 'delivered' || po === 'delivered') {
    return { step: 5, total, label: trailLabel('delivered') };
  }
  if (dn === 'dispatched' || po === 'dispatched') {
    return { step: 4, total, label: trailLabel('dispatched') };
  }
  if (['accepted', 'confirmed', 'fulfilling'].includes(po) || ['confirmed', 'draft'].includes(dn)) {
    return { step: 3, total, label: trailLabel(po === 'accepted' ? 'accepted' : 'fulfilling') };
  }
  if (po === 'submitted') {
    return { step: 1, total, label: trailLabel('submitted') };
  }
  return { step: 0, total, label: 'Not started' };
}
