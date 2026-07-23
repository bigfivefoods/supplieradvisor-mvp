/**
 * Allocate purchase order totals to manufacturing cost objects + GL journals.
 *
 * On complete / paid / explicit allocate:
 *   - Create manufacturing_cost_entries (one or multi-split)
 *   - Post Dr Expense/Materials  Cr AP/Accrued (with cost dimensions on lines)
 *   - Stamp PO cost_allocated_at, cost_entry_id, cost_journal_entry_id
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  postBalancedJournal,
  resolveCoaAccountId,
  resolveCoaAccountIdByCode,
} from '@/lib/accounting/post-journal';
import {
  postManufacturingCostEntryToGl,
  resolveGlFromCostObjects,
  resolveManufacturingCreditAccount,
} from '@/lib/manufacturing/post-cost-to-gl';
import { round2 } from '@/lib/accounting/server';
import { resolveDebitAccountForCategory } from '@/lib/accounting/balance-sheet-allocate';

export type CostAllocationSplit = {
  business_unit_id?: number | null;
  work_center_id?: number | null;
  work_station_id?: number | null;
  asset_id?: number | null;
  /** Share of PO total (0–100). If omitted with amount, amount is used. */
  pct?: number | null;
  amount?: number | null;
  description?: string | null;
};

export type PoCostDims = {
  business_unit_id?: number | null;
  work_center_id?: number | null;
  work_station_id?: number | null;
  asset_id?: number | null;
  cost_category?: string | null;
  cost_allocations?: CostAllocationSplit[] | null;
};

export function hasCostObject(d: {
  business_unit_id?: number | null;
  work_center_id?: number | null;
  work_station_id?: number | null;
  asset_id?: number | null;
}): boolean {
  return Boolean(
    (d.business_unit_id && Number(d.business_unit_id) > 0) ||
      (d.work_center_id && Number(d.work_center_id) > 0) ||
      (d.work_station_id && Number(d.work_station_id) > 0) ||
      (d.asset_id && Number(d.asset_id) > 0)
  );
}

export function parseCostAllocations(raw: unknown): CostAllocationSplit[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === 'object')
    .map((r) => {
      const o = r as Record<string, unknown>;
      return {
        business_unit_id:
          o.business_unit_id != null ? Number(o.business_unit_id) : null,
        work_center_id:
          o.work_center_id != null ? Number(o.work_center_id) : null,
        work_station_id:
          o.work_station_id != null ? Number(o.work_station_id) : null,
        asset_id: o.asset_id != null ? Number(o.asset_id) : null,
        pct: o.pct != null ? Number(o.pct) : null,
        amount: o.amount != null ? Number(o.amount) : null,
        description: o.description != null ? String(o.description) : null,
      };
    })
    .filter((s) => hasCostObject(s));
}

/** Normalise body cost fields for PO insert/update */
export function normalizePoCostFields(body: Record<string, unknown>): {
  fields: Record<string, unknown>;
  error?: string;
} {
  const bu =
    body.business_unit_id != null && body.business_unit_id !== ''
      ? Number(body.business_unit_id)
      : null;
  const wc =
    body.work_center_id != null && body.work_center_id !== ''
      ? Number(body.work_center_id)
      : null;
  const ws =
    body.work_station_id != null && body.work_station_id !== ''
      ? Number(body.work_station_id)
      : null;
  const asset =
    body.asset_id != null && body.asset_id !== ''
      ? Number(body.asset_id)
      : null;

  for (const [label, n] of [
    ['business_unit_id', bu],
    ['work_center_id', wc],
    ['work_station_id', ws],
    ['asset_id', asset],
  ] as const) {
    if (n != null && (!Number.isFinite(n) || n <= 0)) {
      return { fields: {}, error: `Invalid ${label}` };
    }
  }

  let allocations: CostAllocationSplit[] = [];
  if (body.cost_allocations != null) {
    allocations = parseCostAllocations(body.cost_allocations);
    if (Array.isArray(body.cost_allocations) && body.cost_allocations.length > 0 && allocations.length === 0) {
      return {
        fields: {},
        error:
          'Each cost allocation split needs a business unit, work centre, station, or asset',
      };
    }
    const pctSum = allocations.reduce(
      (s, a) => s + (Number.isFinite(Number(a.pct)) ? Number(a.pct) : 0),
      0
    );
    if (allocations.length > 1 && pctSum > 0 && Math.abs(pctSum - 100) > 0.5) {
      return {
        fields: {},
        error: `Cost allocation percentages must sum to 100 (got ${pctSum.toFixed(1)})`,
      };
    }
  }

  const category = body.cost_category
    ? String(body.cost_category).toLowerCase().slice(0, 40)
    : 'materials';

  const fields: Record<string, unknown> = {
    business_unit_id: bu && bu > 0 ? bu : null,
    work_center_id: wc && wc > 0 ? wc : null,
    work_station_id: ws && ws > 0 ? ws : null,
    asset_id: asset && asset > 0 ? asset : null,
    cost_category: category,
    cost_allocations: allocations,
  };
  return { fields };
}

