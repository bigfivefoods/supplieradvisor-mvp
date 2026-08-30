import { getSupabaseServer } from '@/lib/supabase/server-client';
import { poHostedByBuyer } from '@/lib/portals/supplier-portal-party';
import {
  missingSelectColumn,
  stripSelectColumn,
} from '@/lib/portals/select-retry';

export const PO_WIDE =
  'id, po_number, status, created_at, promised_date, actual_delivery_date, actual_completion_date, order_quantity, delivered_quantity, damaged_quantity, total_amount, currency, supplier_id, supplier_profile_id, items, metadata, production_status, confirmed_qty, buyer_profile_id';
export const PO_SOFT =
  'id, po_number, status, created_at, promised_date, actual_delivery_date, order_quantity, delivered_quantity, damaged_quantity, total_amount, currency, supplier_id, supplier_profile_id, items, metadata, buyer_profile_id';

function asRows(data: unknown): Record<string, unknown>[] {
  return (Array.isArray(data) ? data : []) as unknown as Record<
    string,
    unknown
  >[];
}

function mergeById(
  ...lists: Record<string, unknown>[][]
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const seen = new Set<number>();
  for (const list of lists) {
    for (const row of list) {
      const id = Number(row.id);
      if (!Number.isFinite(id) || seen.has(id)) continue;
      seen.add(id);
      out.push(row);
    }
  }
  return out;
}

type PoHit = { data: unknown; error: { message?: string } | null };

async function runPoSelect(
  startCols: string,
  run: (cols: string) => Promise<PoHit>
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  let cols = startCols;
  let last: string | null = null;
  for (let i = 0; i < 8; i++) {
    const hit = await run(cols);
    if (!hit.error) return { rows: asRows(hit.data), error: null };
    last = hit.error.message || 'select failed';
    const missing = missingSelectColumn(last);
    if (!missing) return { rows: [], error: last };
    const next = stripSelectColumn(cols, missing);
    if (!next || next === cols) return { rows: [], error: last };
    cols = next;
  }
  return { rows: [], error: last };
}

/**
 * Buyer POs for this company: buyer_profile_id = companyId, or (when that
 * is null) profile_id / company_id = companyId.
 * Live purchase_orders has po_number, not order_number.
 */
export async function loadHostPurchaseOrders(opts: {
  companyId: number;
  limit?: number;
}): Promise<Record<string, unknown>[]> {
  const companyId = Number(opts.companyId);
  if (!Number.isFinite(companyId) || companyId <= 0) return [];
  const limit = Math.min(Math.max(opts.limit || 80, 1), 200);
  const supabase = getSupabaseServer();

  const owned = await runPoSelect(PO_WIDE, async (cols) => {
    const hit = await supabase
      .from('purchase_orders')
      .select(cols as never)
      .eq('buyer_profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data: hit.data, error: hit.error };
  });
  let rows = owned.rows;
  if (owned.error && !rows.length) {
    const soft = await runPoSelect(PO_SOFT, async (cols) => {
      const hit = await supabase
        .from('purchase_orders')
        .select(cols as never)
        .eq('buyer_profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(limit);
      return { data: hit.data, error: hit.error };
    });
    if (soft.rows.length) rows = soft.rows;
  }

  const extraProfile = await runPoSelect(PO_WIDE, async (cols) => {
    const hit = await supabase
      .from('purchase_orders')
      .select(cols as never)
      .is('buyer_profile_id', null)
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data: hit.data, error: hit.error };
  });
  let extra = extraProfile.rows;
  if (extraProfile.error && !extra.length) {
    const extraCompany = await runPoSelect(PO_WIDE, async (cols) => {
      const hit = await supabase
        .from('purchase_orders')
        .select(cols as never)
        .is('buyer_profile_id', null)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(limit);
      return { data: hit.data, error: hit.error };
    });
    extra = extraCompany.rows;
  }

  return mergeById(rows, extra).filter((row) =>
    poHostedByBuyer(row, companyId)
  );
}
