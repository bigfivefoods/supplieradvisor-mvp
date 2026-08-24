/**
 * OTIFEF of our deliveries to customers (sales orders).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  clampPct,
  computeOtifef,
  type OtifefMetrics,
} from '@/lib/suppliers/types';

export type CustomerOtifefRow = {
  customer_id: number;
  name: string;
  overall: number;
  ot_percent: number;
  if_percent: number;
  ef_percent: number;
  total_orders: number;
};

function asObj(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function lineQty(items: unknown): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((n, it) => {
    const row = asObj(it);
    return n + Number(row.qty || row.quantity || 0);
  }, 0);
}

export async function computeCustomerOtifef(opts: {
  sellerProfileId: number;
  fromDate: string;
  toDate: string;
}): Promise<{
  rows: CustomerOtifefRow[];
  summary: OtifefMetrics;
  warning?: string;
}> {
  const empty: OtifefMetrics = {
    overall: 0,
    onTime: 0,
    inFull: 0,
    errorFree: 0,
    totalPOs: 0,
    supplierCount: 0,
  };
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('sales_orders')
    .select(
      'id, customer_id, customer_name, promised_date, shipped_date, items, status'
    )
    .eq('profile_id', opts.sellerProfileId)
    .not('shipped_date', 'is', null)
    .gte('shipped_date', opts.fromDate)
    .lte('shipped_date', opts.toDate)
    .limit(5000);
  if (error) {
    return { rows: [], summary: empty, warning: error.message };
  }

  type Acc = {
    customer_id: number;
    name: string;
    total: number;
    on_time: number;
    ordered: number;
    delivered: number;
    damaged: number;
  };
  const map = new Map<number, Acc>();
  for (const raw of data || []) {
    const r = asObj(raw);
    const cid = Number(r.customer_id);
    if (!(cid > 0)) continue;
    const promised = r.promised_date ? String(r.promised_date).slice(0, 10) : '';
    const actual = r.shipped_date ? String(r.shipped_date).slice(0, 10) : '';
    const qty = lineQty(r.items) || 1;
    if (!map.has(cid)) {
      map.set(cid, {
        customer_id: cid,
        name: String(r.customer_name || `Customer #${cid}`),
        total: 0,
        on_time: 0,
        ordered: 0,
        delivered: 0,
        damaged: 0,
      });
    }
    const a = map.get(cid)!;
    a.total += 1;
    if (promised && actual && actual <= promised) a.on_time += 1;
    a.ordered += qty;
    a.delivered += qty;
  }

  const rows: CustomerOtifefRow[] = Array.from(map.values())
    .map((a) => {
      const ot = a.total > 0 ? (a.on_time / a.total) * 100 : 0;
      const inf = a.ordered > 0 ? (a.delivered / a.ordered) * 100 : 0;
      const ef =
        a.delivered > 0
          ? ((a.delivered - a.damaged) / a.delivered) * 100
          : 100;
      return {
        customer_id: a.customer_id,
        name: a.name,
        overall: computeOtifef({
          onTimePct: ot,
          inFullPct: inf,
          errorFreePct: ef,
        }),
        ot_percent: clampPct(ot),
        if_percent: clampPct(inf),
        ef_percent: clampPct(ef),
        total_orders: a.total,
      };
    })
    .sort((a, b) => b.overall - a.overall);

  const n = rows.length;
  const summary: OtifefMetrics = {
    overall: n ? rows.reduce((s, r) => s + r.overall, 0) / n : 0,
    onTime: n ? rows.reduce((s, r) => s + r.ot_percent, 0) / n : 0,
    inFull: n ? rows.reduce((s, r) => s + r.if_percent, 0) / n : 0,
    errorFree: n ? rows.reduce((s, r) => s + r.ef_percent, 0) / n : 0,
    totalPOs: rows.reduce((s, r) => s + r.total_orders, 0),
    supplierCount: n,
  };
  return { rows, summary };
}
