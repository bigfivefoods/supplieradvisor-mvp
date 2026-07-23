/**
 * Post manufacturing cost entries (and labor captures) into GL journals.
 *
 * Default double-entry (accrual):
 *   Dr  Expense / COGS account (by category or cost-object GL override)
 *   Cr  Accrued expenses (2130) — manufacturing costs are accrued until paid
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  postBalancedJournal,
  resolveCoaAccountId,
  resolveCoaAccountIdByCode,
} from '@/lib/accounting/post-journal';
import type { CostCategory } from '@/lib/manufacturing/cost-structure';

/** Map manufacturing cost category → preferred COA codes (first hit wins) */
const CATEGORY_COA_CODES: Record<string, string[]> = {
  labour: ['5200', '6100'],
  materials: ['5100', '1140'],
  energy: ['6300'],
  maintenance: ['6990', '6700'],
  depreciation: ['6800'],
  overhead: ['6990', '6200'],
  operating: ['6990', '6200'],
  other: ['6990'],
};

const CREDIT_ACCRUAL_CODES = ['2130', '2110']; // Accrued expenses, then AP

export async function resolveManufacturingExpenseAccount(opts: {
  companyId: number;
  category?: string | null;
  /** Explicit override from cost object */
  glAccountId?: number | null;
}): Promise<number | null> {
  if (opts.glAccountId && Number(opts.glAccountId) > 0) {
    return Number(opts.glAccountId);
  }
  const cat = String(opts.category || 'operating').toLowerCase();
  const codes = CATEGORY_COA_CODES[cat] || CATEGORY_COA_CODES.operating;
  for (const code of codes) {
    const id = await resolveCoaAccountIdByCode(opts.companyId, code);
    if (id) return id;
  }
  return resolveCoaAccountId({
    profileId: opts.companyId,
    accountTypes: ['expense', 'cogs'],
    subtypes: ['other', 'labour', 'cogs'],
  });
}

export async function resolveManufacturingCreditAccount(
  companyId: number
): Promise<number | null> {
  for (const code of CREDIT_ACCRUAL_CODES) {
    const id = await resolveCoaAccountIdByCode(companyId, code);
    if (id) return id;
  }
  return resolveCoaAccountId({
    profileId: companyId,
    accountTypes: ['liability'],
    subtypes: ['current', 'payable'],
  });
}

/**
 * Resolve GL expense account from cost object hierarchy (station → cell → BU → category).
 */
export async function resolveGlFromCostObjects(opts: {
  companyId: number;
  category?: string | null;
  businessUnitId?: number | null;
  workCenterId?: number | null;
  workStationId?: number | null;
  assetId?: number | null;
}): Promise<number | null> {
  const supabase = getSupabaseServer();

  if (opts.assetId) {
    const { data: a } = await supabase
      .from('manufacturing_assets')
      .select('gl_expense_account_id')
      .eq('id', opts.assetId)
      .eq('profile_id', opts.companyId)
      .maybeSingle();
    if (a?.gl_expense_account_id) return Number(a.gl_expense_account_id);
  }
  if (opts.workStationId) {
    const { data: s } = await supabase
      .from('manufacturing_work_stations')
      .select('gl_expense_account_id, work_center_id, business_unit_id')
      .eq('id', opts.workStationId)
      .eq('profile_id', opts.companyId)
      .maybeSingle();
    if (s?.gl_expense_account_id) return Number(s.gl_expense_account_id);
    if (!opts.workCenterId && s?.work_center_id) {
      opts = { ...opts, workCenterId: Number(s.work_center_id) };
    }
    if (!opts.businessUnitId && s?.business_unit_id) {
      opts = { ...opts, businessUnitId: Number(s.business_unit_id) };
    }
  }
  if (opts.workCenterId) {
    const { data: w } = await supabase
      .from('manufacturing_work_centers')
      .select('gl_expense_account_id, business_unit_id')
      .eq('id', opts.workCenterId)
      .eq('profile_id', opts.companyId)
      .maybeSingle();
    if (w?.gl_expense_account_id) return Number(w.gl_expense_account_id);
    if (!opts.businessUnitId && w?.business_unit_id) {
      opts = { ...opts, businessUnitId: Number(w.business_unit_id) };
    }
  }
  if (opts.businessUnitId) {
    const { data: b } = await supabase
      .from('manufacturing_business_units')
      .select('gl_expense_account_id')
      .eq('id', opts.businessUnitId)
      .eq('profile_id', opts.companyId)
      .maybeSingle();
    if (b?.gl_expense_account_id) return Number(b.gl_expense_account_id);
  }

  return resolveManufacturingExpenseAccount({
    companyId: opts.companyId,
    category: opts.category,
  });
}

