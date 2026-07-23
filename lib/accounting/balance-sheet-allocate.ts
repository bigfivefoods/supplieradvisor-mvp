/**
 * Allocate assets & liabilities onto the balance sheet (GL) with cost dimensions.
 *
 * - Capitalise fixed assets: Dr PPE · Cr AP / equity / bank
 * - Post depreciation: Dr expense · Cr accumulated depreciation
 * - Capitalise liability register: Dr bank/expense · Cr liability
 * - Balance sheet report helpers: sections, register schedules, dim breakdown
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  postBalancedJournal,
  resolveCoaAccountId,
  resolveCoaAccountIdByCode,
} from '@/lib/accounting/post-journal';
import {
  computeBookValue as bookValueOf,
  monthlyDepreciation as monthlyOf,
} from '@/lib/accounting/types';

export type CostDims = {
  businessUnitId?: number | null;
  workCenterId?: number | null;
  workStationId?: number | null;
  assetId?: number | null;
  fixedAssetId?: number | null;
  liabilityId?: number | null;
  purchaseOrderId?: number | null;
};

export type PostResult = {
  ok: boolean;
  journalId?: number;
  entryNumber?: string;
  skipped?: boolean;
  error?: string;
};

async function resolveBsAccounts(companyId: number) {
  const ppe =
    (await resolveCoaAccountIdByCode(companyId, '1210')) ||
    (await resolveCoaAccountId({
      profileId: companyId,
      accountTypes: ['asset'],
      subtypes: ['fixed'],
    }));
  const accumDepr =
    (await resolveCoaAccountIdByCode(companyId, '1220')) ||
    (await resolveCoaAccountId({
      profileId: companyId,
      accountTypes: ['asset'],
      subtypes: ['contra_asset'],
    }));
  const deprExpense =
    (await resolveCoaAccountIdByCode(companyId, '6800')) ||
    (await resolveCoaAccountId({
      profileId: companyId,
      accountTypes: ['expense'],
      subtypes: ['depreciation'],
    }));
  const ap =
    (await resolveCoaAccountIdByCode(companyId, '2110')) ||
    (await resolveCoaAccountId({
      profileId: companyId,
      accountTypes: ['liability'],
      subtypes: ['payable', 'current'],
    }));
  const inventory =
    (await resolveCoaAccountIdByCode(companyId, '1140')) ||
    (await resolveCoaAccountId({
      profileId: companyId,
      accountTypes: ['asset'],
      subtypes: ['inventory'],
    }));
  const bank =
    (await resolveCoaAccountIdByCode(companyId, '1110')) ||
    (await resolveCoaAccountId({
      profileId: companyId,
      accountTypes: ['asset'],
      subtypes: ['bank', 'cash'],
    }));
  const equity =
    (await resolveCoaAccountIdByCode(companyId, '3100')) ||
    (await resolveCoaAccountId({
      profileId: companyId,
      accountTypes: ['equity'],
    }));
  const ar =
    (await resolveCoaAccountIdByCode(companyId, '1130')) ||
    (await resolveCoaAccountId({
      profileId: companyId,
      accountTypes: ['asset'],
      subtypes: ['receivable'],
    }));
  return { ppe, accumDepr, deprExpense, ap, inventory, bank, equity, ar };
}

/**
 * Map procurement / cost category → BS debit account preference.
 * Capital & materials hit assets; operating hits P&L (caller may still use expense).
 */
export async function resolveDebitAccountForCategory(
  companyId: number,
  category: string | null | undefined
): Promise<{ accountId: number | null; onBalanceSheet: boolean }> {
  const cat = String(category || 'materials').toLowerCase();
  const accts = await resolveBsAccounts(companyId);
  if (
    ['capital', 'ppe', 'equipment', 'fixed_asset', 'asset', 'machinery'].includes(
      cat
    )
  ) {
    return { accountId: accts.ppe, onBalanceSheet: true };
  }
  if (['materials', 'inventory', 'stock', 'raw_material'].includes(cat)) {
    return { accountId: accts.inventory, onBalanceSheet: true };
  }
  return { accountId: null, onBalanceSheet: false };
}

/**
 * Capitalise a fixed_assets row onto the balance sheet.
 * Dr PPE (or gl_asset_account) · Cr AP (or bank/equity opening)
 */
