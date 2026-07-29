/**
 * Partial GRN → remaining backorder on the school PO.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type BackorderLine = {
  approved_product_id: number | null;
  product_name: string;
  brand_name: string;
  uom: string;
  qty_ordered: number;
  qty_received_total: number;
  qty_remaining: number;
  unit_price?: number;
};

export type BackorderResult = {
  fully_received: boolean;
  received_pct: number;
  backorder_lines: BackorderLine[];
  po_status: string;
};

function lineKey(l: {
  approved_product_id?: number | null;
  product_name?: string;
}) {
  const pid = l.approved_product_id != null ? Number(l.approved_product_id) : 0;
  if (pid > 0) return `id:${pid}`;
  return `n:${String(l.product_name || '').toLowerCase().trim()}`;
}

/**
 * After a school GRN, recompute PO remaining qty across all non-cancelled DNs.
 * Updates PO to partially_received or received and stores backorder metadata.
 */
export async function applyPoBackorderAfterGrn(
  supabase: SupabaseClient,
  opts: {
    poId: number;
    now?: string;
  }
): Promise<BackorderResult | null> {
  const now = opts.now || new Date().toISOString();
  const { data: po } = await supabase
    .from('school_purchase_orders')
    .select('id, lines, status, metadata, isp_profile_id, school_profile_id, profile_id')
    .eq('id', opts.poId)
    .maybeSingle();
  if (!po) return null;

  const poLines = Array.isArray(po.lines)
    ? (po.lines as Array<Record<string, unknown>>)
    : [];
  if (!poLines.length) return null;

  const { data: dns } = await supabase
    .from('school_nsnp_deliveries')
    .select('id, status, lines')
    .eq('po_id', opts.poId)
    .neq('status', 'cancelled')
    .limit(50);

  const receivedByKey = new Map<string, number>();
  for (const d of dns || []) {
    // Count qty only once received (or partially via qty_received on lines)
    const st = String(d.status);
    if (!['received', 'partially_received', 'delivered', 'dispatched'].includes(st)) {
      // still count qty_received if school entered some
    }
    const lines = Array.isArray(d.lines)
      ? (d.lines as Array<Record<string, unknown>>)
      : [];
    for (const l of lines) {
      const key = lineKey({
        approved_product_id: l.approved_product_id as number | null,
        product_name: String(l.product_name || ''),
      });
      // Prefer explicit received; on received status fall back to delivered
      let qty = Number(l.qty_received ?? 0);
      if (!(qty > 0) && st === 'received') {
        qty = Number(l.qty_delivered ?? l.qty_ordered ?? 0);
      }
      if (qty > 0) {
        receivedByKey.set(key, (receivedByKey.get(key) || 0) + qty);
      }
    }
  }

  const backorder_lines: BackorderLine[] = [];
  let orderedTotal = 0;
  let receivedTotal = 0;

  for (const l of poLines) {
    const ordered = Number(l.qty || 0);
    if (!(ordered > 0)) continue;
    const key = lineKey({
      approved_product_id: l.approved_product_id as number | null,
      product_name: String(l.product_name || ''),
    });
    const got = receivedByKey.get(key) || 0;
    orderedTotal += ordered;
    receivedTotal += Math.min(got, ordered);
    const remaining = Math.max(0, Math.round((ordered - got) * 1000) / 1000);
    if (remaining > 0) {
      backorder_lines.push({
        approved_product_id: l.approved_product_id
          ? Number(l.approved_product_id)
          : null,
        product_name: String(l.product_name || ''),
        brand_name: String(l.brand_name || ''),
        uom: String(l.uom || 'kg'),
        qty_ordered: ordered,
        qty_received_total: got,
        qty_remaining: remaining,
        unit_price: Number(l.unit_price || 0) || undefined,
      });
    }
  }

  const received_pct =
    orderedTotal > 0
      ? Math.min(100, Math.round((receivedTotal / orderedTotal) * 1000) / 10)
      : 100;
  const fully_received = backorder_lines.length === 0;
  const po_status = fully_received ? 'received' : 'partially_received';

  const prevMeta =
    po.metadata && typeof po.metadata === 'object'
      ? (po.metadata as Record<string, unknown>)
      : {};

  const patch: Record<string, unknown> = {
    status: po_status,
    delivery_status: po_status,
    received_pct: received_pct,
    metadata: {
      ...prevMeta,
      backorder: !fully_received,
      backorder_lines,
      backorder_updated_at: now,
      last_grn_at: now,
    },
    updated_at: now,
  };
  if (fully_received) {
    patch.received_at = now;
    patch.received_pct = 100;
  }

  await supabase
    .from('school_purchase_orders')
    .update(patch)
    .eq('id', opts.poId);

  return {
    fully_received,
    received_pct,
    backorder_lines,
    po_status,
  };
}