export type PostCostToGlResult = {
  ok: boolean;
  journalId?: number;
  entryNumber?: string;
  glAccountId?: number;
  creditAccountId?: number;
  error?: string;
  skipped?: boolean;
};

/**
 * Post a manufacturing_cost_entries row to the general ledger.
 * Idempotent: if journal_entry_id already set, returns existing.
 */
export async function postManufacturingCostEntryToGl(opts: {
  companyId: number;
  costEntryId: number;
  createdBy?: string | null;
  force?: boolean;
}): Promise<PostCostToGlResult> {
  const supabase = getSupabaseServer();
  const { data: entry, error } = await supabase
    .from('manufacturing_cost_entries')
    .select('*')
    .eq('id', opts.costEntryId)
    .eq('profile_id', opts.companyId)
    .maybeSingle();

  if (error || !entry) {
    return { ok: false, error: error?.message || 'Cost entry not found' };
  }

  if (entry.journal_entry_id && !opts.force) {
    return {
      ok: true,
      skipped: true,
      journalId: Number(entry.journal_entry_id),
      glAccountId: entry.gl_account_id ? Number(entry.gl_account_id) : undefined,
    };
  }

  const amount = Math.abs(Number(entry.amount || 0));
  if (amount < 0.005) {
    return { ok: true, skipped: true, error: 'Zero amount' };
  }

  const expenseId = await resolveGlFromCostObjects({
    companyId: opts.companyId,
    category: entry.category,
    businessUnitId: entry.business_unit_id
      ? Number(entry.business_unit_id)
      : null,
    workCenterId: entry.work_center_id ? Number(entry.work_center_id) : null,
    workStationId: entry.work_station_id
      ? Number(entry.work_station_id)
      : null,
    assetId: entry.asset_id ? Number(entry.asset_id) : null,
  });

  const creditId = await resolveManufacturingCreditAccount(opts.companyId);

  if (!expenseId || !creditId) {
    return {
      ok: false,
      error:
        'COA missing expense or accrual accounts — open Accounting → Chart of Accounts and seed defaults',
    };
  }
  if (expenseId === creditId) {
    return { ok: false, error: 'Expense and credit GL accounts must differ' };
  }

  const memo =
    entry.description ||
    `Mfg cost ${entry.category || 'expense'} ${entry.reference || ''}`.trim();

  const costDims = {
    businessUnitId: entry.business_unit_id
      ? Number(entry.business_unit_id)
      : null,
    workCenterId: entry.work_center_id ? Number(entry.work_center_id) : null,
    workStationId: entry.work_station_id
      ? Number(entry.work_station_id)
      : null,
    assetId: entry.asset_id ? Number(entry.asset_id) : null,
    purchaseOrderId: entry.purchase_order_id
      ? Number(entry.purchase_order_id)
      : null,
  };

  const posted = await postBalancedJournal({
    profileId: opts.companyId,
    entryDate: String(entry.entry_date || new Date().toISOString()).slice(0, 10),
    memo,
    source: 'manufacturing_cost',
    sourceId: String(entry.id),
    currency: entry.currency || 'ZAR',
    createdBy: opts.createdBy || null,
    metadata: {
      manufacturing_cost_entry_id: entry.id,
      category: entry.category,
      business_unit_id: entry.business_unit_id,
      work_center_id: entry.work_center_id,
      work_station_id: entry.work_station_id,
      asset_id: entry.asset_id,
      production_order_id: entry.production_order_id,
      purchase_order_id: entry.purchase_order_id ?? null,
    },
    lines: [
      {
        accountId: expenseId,
        debit: amount,
        credit: 0,
        memo,
        ...costDims,
      },
      {
        accountId: creditId,
        debit: 0,
        credit: amount,
        memo: 'Manufacturing cost accrual',
        purchaseOrderId: costDims.purchaseOrderId,
      },
    ],
  });

  if (!posted.ok) {
    return { ok: false, error: posted.error };
  }

  await supabase
    .from('manufacturing_cost_entries')
    .update({
      gl_account_id: expenseId,
      journal_entry_id: posted.journalId,
      updated_at: new Date().toISOString(),
      metadata: {
        ...(typeof entry.metadata === 'object' && entry.metadata
          ? (entry.metadata as object)
          : {}),
        journal_entry_number: posted.entryNumber,
        gl_credit_account_id: creditId,
      },
    })
    .eq('id', entry.id)
    .eq('profile_id', opts.companyId);

  return {
    ok: true,
    journalId: posted.journalId,
    entryNumber: posted.entryNumber,
    glAccountId: expenseId,
    creditAccountId: creditId,
  };
}