export async function capitalizeFixedAsset(opts: {
  companyId: number;
  fixedAssetId: number;
  createdBy?: string | null;
  /** opening_balance | purchase | transfer — default purchase (Cr AP) */
  creditSide?: 'ap' | 'bank' | 'equity';
  force?: boolean;
}): Promise<PostResult> {
  const supabase = getSupabaseServer();
  const { data: asset, error } = await supabase
    .from('fixed_assets')
    .select('*')
    .eq('id', opts.fixedAssetId)
    .eq('profile_id', opts.companyId)
    .maybeSingle();
  if (error || !asset) {
    return { ok: false, error: error?.message || 'Fixed asset not found' };
  }
  if (asset.capitalization_journal_id && !opts.force) {
    return {
      ok: true,
      skipped: true,
      journalId: Number(asset.capitalization_journal_id),
    };
  }

  const amount = Math.abs(Number(asset.purchase_cost || 0));
  if (amount < 0.005) {
    return { ok: true, skipped: true, error: 'Zero purchase cost' };
  }

  const accts = await resolveBsAccounts(opts.companyId);
  const debitId =
    (asset.gl_asset_account_id ? Number(asset.gl_asset_account_id) : null) ||
    accts.ppe;
  const side = opts.creditSide || 'ap';
  const creditId =
    side === 'bank'
      ? accts.bank
      : side === 'equity'
        ? accts.equity
        : accts.ap;

  if (!debitId || !creditId) {
    return {
      ok: false,
      error:
        'COA missing PPE or credit account — seed Chart of Accounts (1210 / 2110)',
    };
  }
  if (debitId === creditId) {
    return { ok: false, error: 'Debit and credit GL accounts must differ' };
  }

  const dims: CostDims = {
    businessUnitId: asset.business_unit_id
      ? Number(asset.business_unit_id)
      : null,
    workCenterId: asset.work_center_id ? Number(asset.work_center_id) : null,
    workStationId: asset.work_station_id
      ? Number(asset.work_station_id)
      : null,
    fixedAssetId: Number(asset.id),
  };

  const memo = `Capitalise FA ${asset.asset_code || asset.code || asset.id}: ${asset.name}`.slice(
    0,
    500
  );
  const entryDate = String(
    asset.purchase_date || new Date().toISOString()
  ).slice(0, 10);

  const posted = await postBalancedJournal({
    profileId: opts.companyId,
    entryDate,
    memo,
    source: 'fixed_asset_capitalization',
    sourceId: String(asset.id),
    createdBy: opts.createdBy || null,
    metadata: {
      fixed_asset_id: asset.id,
      business_unit_id: dims.businessUnitId,
      work_center_id: dims.workCenterId,
      work_station_id: dims.workStationId,
      credit_side: side,
    },
    lines: [
      {
        accountId: debitId,
        debit: amount,
        credit: 0,
        memo,
        businessUnitId: dims.businessUnitId,
        workCenterId: dims.workCenterId,
        workStationId: dims.workStationId,
        fixedAssetId: dims.fixedAssetId,
      },
      {
        accountId: creditId,
        debit: 0,
        credit: amount,
        memo:
          side === 'equity'
            ? 'Opening equity / owner contribution'
            : side === 'bank'
              ? 'Cash purchase of asset'
              : 'AP for asset purchase',
        businessUnitId: dims.businessUnitId,
        workCenterId: dims.workCenterId,
        workStationId: dims.workStationId,
        fixedAssetId: dims.fixedAssetId,
      },
    ],
  });

  if (!posted.ok) return { ok: false, error: posted.error };

  const stamp: Record<string, unknown> = {
    capitalization_journal_id: posted.journalId,
    capitalized_at: new Date().toISOString(),
    gl_asset_account_id: debitId,
    updated_at: new Date().toISOString(),
    book_value:
      asset.book_value != null
        ? Number(asset.book_value)
        : bookValueOf(asset),
  };
  const { error: upErr } = await supabase
    .from('fixed_assets')
    .update(stamp)
    .eq('id', asset.id)
    .eq('profile_id', opts.companyId);

  if (upErr && /column|schema cache|does not exist/i.test(upErr.message)) {
    await supabase
      .from('fixed_assets')
      .update({
        updated_at: new Date().toISOString(),
        metadata: {
          ...(typeof asset.metadata === 'object' && asset.metadata
            ? (asset.metadata as object)
            : {}),
          capitalization_journal_id: posted.journalId,
          capitalized_at: new Date().toISOString(),
        },
      })
      .eq('id', asset.id)
      .eq('profile_id', opts.companyId);
  }

  return {
    ok: true,
    journalId: posted.journalId,
    entryNumber: posted.entryNumber,
  };
}

