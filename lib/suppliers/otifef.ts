import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  clampPct,
  computeOtifef,
  computeTrustScore,
  type OtifefMetrics,
  type SupplierOtifefRow,
} from '@/lib/suppliers/types';

type PoRow = {
  id: number;
  supplier_id?: number | null;
  supplier_profile_id?: number | null;
  promised_date?: string | null;
  actual_delivery_date?: string | null;
  order_quantity?: number | null;
  delivered_quantity?: number | null;
  damaged_quantity?: number | null;
  profiles?: { trading_name?: string | null } | { trading_name?: string | null }[] | null;
};

function supplierIdFromPo(po: PoRow): number | null {
  const a = po.supplier_profile_id ?? po.supplier_id;
  const n = Number(a);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function nameFromPo(po: PoRow): string {
  const p = po.profiles;
  if (Array.isArray(p)) return p[0]?.trading_name || 'Unknown supplier';
  return p?.trading_name || 'Unknown supplier';
}

/**
 * Aggregate OTIFEF from delivered POs in a date range for a buyer company.
 * Matches existing hub formula; returns per-supplier rows + portfolio summary.
 */
export async function computeBuyerOtifef(opts: {
  buyerProfileId?: number | null;
  fromDate: string;
  toDate: string;
}): Promise<{
  rows: SupplierOtifefRow[];
  summary: OtifefMetrics;
  warning?: string;
}> {
  const supabase = getSupabaseServer();
  let q = supabase
    .from('purchase_orders')
    .select(
      `
      id,
      supplier_id,
      supplier_profile_id,
      buyer_profile_id,
      promised_date,
      actual_delivery_date,
      order_quantity,
      delivered_quantity,
      damaged_quantity
    `
    )
    .gte('actual_delivery_date', opts.fromDate)
    .lte('actual_delivery_date', opts.toDate)
    .not('actual_delivery_date', 'is', null)
    .limit(5000);

  if (opts.buyerProfileId && Number.isFinite(opts.buyerProfileId)) {
    q = q.eq('buyer_profile_id', opts.buyerProfileId);
  }

  const { data: pos, error } = await q;
  if (error) {
    return {
      rows: [],
      summary: emptySummary(),
      warning: error.message,
    };
  }

  // Enrich names
  const ids = [
    ...new Set(
      (pos || [])
        .map((p) => supplierIdFromPo(p as PoRow))
        .filter((x): x is number => x != null)
    ),
  ];
  const nameMap: Record<number, string> = {};
  if (ids.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, trading_name')
      .in('id', ids);
    for (const p of profiles || []) {
      nameMap[Number(p.id)] = p.trading_name || 'Unknown supplier';
    }
  }

  const map = new Map<
    number,
    {
      id: number;
      name: string;
      total_pos: number;
      on_time_count: number;
      ot_days_sum: number;
      total_ordered: number;
      total_delivered: number;
      total_damaged: number;
    }
  >();

  for (const raw of pos || []) {
    const po = raw as PoRow;
    const sid = supplierIdFromPo(po);
    if (!sid) continue;
    if (!map.has(sid)) {
      map.set(sid, {
        id: sid,
        name: nameMap[sid] || 'Unknown supplier',
        total_pos: 0,
        on_time_count: 0,
        ot_days_sum: 0,
        total_ordered: 0,
        total_delivered: 0,
        total_damaged: 0,
      });
    }
    const s = map.get(sid)!;
    s.total_pos += 1;
    if (po.promised_date && po.actual_delivery_date) {
      if (po.actual_delivery_date <= po.promised_date) s.on_time_count += 1;
      const daysDiff =
        (new Date(po.promised_date).getTime() - new Date(po.actual_delivery_date).getTime()) /
        (1000 * 3600 * 24);
      s.ot_days_sum += daysDiff;
    }
    s.total_ordered += Number(po.order_quantity || 0);
    s.total_delivered += Number(po.delivered_quantity || 0);
    s.total_damaged += Number(po.damaged_quantity || 0);
  }

  const rows: SupplierOtifefRow[] = Array.from(map.values()).map((s) => {
    const ot_percent = s.total_pos > 0 ? (s.on_time_count / s.total_pos) * 100 : 0;
    const if_percent = s.total_ordered > 0 ? (s.total_delivered / s.total_ordered) * 100 : 0;
    const ef_percent =
      s.total_delivered > 0
        ? ((s.total_delivered - s.total_damaged) / s.total_delivered) * 100
        : 0;
    const overall = computeOtifef({
      onTimePct: ot_percent,
      inFullPct: if_percent,
      errorFreePct: ef_percent,
    });
    return {
      supplier_id: s.id,
      name: s.name,
      overall,
      ot_percent: clampPct(ot_percent),
      if_percent: clampPct(if_percent),
      ef_percent: clampPct(ef_percent),
      ot_days: s.total_pos > 0 ? s.ot_days_sum / s.total_pos : 0,
      total_pos: s.total_pos,
    };
  });

  rows.sort((a, b) => b.overall - a.overall);

  const totalPOs = rows.reduce((sum, m) => sum + m.total_pos, 0);
  const summary: OtifefMetrics = {
    overall:
      rows.length > 0 ? rows.reduce((sum, m) => sum + m.overall, 0) / rows.length : 0,
    onTime:
      rows.length > 0 ? rows.reduce((sum, m) => sum + m.ot_percent, 0) / rows.length : 0,
    inFull:
      rows.length > 0 ? rows.reduce((sum, m) => sum + m.if_percent, 0) / rows.length : 0,
    errorFree:
      rows.length > 0 ? rows.reduce((sum, m) => sum + m.ef_percent, 0) / rows.length : 0,
    totalPOs,
    supplierCount: rows.length,
  };

  return { rows, summary };
}

/**
 * Persist scorecard snapshots for a buyer and refresh srm_suppliers.otifef_pct / trust_score.
 */
export async function persistScorecards(opts: {
  buyerProfileId: number;
  fromDate: string;
  toDate: string;
  rows: SupplierOtifefRow[];
}): Promise<void> {
  if (!opts.rows.length) return;
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();

  for (const row of opts.rows) {
    await supabase.from('supplier_scorecards').insert({
      buyer_profile_id: opts.buyerProfileId,
      supplier_profile_id: row.supplier_id,
      period_start: opts.fromDate,
      period_end: opts.toDate,
      total_pos: row.total_pos,
      on_time_pct: row.ot_percent,
      in_full_pct: row.if_percent,
      error_free_pct: row.ef_percent,
      otifef_pct: row.overall,
      updated_at: now,
    });

    // Update book entries linked to this platform profile
    const trust = computeTrustScore({
      otifef: row.overall,
      ratingAvg: null,
      verified: null,
    });
    await supabase
      .from('srm_suppliers')
      .update({
        otifef_pct: row.overall,
        trust_score: trust,
        updated_at: now,
      })
      .eq('profile_id', opts.buyerProfileId)
      .eq('linked_profile_id', row.supplier_id);
  }
}

function emptySummary(): OtifefMetrics {
  return {
    overall: 0,
    onTime: 0,
    inFull: 0,
    errorFree: 0,
    totalPOs: 0,
    supplierCount: 0,
  };
}