function resolveSplits(
  po: Record<string, unknown>,
  total: number
): Array<CostAllocationSplit & { amount: number }> {
  const header: CostAllocationSplit = {
    business_unit_id: po.business_unit_id
      ? Number(po.business_unit_id)
      : null,
    work_center_id: po.work_center_id ? Number(po.work_center_id) : null,
    work_station_id: po.work_station_id ? Number(po.work_station_id) : null,
    asset_id: po.asset_id ? Number(po.asset_id) : null,
  };

  const rawSplits = parseCostAllocations(po.cost_allocations);
  const splits =
    rawSplits.length > 0
      ? rawSplits
      : hasCostObject(header)
        ? [{ ...header, pct: 100 }]
        : [];

  if (splits.length === 0) return [];

  const withAmounts: Array<CostAllocationSplit & { amount: number }> = [];
  let assigned = 0;
  for (let i = 0; i < splits.length; i++) {
    const s = splits[i];
    let amt: number;
    if (s.amount != null && Number.isFinite(Number(s.amount)) && Number(s.amount) > 0) {
      amt = round2(Number(s.amount));
    } else if (s.pct != null && Number.isFinite(Number(s.pct))) {
      amt = round2((total * Number(s.pct)) / 100);
    } else if (splits.length === 1) {
      amt = total;
    } else {
      amt = 0;
    }
    // Last split absorbs rounding
    if (i === splits.length - 1 && assigned + amt !== total && total > 0) {
      amt = round2(total - assigned);
    }
    assigned = round2(assigned + amt);
    if (amt > 0.004 && hasCostObject(s)) {
      withAmounts.push({ ...s, amount: amt });
    }
  }
  return withAmounts;
}

export type AllocatePoCostResult = {
  ok: boolean;
  skipped?: boolean;
  costEntryIds?: number[];
  journalIds?: number[];
  entryNumbers?: string[];
  error?: string;
  warning?: string;
};

/**
 * Post PO cost to manufacturing cost entries + GL. Idempotent when already allocated.
 */