/**
 * Post one (or more) periods of depreciation to GL and update the register.
 */
export async function postFixedAssetDepreciation(opts: {
  companyId: number;
  fixedAssetId: number;
  periods?: number;
  createdBy?: string | null;
}): Promise<PostResult & { amount?: number; asset?: Record<string, unknown> }> {
  const supabase = getSupabaseServer();
  const { data: asset, error } = await supabase
    .from('fixed_assets')
    .select('*')
    .eq('id', opts.fixedAssetId)
    .eq('profile_id', opts.companyId)
    .maybeSingle();
  if (error || !asset) {
    return { ok: false, error: error?.message || 'Fixed asset not found' };
  }
  if (String(asset.status) === 'disposed') {
    return { ok: false, error: 'Asset is disposed' };
  }

  const monthly = monthlyOf(asset);
  const periods = Math.max(1, Number(opts.periods || 1));
  const amount = Math.round(monthly * periods * 100) / 100;
  if (amount < 0.005) {
    return { ok: true, skipped: true, amount: 0, error: 'Zero depreciation' };
  }

  const cost = Number(asset.purchase_cost || 0);
  const residual = Number(asset.residual_value || 0);
  const maxDep = Math.max(0, cost - residual);
  const newAccum = Math.min(
    Math.round((Number(asset.accumulated_depreciation || 0) + amount) * 100) /
      100,
    maxDep
  );
  const actual = Math.round(
    (newAccum - Number(asset.accumulated_depreciation || 0)) * 100
  ) / 100;
  if (actual < 0.005) {
    return { ok: true, skipped: true, amount: 0, error: 'Fully depreciated' };
  }
  const book = Math.round((cost - newAccum) * 100) / 100;
  const status = book <= 0.005 ? 'fully_depreciated' : asset.status;

  const accts = await resolveBsAccounts(opts.companyId);
  const expenseId =
    (asset.gl_expense_account_id
      ? Number(asset.gl_expense_account_id)
      : null) || accts.deprExpense;
  const accumId =
    (asset.gl_depr_account_id ? Number(asset.gl_depr_account_id) : null) ||
    accts.accumDepr;

  let journalId: number | undefined;
  let entryNumber: string | undefined;

  if (expenseId && accumId && expenseId !== accumId) {
    const memo =
      `Depreciation FA ${asset.asset_code || asset.id}: ${asset.name}`.slice(
        0,
        500
      );
    const posted = await postBalancedJournal({
      profileId: opts.companyId,
      entryDate: new Date().toISOString().slice(0, 10),
      memo,
      source: 'fixed_asset_depreciation',
      sourceId: String(asset.id),
      createdBy: opts.createdBy || null,
      metadata: {
        fixed_asset_id: asset.id,
        periods,
        business_unit_id: asset.business_unit_id,
        work_center_id: asset.work_center_id,
      },
      lines: [
        {
          accountId: expenseId,
          debit: actual,
          credit: 0,
          memo,
          businessUnitId: asset.business_unit_id
            ? Number(asset.business_unit_id)
            : null,
          workCenterId: asset.work_center_id
            ? Number(asset.work_center_id)
            : null,
          workStationId: asset.work_station_id
            ? Number(asset.work_station_id)
            : null,
          fixedAssetId: Number(asset.id),
        },
        {
          accountId: accumId,
          debit: 0,
          credit: actual,
          memo: 'Accumulated depreciation',
          businessUnitId: asset.business_unit_id
            ? Number(asset.business_unit_id)
            : null,
          workCenterId: asset.work_center_id
            ? Number(asset.work_center_id)
            : null,
          fixedAssetId: Number(asset.id),
        },
      ],
    });
    if (posted.ok) {
      journalId = posted.journalId;
      entryNumber = posted.entryNumber;
    }
  }

  const patch: Record<string, unknown> = {
    accumulated_depreciation: newAccum,
    book_value: book,
    status,
    updated_at: new Date().toISOString(),
  };
  if (journalId) {
    patch.last_depreciation_journal_id = journalId;
    patch.gl_depr_account_id = accumId;
    patch.gl_expense_account_id = expenseId;
  }

  const { data: updated, error: upErr } = await supabase
    .from('fixed_assets')
    .update(patch)
    .eq('id', asset.id)
    .eq('profile_id', opts.companyId)
    .select('*')
    .single();

  if (upErr) {
    // soft: strip journal columns
    const { data: soft } = await supabase
      .from('fixed_assets')
      .update({
        accumulated_depreciation: newAccum,
        book_value: book,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', asset.id)
      .eq('profile_id', opts.companyId)
      .select('*')
      .single();
    return {
      ok: true,
      amount: actual,
      journalId,
      entryNumber,
      asset: soft || undefined,
      error: journalId ? undefined : 'Register updated; GL post may have failed',
    };
  }

  return {
    ok: true,
    amount: actual,
    journalId,
    entryNumber,
    asset: updated || undefined,
  };
}

/**
 * Post a liability register row to the BS (Cr liability · Dr bank or equity).
 */
export async function capitalizeLiability(opts: {
  companyId: number;
  liabilityId: number;
  createdBy?: string | null;
  debitSide?: 'bank' | 'expense' | 'equity';
  force?: boolean;
}): Promise<PostResult> {
  const supabase = getSupabaseServer();
  const { data: row, error } = await supabase
    .from('accounting_liabilities')
    .select('*')
    .eq('id', opts.liabilityId)
    .eq('profile_id', opts.companyId)
    .maybeSingle();
  if (error || !row) {
    return {
      ok: false,
      error: error?.message || 'Liability not found (run 20260723_balance_sheet_allocation.sql)',
    };
  }
  if (row.capitalization_journal_id && !opts.force) {
    return {
      ok: true,
      skipped: true,
      journalId: Number(row.capitalization_journal_id),
    };
  }

  const amount = Math.abs(Number(row.outstanding ?? row.principal ?? 0));
  if (amount < 0.005) {
    return { ok: true, skipped: true, error: 'Zero outstanding' };
  }

  const accts = await resolveBsAccounts(opts.companyId);
  let creditId =
    (row.gl_liability_account_id
      ? Number(row.gl_liability_account_id)
      : null) || null;
  if (!creditId) {
    if (row.liability_type === 'loan') {
      creditId =
        (await resolveCoaAccountIdByCode(opts.companyId, '2210')) || accts.ap;
    } else if (row.liability_type === 'deposit') {
      creditId =
        (await resolveCoaAccountIdByCode(opts.companyId, '2140')) || accts.ap;
    } else if (row.liability_type === 'accrued') {
      creditId =
        (await resolveCoaAccountIdByCode(opts.companyId, '2130')) || accts.ap;
    } else {
      creditId = accts.ap;
    }
  }

  const debitSide = opts.debitSide || 'bank';
  const debitId =
    debitSide === 'equity'
      ? accts.equity
      : debitSide === 'expense'
        ? (await resolveCoaAccountIdByCode(opts.companyId, '6990')) ||
          accts.bank
        : accts.bank;

  if (!debitId || !creditId) {
    return {
      ok: false,
      error: 'COA missing bank or liability account — seed defaults',
    };
  }

  const memo = `Recognise liability ${row.code || row.id}: ${row.name}`.slice(
    0,
    500
  );
  const posted = await postBalancedJournal({
    profileId: opts.companyId,
    entryDate: String(row.start_date || new Date().toISOString()).slice(0, 10),
    memo,
    source: 'liability_recognition',
    sourceId: String(row.id),
    currency: row.currency || 'ZAR',
    createdBy: opts.createdBy || null,
    metadata: {
      liability_id: row.id,
      liability_type: row.liability_type,
      business_unit_id: row.business_unit_id,
    },
    lines: [
      {
        accountId: debitId,
        debit: amount,
        credit: 0,
        memo,
        businessUnitId: row.business_unit_id
          ? Number(row.business_unit_id)
          : null,
        workCenterId: row.work_center_id ? Number(row.work_center_id) : null,
        liabilityId: Number(row.id),
      },
      {
        accountId: creditId,
        debit: 0,
        credit: amount,
        memo: `Liability · ${row.liability_type}`,
        businessUnitId: row.business_unit_id
          ? Number(row.business_unit_id)
          : null,
        workCenterId: row.work_center_id ? Number(row.work_center_id) : null,
        liabilityId: Number(row.id),
      },
    ],
  });

  if (!posted.ok) return { ok: false, error: posted.error };

  await supabase
    .from('accounting_liabilities')
    .update({
      capitalization_journal_id: posted.journalId,
      capitalized_at: new Date().toISOString(),
      gl_liability_account_id: creditId,
      outstanding: amount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('profile_id', opts.companyId);

  return {
    ok: true,
    journalId: posted.journalId,
    entryNumber: posted.entryNumber,
  };
}

/**
 * Batch: capitalise all uncapitalised fixed assets for a company.
 */
export async function ensureAllAssetsOnBalanceSheet(opts: {
  companyId: number;
  createdBy?: string | null;
  creditSide?: 'ap' | 'bank' | 'equity';
}): Promise<{
  ok: boolean;
  capitalised: number;
  skipped: number;
  failed: number;
  errors: string[];
}> {
  const supabase = getSupabaseServer();
  const { data: assets, error } = await supabase
    .from('fixed_assets')
    .select('id, capitalization_journal_id, purchase_cost, status')
    .eq('profile_id', opts.companyId)
    .neq('status', 'disposed');

  if (error) {
    return {
      ok: false,
      capitalised: 0,
      skipped: 0,
      failed: 0,
      errors: [error.message],
    };
  }

  let capitalised = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const a of assets || []) {
    if (a.capitalization_journal_id) {
      skipped++;
      continue;
    }
    if (Number(a.purchase_cost || 0) < 0.005) {
      skipped++;
      continue;
    }
    const r = await capitalizeFixedAsset({
      companyId: opts.companyId,
      fixedAssetId: Number(a.id),
      createdBy: opts.createdBy,
      creditSide: opts.creditSide,
    });
    if (r.ok && !r.skipped) capitalised++;
    else if (r.skipped) skipped++;
    else {
      failed++;
      if (r.error) errors.push(`FA #${a.id}: ${r.error}`);
    }
  }

  return { ok: failed === 0, capitalised, skipped, failed, errors };
}

export type BsSectionRow = {
  id: number;
  code: string;
  name: string;
  account_type: string;
  subtype?: string | null;
  section: string;
  amount: number;
  allocated?: boolean;
};

export function classifyBsSection(
  accountType: string,
  subtype?: string | null,
  code?: string | null
): string {
  const t = String(accountType || '').toLowerCase();
  const s = String(subtype || '').toLowerCase();
  const c = String(code || '');
  if (t === 'asset') {
    if (
      s === 'fixed' ||
      s === 'contra_asset' ||
      c.startsWith('12') ||
      s.includes('intang')
    ) {
      return 'non_current_assets';
    }
    return 'current_assets';
  }
  if (t === 'liability') {
    if (s === 'long_term' || c.startsWith('22')) {
      return 'non_current_liabilities';
    }
    return 'current_liabilities';
  }
  if (t === 'equity') return 'equity';
  return 'other';
}

export const BS_SECTION_LABELS: Record<string, string> = {
  current_assets: 'Current assets',
  non_current_assets: 'Non-current assets',
  current_liabilities: 'Current liabilities',
  non_current_liabilities: 'Non-current liabilities',
  equity: 'Equity',
  other: 'Other',
};

/**
 * Build register schedules + completeness for balance sheet report.
 */
export async function buildBalanceSheetExtras(opts: {
  companyId: number;
  glAssets: number;
  glLiabilities: number;
  glEquity: number;
}): Promise<{
  fixedAssetSchedule: Array<Record<string, unknown>>;
  fixedAssetRegisterTotal: number;
  fixedAssetCapitalisedCount: number;
  fixedAssetUncapitalisedCount: number;
  liabilitySchedule: Array<Record<string, unknown>>;
  liabilityRegisterTotal: number;
  bankRegisterTotal: number;
  completeness: Array<{
    key: string;
    label: string;
    ok: boolean;
    detail: string;
  }>;
  recon: {
    ppeRegisterVsHint: number;
    liabilitiesRegister: number;
  };
}> {
  const supabase = getSupabaseServer();

  const { data: fas } = await supabase
    .from('fixed_assets')
    .select(
      'id, asset_code, code, name, category, purchase_cost, accumulated_depreciation, book_value, status, capitalization_journal_id, business_unit_id, work_center_id'
    )
    .eq('profile_id', opts.companyId)
    .limit(500);

  const fixedAssetSchedule = (fas || []).map((a) => {
    const book =
      a.book_value != null
        ? Number(a.book_value)
        : bookValueOf(a as Parameters<typeof bookValueOf>[0]);
    return {
      id: a.id,
      code: a.asset_code || a.code || null,
      name: a.name,
      category: a.category,
      purchase_cost: Number(a.purchase_cost || 0),
      accumulated_depreciation: Number(a.accumulated_depreciation || 0),
      book_value: book,
      status: a.status,
      on_balance_sheet: Boolean(a.capitalization_journal_id),
      business_unit_id: a.business_unit_id,
      work_center_id: a.work_center_id,
    };
  });

  const fixedAssetRegisterTotal = Math.round(
    fixedAssetSchedule
      .filter((a) => a.status !== 'disposed')
      .reduce((s, a) => s + Number(a.book_value || 0), 0) * 100
  ) / 100;
  const fixedAssetCapitalisedCount = fixedAssetSchedule.filter(
    (a) => a.on_balance_sheet
  ).length;
  const fixedAssetUncapitalisedCount = fixedAssetSchedule.filter(
    (a) => !a.on_balance_sheet && a.status !== 'disposed' && Number(a.purchase_cost) > 0
  ).length;

  let liabilitySchedule: Array<Record<string, unknown>> = [];
  let liabilityRegisterTotal = 0;
  try {
    const { data: liabs } = await supabase
      .from('accounting_liabilities')
      .select(
        'id, code, name, liability_type, is_current, outstanding, principal, status, capitalization_journal_id, business_unit_id'
      )
      .eq('profile_id', opts.companyId)
      .eq('status', 'active')
      .limit(200);
    liabilitySchedule = (liabs || []).map((l) => ({
      id: l.id,
      code: l.code,
      name: l.name,
      liability_type: l.liability_type,
      is_current: l.is_current,
      outstanding: Number(l.outstanding ?? l.principal ?? 0),
      on_balance_sheet: Boolean(l.capitalization_journal_id),
      business_unit_id: l.business_unit_id,
    }));
    liabilityRegisterTotal = Math.round(
      liabilitySchedule.reduce((s, l) => s + Number(l.outstanding || 0), 0) *
        100
    ) / 100;
  } catch {
    /* table may not exist */
  }

  let bankRegisterTotal = 0;
  try {
    const { data: banks } = await supabase
      .from('bank_accounts')
      .select('id, current_balance, balance, is_active')
      .eq('profile_id', opts.companyId)
      .limit(50);
    bankRegisterTotal = Math.round(
      (banks || [])
        .filter((b) => b.is_active !== false)
        .reduce(
          (s, b) =>
            s + Number(b.current_balance ?? b.balance ?? 0),
          0
        ) * 100
    ) / 100;
  } catch {
    /* soft */
  }

  const completeness = [
    {
      key: 'equation',
      label: 'Accounting equation',
      ok: Math.abs(opts.glAssets - (opts.glLiabilities + opts.glEquity)) < 0.05,
      detail: `A ${opts.glAssets.toFixed(2)} = L ${opts.glLiabilities.toFixed(2)} + E ${opts.glEquity.toFixed(2)}`,
    },
    {
      key: 'fixed_assets_gl',
      label: 'Fixed assets on GL',
      ok: fixedAssetUncapitalisedCount === 0,
      detail:
        fixedAssetUncapitalisedCount === 0
          ? `${fixedAssetCapitalisedCount} asset(s) capitalised · register R${fixedAssetRegisterTotal.toFixed(2)}`
          : `${fixedAssetUncapitalisedCount} asset(s) not yet capitalised onto BS`,
    },
    {
      key: 'liabilities_register',
      label: 'Liability register',
      ok: liabilitySchedule.every((l) => l.on_balance_sheet) || liabilitySchedule.length === 0,
      detail:
        liabilitySchedule.length === 0
          ? 'No liability register rows (AP/accruals still flow via journals)'
          : `${liabilitySchedule.filter((l) => l.on_balance_sheet).length}/${liabilitySchedule.length} posted · R${liabilityRegisterTotal.toFixed(2)}`,
    },
    {
      key: 'gl_activity',
      label: 'GL has asset & liability balances',
      ok: opts.glAssets !== 0 || opts.glLiabilities !== 0,
      detail:
        opts.glAssets === 0 && opts.glLiabilities === 0
          ? 'No posted BS balances yet — capitalise assets / post AP journals'
          : `Assets R${opts.glAssets.toFixed(2)} · Liabilities R${opts.glLiabilities.toFixed(2)}`,
    },
  ];

  return {
    fixedAssetSchedule,
    fixedAssetRegisterTotal,
    fixedAssetCapitalisedCount,
    fixedAssetUncapitalisedCount,
    liabilitySchedule,
    liabilityRegisterTotal,
    bankRegisterTotal,
    completeness,
    recon: {
      ppeRegisterVsHint: fixedAssetRegisterTotal,
      liabilitiesRegister: liabilityRegisterTotal,
    },
  };
}

