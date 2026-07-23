/**
 * Capture production-order labor: hours × cell/station rate → cost entry.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';

export type CaptureLaborResult = {
  ok: boolean;
  laborHours: number;
  laborRate: number;
  laborCost: number;
  costEntryId: number | null;
  currency: string;
  message: string;
  skipped?: boolean;
};

function hoursBetween(
  start: string | null | undefined,
  end: string | null | undefined
): number | null {
  if (!start || !end) return null;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  const h = (b - a) / 3600000;
  return Math.round(h * 10000) / 10000;
}

/**
 * Post or update labor cost for a production order.
 * - Uses explicit hours, else elapsed actual_start→actual_end.
 * - Rate from work station, else work centre cost_per_hour.
 * - Creates/updates manufacturing_cost_entries (category labour).
 */
export async function captureProductionOrderLabor(opts: {
  companyId: number;
  orderId: number;
  /** Override hours; 0 means “clear/skip” if replace */
  laborHours?: number | null;
  /** If true and hours omitted, use wall-clock actual_start→actual_end */
  useElapsed?: boolean;
  /** If true, replace existing capture; default true for complete, false for incremental add */
  replace?: boolean;
  /** Optional note suffix */
  note?: string | null;
}): Promise<CaptureLaborResult> {
  const supabase = getSupabaseServer();
  const companyId = opts.companyId;
  const orderId = opts.orderId;

  const { data: order, error: loadErr } = await supabase
    .from('manufacturing_production_orders')
    .select(
      'id, profile_id, order_number, work_center_id, work_station_id, actual_start, actual_end, labor_hours, labor_cost, labor_rate, labor_cost_entry_id, status'
    )
    .eq('id', orderId)
    .eq('profile_id', companyId)
    .maybeSingle();

  if (loadErr || !order) {
    return {
      ok: false,
      laborHours: 0,
      laborRate: 0,
      laborCost: 0,
      costEntryId: null,
      currency: 'ZAR',
      message: loadErr?.message || 'Order not found',
    };
  }

  let hours =
    opts.laborHours != null && Number.isFinite(Number(opts.laborHours))
      ? Math.max(0, Number(opts.laborHours))
      : null;

  if (hours == null && opts.useElapsed !== false) {
    const end = order.actual_end || new Date().toISOString();
    hours = hoursBetween(order.actual_start, end);
  }

  if (hours == null || hours <= 0) {
    return {
      ok: true,
      skipped: true,
      laborHours: Number(order.labor_hours || 0),
      laborRate: Number(order.labor_rate || 0),
      laborCost: Number(order.labor_cost || 0),
      costEntryId: order.labor_cost_entry_id
        ? Number(order.labor_cost_entry_id)
        : null,
      currency: 'ZAR',
      message:
        'No labor hours to capture — set hours or ensure actual start/end times exist',
    };
  }

  // Resolve rate: station → work centre
  let rate = 0;
  let businessUnitId: number | null = null;
  let workCenterId = order.work_center_id
    ? Number(order.work_center_id)
    : null;
  let workStationId = order.work_station_id
    ? Number(order.work_station_id)
    : null;

  if (workStationId) {
    const { data: st } = await supabase
      .from('manufacturing_work_stations')
      .select('id, cost_per_hour, work_center_id, business_unit_id')
      .eq('id', workStationId)
      .eq('profile_id', companyId)
      .maybeSingle();
    if (st) {
      rate = Number(st.cost_per_hour || 0);
      if (st.work_center_id) workCenterId = Number(st.work_center_id);
      if (st.business_unit_id) businessUnitId = Number(st.business_unit_id);
    }
  }

  if (workCenterId) {
    const { data: wc } = await supabase
      .from('manufacturing_work_centers')
      .select('id, cost_per_hour, business_unit_id')
      .eq('id', workCenterId)
      .eq('profile_id', companyId)
      .maybeSingle();
    if (wc) {
      if (rate <= 0) rate = Number(wc.cost_per_hour || 0);
      if (!businessUnitId && wc.business_unit_id) {
        businessUnitId = Number(wc.business_unit_id);
      }
    }
  }

  if (rate <= 0) {
    return {
      ok: false,
      laborHours: hours,
      laborRate: 0,
      laborCost: 0,
      costEntryId: null,
      currency: 'ZAR',
      message:
        'No cost rate on work cell/station — set cost_per_hour on the cell or station first',
    };
  }

  const cost = Math.round(hours * rate * 100) / 100;
  const currency = 'ZAR';
  const description = [
    `Labor WO ${order.order_number}`,
    `${hours}h × ${rate}/h`,
    opts.note ? String(opts.note).slice(0, 120) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  let costEntryId = order.labor_cost_entry_id
    ? Number(order.labor_cost_entry_id)
    : null;
  const now = new Date().toISOString();
  const entryDate = (order.actual_end || now).slice(0, 10);

  const entryPayload = {
    profile_id: companyId,
    entry_date: entryDate,
    amount: cost,
    currency,
    category: 'labour',
    description,
    reference: order.order_number,
    business_unit_id: businessUnitId,
    work_center_id: workCenterId,
    work_station_id: workStationId,
    asset_id: null as number | null,
    production_order_id: orderId,
    is_recurring: false,
    metadata: {
      source: 'production_order_labor',
      order_id: orderId,
      labor_hours: hours,
      labor_rate: rate,
    },
    updated_at: now,
  };

  try {
    if (costEntryId && opts.replace !== false) {
      const { error: upErr } = await supabase
        .from('manufacturing_cost_entries')
        .update(entryPayload)
        .eq('id', costEntryId)
        .eq('profile_id', companyId);
      if (upErr) {
        // entry missing — create new
        costEntryId = null;
      }
    }

    if (!costEntryId) {
      const { data: created, error: insErr } = await supabase
        .from('manufacturing_cost_entries')
        .insert(entryPayload)
        .select('id')
        .single();
      if (insErr) {
        return {
          ok: false,
          laborHours: hours,
          laborRate: rate,
          laborCost: cost,
          costEntryId: null,
          currency,
          message:
            insErr.message +
            ' — run 20260720_manufacturing_cost_structure.sql + 20260720_production_order_labor_cost.sql',
        };
      }
      costEntryId = Number(created.id);
    }
  } catch (e: unknown) {
    return {
      ok: false,
      laborHours: hours,
      laborRate: rate,
      laborCost: cost,
      costEntryId: null,
      currency,
      message: e instanceof Error ? e.message : 'Cost entry failed',
    };
  }

  // Soft-update order labor fields (columns may be missing pre-migration)
  const orderUpdates: Record<string, unknown> = {
    labor_hours: hours,
    labor_rate: rate,
    labor_cost: cost,
    labor_cost_entry_id: costEntryId,
    labor_captured_at: now,
    updated_at: now,
  };
  if (workStationId) orderUpdates.work_station_id = workStationId;

  // Post to Chart of Accounts / journal (Dr labour COGS, Cr accruals)
  let glNote = '';
  try {
    const { postManufacturingCostEntryToGl } = await import(
      '@/lib/manufacturing/post-cost-to-gl'
    );
    const gl = await postManufacturingCostEntryToGl({
      companyId,
      costEntryId: costEntryId!,
      force: opts.replace !== false,
    });
    if (gl.ok && gl.journalId) {
      orderUpdates.labor_journal_entry_id = gl.journalId;
      glNote = gl.skipped
        ? ` · GL JE #${gl.journalId} (existing)`
        : ` · GL ${gl.entryNumber || gl.journalId}`;
    } else if (!gl.ok && gl.error) {
      glNote = ` · GL soft-skip: ${gl.error}`;
    }
  } catch (e: unknown) {
    glNote = ` · GL soft-skip: ${e instanceof Error ? e.message : 'post failed'}`;
  }

  const { error: ordErr } = await supabase
    .from('manufacturing_production_orders')
    .update(orderUpdates)
    .eq('id', orderId)
    .eq('profile_id', companyId);

  if (ordErr) {
    // Cost entry may still exist; report partial success
    return {
      ok: true,
      laborHours: hours,
      laborRate: rate,
      laborCost: cost,
      costEntryId,
      currency,
      message: `Labor posted (${cost} ${currency}) but order fields need migration: ${ordErr.message}${glNote}`,
    };
  }

  return {
    ok: true,
    laborHours: hours,
    laborRate: rate,
    laborCost: cost,
    costEntryId,
    currency,
    message: `Labor ${hours}h × ${rate} = ${cost} ${currency} → cost centre + COA${glNote}`,
  };
}