export async function allocatePurchaseOrderCost(opts: {
  companyId: number;
  poId: number;
  createdBy?: string | null;
  force?: boolean;
  /** Override amount (defaults to PO total_amount / subtotal) */
  amount?: number | null;
}): Promise<AllocatePoCostResult> {
  const supabase = getSupabaseServer();
  const { data: po, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('id', opts.poId)
    .eq('buyer_profile_id', opts.companyId)
    .maybeSingle();

  if (error || !po) {
    return { ok: false, error: error?.message || 'Purchase order not found' };
  }

  if (po.cost_allocated_at && !opts.force) {
    return {
      ok: true,
      skipped: true,
      costEntryIds: po.cost_entry_id ? [Number(po.cost_entry_id)] : [],
      journalIds: po.cost_journal_entry_id
        ? [Number(po.cost_journal_entry_id)]
        : [],
    };
  }

  const total = round2(
    opts.amount != null && Number.isFinite(Number(opts.amount))
      ? Number(opts.amount)
      : Number(po.total_amount ?? po.subtotal ?? 0)
  );
  if (total < 0.005) {
    return { ok: true, skipped: true, error: 'Zero amount' };
  }

  const splits = resolveSplits(po as Record<string, unknown>, total);
  if (splits.length === 0) {
    return {
      ok: true,
      skipped: true,
      warning:
        'No cost object on PO — set business unit, work centre, station, or asset to allocate',
    };
  }

  const category = String(po.cost_category || 'materials').toLowerCase();
  const currency = String(po.currency || 'ZAR');
  const entryDate = String(
    po.actual_delivery_date ||
      po.promised_date ||
      po.updated_at ||
      new Date().toISOString()
  ).slice(0, 10);
  const baseDesc =
    po.description ||
    `PO #${po.id} procurement${po.supplier_name ? ` · ${po.supplier_name}` : ''}`;

  const costEntryIds: number[] = [];
  const journalIds: number[] = [];
  const entryNumbers: string[] = [];
  let lastWarning: string | undefined;

  // Prefer AP credit for procurement (2110), fall back to accrued
  const creditId =
    (await resolveCoaAccountIdByCode(opts.companyId, '2110')) ||
    (await resolveManufacturingCreditAccount(opts.companyId));

  for (const split of splits) {
    const payload: Record<string, unknown> = {
      profile_id: opts.companyId,
      entry_date: entryDate,
      amount: split.amount,
      currency,
      category,
      description: split.description || baseDesc,
      reference: `PO-${po.id}`,
      business_unit_id: split.business_unit_id || null,
      work_center_id: split.work_center_id || null,
      work_station_id: split.work_station_id || null,
      asset_id: split.asset_id || null,
      purchase_order_id: opts.poId,
      is_recurring: false,
      metadata: {
        source: 'purchase_order',
        purchase_order_id: opts.poId,
        allocation_pct: split.pct ?? null,
      },
      updated_at: new Date().toISOString(),
    };

    let { data: costEntry, error: ceErr } = await supabase
      .from('manufacturing_cost_entries')
      .insert(payload)
      .select('*')
      .single();

    // Soft retry without purchase_order_id if column missing
    if (ceErr && /column|schema cache|does not exist/i.test(ceErr.message)) {
      const { purchase_order_id: _po, ...rest } = payload;
      const retry = await supabase
        .from('manufacturing_cost_entries')
        .insert({
          ...rest,
          metadata: {
            ...(payload.metadata as object),
            purchase_order_id: opts.poId,
          },
        })
        .select('*')
        .single();
      costEntry = retry.data;
      ceErr = retry.error;
    }

    if (ceErr || !costEntry) {
      return {
        ok: false,
        error: ceErr?.message || 'Failed to create cost entry',
        costEntryIds,
        journalIds,
      };
    }
    costEntryIds.push(Number(costEntry.id));

    // Prefer BS asset accounts for materials/capital; else expense from cost objects
    const bsDebit = await resolveDebitAccountForCategory(opts.companyId, category);
    const expenseId =
      bsDebit.accountId ||
      (await resolveGlFromCostObjects({
        companyId: opts.companyId,
        category,
        businessUnitId: split.business_unit_id,
        workCenterId: split.work_center_id,
        workStationId: split.work_station_id,
        assetId: split.asset_id,
      }));

    if (!expenseId || !creditId) {
      lastWarning =
        'COA missing expense/inventory/PPE or AP accounts — cost entry saved, seed Chart of Accounts to post GL';
      continue;
    }
    if (expenseId === creditId) {
      lastWarning = 'Expense and credit GL accounts must differ';
      continue;
    }

    const memo = String(payload.description).slice(0, 500);
    const dims = {
      businessUnitId: split.business_unit_id,
      workCenterId: split.work_center_id,
      workStationId: split.work_station_id,
      assetId: split.asset_id,
      purchaseOrderId: opts.poId,
    };
    const debitLabel = bsDebit.onBalanceSheet
      ? category === 'capital' ||
        ['ppe', 'equipment', 'fixed_asset', 'asset', 'machinery'].includes(category)
        ? 'PPE / fixed asset'
        : 'Inventory'
      : 'Expense';

    const posted = await postBalancedJournal({
      profileId: opts.companyId,
      entryDate,
      memo,
      source: 'purchase_order',
      sourceId: String(po.id),
      currency,
      createdBy: opts.createdBy || null,
      metadata: {
        purchase_order_id: po.id,
        manufacturing_cost_entry_id: costEntry.id,
        category,
        on_balance_sheet: bsDebit.onBalanceSheet,
        business_unit_id: split.business_unit_id,
        work_center_id: split.work_center_id,
        work_station_id: split.work_station_id,
        asset_id: split.asset_id,
      },
      lines: [
        {
          accountId: expenseId,
          debit: split.amount,
          credit: 0,
          memo: `${memo} · ${debitLabel}`,
          ...dims,
        },
        {
          accountId: creditId,
          debit: 0,
          credit: split.amount,
          memo: `AP (liability) for PO #${po.id}`,
          purchaseOrderId: opts.poId,
          businessUnitId: dims.businessUnitId,
          workCenterId: dims.workCenterId,
        },
      ],
    });

    if (posted.ok) {
      journalIds.push(posted.journalId);
      entryNumbers.push(posted.entryNumber);
      await supabase
        .from('manufacturing_cost_entries')
        .update({
          gl_account_id: expenseId,
          journal_entry_id: posted.journalId,
          updated_at: new Date().toISOString(),
          metadata: {
            ...(typeof costEntry.metadata === 'object' && costEntry.metadata
              ? (costEntry.metadata as object)
              : {}),
            journal_entry_number: posted.entryNumber,
            gl_credit_account_id: creditId,
            on_balance_sheet: bsDebit.onBalanceSheet,
          },
        })
        .eq('id', costEntry.id)
        .eq('profile_id', opts.companyId);
    } else {
      // Fallback: use manufacturing cost→GL helper
      try {
        const gl = await postManufacturingCostEntryToGl({
          companyId: opts.companyId,
          costEntryId: Number(costEntry.id),
          createdBy: opts.createdBy || null,
        });
        if (gl.ok && gl.journalId) {
          journalIds.push(gl.journalId);
          if (gl.entryNumber) entryNumbers.push(gl.entryNumber);
        } else if (gl.error) {
          lastWarning = gl.error;
        }
      } catch (e: unknown) {
        lastWarning =
          e instanceof Error ? e.message : posted.error || 'GL post failed';
      }
    }
  }

  const stamp: Record<string, unknown> = {
    cost_allocated_at: new Date().toISOString(),
    cost_entry_id: costEntryIds[0] ?? null,
    cost_journal_entry_id: journalIds[0] ?? null,
    gl_account_id: null,
    updated_at: new Date().toISOString(),
    metadata: {
      ...(typeof po.metadata === 'object' && po.metadata && !Array.isArray(po.metadata)
        ? (po.metadata as object)
        : {}),
      cost_allocation: {
        cost_entry_ids: costEntryIds,
        journal_ids: journalIds,
        entry_numbers: entryNumbers,
        allocated_at: new Date().toISOString(),
      },
    },
  };

  const { error: stampErr } = await supabase
    .from('purchase_orders')
    .update(stamp)
    .eq('id', opts.poId)
    .eq('buyer_profile_id', opts.companyId);

  if (stampErr && /column|schema cache|does not exist/i.test(stampErr.message)) {
    // Soft: only metadata
    await supabase
      .from('purchase_orders')
      .update({
        updated_at: new Date().toISOString(),
        metadata: stamp.metadata,
      })
      .eq('id', opts.poId)
      .eq('buyer_profile_id', opts.companyId);
  }

  return {
    ok: true,
    costEntryIds,
    journalIds,
    entryNumbers,
    warning: lastWarning,
  };
}

/** Resolve AP account for PO payments (credit side on allocate is AP) */
export async function resolveApAccount(companyId: number): Promise<number | null> {
  return (
    (await resolveCoaAccountIdByCode(companyId, '2110')) ||
    (await resolveCoaAccountId({
      profileId: companyId,
      accountTypes: ['liability'],
      subtypes: ['payable', 'current'],
    }))
  );
}
