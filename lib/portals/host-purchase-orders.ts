import { getSupabaseServer } from '@/lib/supabase/server-client';
import { poHostedByBuyer } from '@/lib/portals/supplier-portal-party';

const PO_WIDE =
  'id, po_number, order_number, status, created_at, promised_date, actual_delivery_date, actual_completion_date, order_quantity, delivered_quantity, damaged_quantity, total_amount, currency, supplier_id, supplier_profile_id, items, metadata, production_status, confirmed_qty, buyer_profile_id';
const PO_SOFT =
  'id, po_number, order_number, status, created_at, promised_date, actual_delivery_date, order_quantity, delivered_quantity, damaged_quantity, total_amount, currency, supplier_id, supplier_profile_id, items, metadata, buyer_profile_id';

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

/**
 * Buyer POs for this company: buyer_profile_id = companyId, or (when that
 * is null) profile_id / company_id = companyId.
 */
export async function loadHostPurchaseOrders(opts: {
  companyId: number;
  limit?: number;
}): Promise<Record<string, unknown>[]> {
  const companyId = Number(opts.companyId);
  if (!Number.isFinite(companyId) || companyId <= 0) return [];
  const limit = Math.min(Math.max(opts.limit || 80, 1), 200);
  const supabase = getSupabaseServer();

  const wide = await supabase
    .from('purchase_orders')
    .select(PO_WIDE)
    .eq('buyer_profile_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit);
  let owned: Record<string, unknown>[] = asRows(wide.data);
  if (wide.error) {
    const soft = await supabase
      .from('purchase_orders')
      .select(PO_SOFT)
      .eq('buyer_profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit);
    owned = asRows(soft.data);
  }

  const extraProfileWide = await supabase
    .from('purchase_orders')
    .select(PO_WIDE)
    .is('buyer_profile_id', null)
    .eq('profile_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit);
  let extra: Record<string, unknown>[] = [];
  if (!extraProfileWide.error) {
    extra = asRows(extraProfileWide.data);
  } else {
    const extraProfileSoft = await supabase
      .from('purchase_orders')
      .select(PO_SOFT)
      .is('buyer_profile_id', null)
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (!extraProfileSoft.error) {
      extra = asRows(extraProfileSoft.data);
    } else {
      const extraCompanyWide = await supabase
        .from('purchase_orders')
        .select(PO_WIDE)
        .is('buyer_profile_id', null)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!extraCompanyWide.error) {
        extra = asRows(extraCompanyWide.data);
      } else {
        const extraCompanySoft = await supabase
          .from('purchase_orders')
          .select(PO_SOFT)
          .is('buyer_profile_id', null)
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(limit);
        extra = asRows(extraCompanySoft.data);
      }
    }
  }

  return mergeById(owned, extra).filter((row) =>
    poHostedByBuyer(row, companyId)
  );
}