/**
 * Ensure manufacturing asset is mirrored on accounting fixed_assets with GL links.
 */
export async function syncManufacturingAssetToFixedAssets(opts: {
  companyId: number;
  assetId: number;
}): Promise<{ ok: boolean; fixedAssetId?: number; error?: string }> {
  const supabase = getSupabaseServer();
  const { data: asset, error } = await supabase
    .from('manufacturing_assets')
    .select('*')
    .eq('id', opts.assetId)
    .eq('profile_id', opts.companyId)
    .maybeSingle();
  if (error || !asset) {
    return { ok: false, error: error?.message || 'Asset not found' };
  }

  const glAsset =
    (asset.gl_asset_account_id
      ? Number(asset.gl_asset_account_id)
      : null) ||
    (await resolveCoaAccountIdByCode(opts.companyId, '1210'));
  const glDepr =
    (asset.gl_depr_account_id
      ? Number(asset.gl_depr_account_id)
      : null) ||
    (await resolveCoaAccountIdByCode(opts.companyId, '1220'));
  const glExp =
    (asset.gl_expense_account_id
      ? Number(asset.gl_expense_account_id)
      : null) ||
    (await resolveCoaAccountIdByCode(opts.companyId, '6800'));

  const existingFixedId = asset.fixed_asset_id
    ? Number(asset.fixed_asset_id)
    : null;

  const payload = {
    profile_id: opts.companyId,
    code: asset.code,
    name: asset.name,
    category: asset.asset_type || 'equipment',
    purchase_date: asset.purchase_date || null,
    purchase_cost: Number(asset.purchase_cost || 0),
    residual_value: Number(asset.residual_value || 0),
    useful_life_months: Number(asset.useful_life_months || 60),
    depreciation_method: asset.depreciation_method || 'straight_line',
    status: asset.status === 'disposed' ? 'disposed' : 'active',
    serial_number: asset.serial_number || null,
    gl_asset_account_id: glAsset,
    gl_depr_account_id: glDepr,
    gl_expense_account_id: glExp,
    notes: `Synced from manufacturing asset #${asset.id}`,
    metadata: {
      manufacturing_asset_id: asset.id,
      source: 'manufacturing_assets',
    },
    updated_at: new Date().toISOString(),
  };

  try {
    if (existingFixedId) {
      await supabase
        .from('fixed_assets')
        .update(payload)
        .eq('id', existingFixedId)
        .eq('profile_id', opts.companyId);
      return { ok: true, fixedAssetId: existingFixedId };
    }

    const { data: created, error: insErr } = await supabase
      .from('fixed_assets')
      .insert(payload)
      .select('id')
      .single();
    if (insErr || !created) {
      return { ok: false, error: insErr?.message || 'fixed_assets insert failed' };
    }
    await supabase
      .from('manufacturing_assets')
      .update({
        fixed_asset_id: created.id,
        gl_asset_account_id: glAsset,
        gl_depr_account_id: glDepr,
        gl_expense_account_id: glExp,
        updated_at: new Date().toISOString(),
      })
      .eq('id', asset.id)
      .eq('profile_id', opts.companyId);

    // Capitalise onto balance sheet when purchase cost present
    if (Number(asset.purchase_cost || 0) > 0.005) {
      try {
        const { capitalizeFixedAsset } = await import(
          '@/lib/accounting/balance-sheet-allocate'
        );
        await capitalizeFixedAsset({
          companyId: opts.companyId,
          fixedAssetId: Number(created.id),
          creditSide: 'ap',
        });
      } catch {
        /* soft — register still linked */
      }
    }

    return { ok: true, fixedAssetId: Number(created.id) };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'fixed_assets sync failed',
    };
  }
}
