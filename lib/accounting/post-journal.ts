/**
 * Shared double-entry journal poster for operational modules (manufacturing, etc.).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { ensureDefaultCoa, nextDocumentNumber, round2 } from '@/lib/accounting/server';
import { isPeriodLocked } from '@/lib/accounting/period-lock';

export type JournalLineInput = {
  accountId: number;
  debit?: number;
  credit?: number;
  memo?: string | null;
  counterparty?: string | null;
  /** Cost centre / manufacturing dimensions (posted to journal_lines when columns exist) */
  businessUnitId?: number | null;
  workCenterId?: number | null;
  workStationId?: number | null;
  assetId?: number | null;
  purchaseOrderId?: number | null;
  fixedAssetId?: number | null;
  liabilityId?: number | null;
};

export type PostJournalResult =
  | {
      ok: true;
      journalId: number;
      entryNumber: string;
    }
  | { ok: false; error: string };

/**
 * Resolve a leaf COA account by code (seed defaults if empty).
 */
export async function resolveCoaAccountIdByCode(
  profileId: number,
  code: string
): Promise<number | null> {
  await ensureDefaultCoa(profileId);
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('chart_of_accounts')
    .select('id, code, is_header, is_active')
    .eq('profile_id', profileId)
    .eq('code', code)
    .maybeSingle();
  if (data?.id && !data.is_header) return Number(data.id);

  // Soft: match prefix without exact (e.g. 5200 vs 5200-1)
  const { data: rows } = await supabase
    .from('chart_of_accounts')
    .select('id, code, is_header, is_active')
    .eq('profile_id', profileId)
    .eq('is_active', true)
    .like('code', `${code}%`)
    .limit(5);
  const leaf = (rows || []).find((r) => !r.is_header);
  return leaf ? Number(leaf.id) : null;
}

/** Prefer subtype match, then code */
export async function resolveCoaAccountId(opts: {
  profileId: number;
  codes?: string[];
  subtypes?: string[];
  accountTypes?: string[];
}): Promise<number | null> {
  await ensureDefaultCoa(opts.profileId);
  const supabase = getSupabaseServer();
  const { data: rows } = await supabase
    .from('chart_of_accounts')
    .select('id, code, subtype, account_type, is_header, is_active')
    .eq('profile_id', opts.profileId)
    .eq('is_active', true);

  const leaf = (rows || []).filter((r) => !r.is_header);
  for (const code of opts.codes || []) {
    const hit = leaf.find((r) => String(r.code) === code);
    if (hit) return Number(hit.id);
  }
  for (const sub of opts.subtypes || []) {
    const hit = leaf.find(
      (r) => String(r.subtype || '').toLowerCase() === sub.toLowerCase()
    );
    if (hit) return Number(hit.id);
  }
  for (const t of opts.accountTypes || []) {
    const hit = leaf.find(
      (r) => String(r.account_type || '').toLowerCase() === t.toLowerCase()
    );
    if (hit) return Number(hit.id);
  }
  return null;
}

export async function validatePostableLines(
  profileId: number,
  lines: Array<{ account_id: number; debit: number; credit: number }>
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (lines.length < 2) {
    return { ok: false, error: 'Need at least two journal lines with amounts' };
  }
  const mixed = lines.find((l) => l.debit > 0 && l.credit > 0);
  if (mixed) {
    return {
      ok: false,
      error: 'A journal line cannot carry both a debit and a credit',
    };
  }
  const totalDr = round2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCr = round2(lines.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(totalDr - totalCr) > 0.005) {
    return {
      ok: false,
      error: `Unbalanced journal (Dr ${totalDr} vs Cr ${totalCr})`,
    };
  }

  const supabase = getSupabaseServer();
  const accountIds = [...new Set(lines.map((l) => l.account_id))];
  const { data: accts } = await supabase
    .from('chart_of_accounts')
    .select('id, code, is_header, is_active')
    .eq('profile_id', profileId)
    .in('id', accountIds);
  const found = new Set((accts || []).map((a) => Number(a.id)));
  for (const id of accountIds) {
    if (!found.has(id)) {
      return { ok: false, error: `Account ${id} is not on this company's chart` };
    }
  }
  for (const a of accts || []) {
    if (a.is_header) {
      return {
        ok: false,
        error: `Cannot post to header account ${a.code || a.id}`,
      };
    }
    if (a.is_active === false) {
      return {
        ok: false,
        error: `Account ${a.code || a.id} is inactive`,
      };
    }
  }
  return { ok: true };
}

/**
 * Post a balanced journal entry. Soft-fails if COA/journals missing.
 */
export async function postBalancedJournal(opts: {
  profileId: number;
  entryDate: string;
  memo: string;
  source: string;
  sourceId?: string | null;
  currency?: string;
  createdBy?: string | null;
  lines: JournalLineInput[];
  metadata?: Record<string, unknown>;
  status?: 'draft' | 'posted';
}): Promise<PostJournalResult> {
  const supabase = getSupabaseServer();
  const lines = opts.lines
    .map((l) => ({
      account_id: Number(l.accountId),
      debit: round2(Number(l.debit || 0)),
      credit: round2(Number(l.credit || 0)),
      memo: l.memo || null,
      counterparty: l.counterparty || null,
      business_unit_id:
        l.businessUnitId != null && Number(l.businessUnitId) > 0
          ? Number(l.businessUnitId)
          : null,
      work_center_id:
        l.workCenterId != null && Number(l.workCenterId) > 0
          ? Number(l.workCenterId)
          : null,
      work_station_id:
        l.workStationId != null && Number(l.workStationId) > 0
          ? Number(l.workStationId)
          : null,
      asset_id:
        l.assetId != null && Number(l.assetId) > 0 ? Number(l.assetId) : null,
      purchase_order_id:
        l.purchaseOrderId != null && Number(l.purchaseOrderId) > 0
          ? Number(l.purchaseOrderId)
          : null,
      fixed_asset_id:
        l.fixedAssetId != null && Number(l.fixedAssetId) > 0
          ? Number(l.fixedAssetId)
          : null,
      liability_id:
        l.liabilityId != null && Number(l.liabilityId) > 0
          ? Number(l.liabilityId)
          : null,
    }))
    .filter((l) => Number.isFinite(l.account_id) && (l.debit > 0 || l.credit > 0));

  if (lines.length < 2) {
    return { ok: false, error: 'Need at least two journal lines with amounts' };
  }

  const checked = await validatePostableLines(opts.profileId, lines);
  if (!checked.ok) return { ok: false, error: checked.error };

  const status = opts.status || 'posted';
  if (status === 'posted') {
    const lock = await isPeriodLocked(opts.profileId, opts.entryDate);
    if (lock.locked) {
      return {
        ok: false,
        error: `Period ${lock.period_key} is locked — cannot post`,
      };
    }
  }

  let entryNumber: string;
  try {
    entryNumber = await nextDocumentNumber(opts.profileId, 'journal');
  } catch {
    entryNumber = `JE-MFG-${Date.now()}`;
  }

  const { data: entry, error: jeErr } = await supabase
    .from('journal_entries')
    .insert({
      profile_id: opts.profileId,
      entry_number: entryNumber,
      entry_date: opts.entryDate.slice(0, 10),
      memo: opts.memo.slice(0, 500),
      status,
      source: opts.source,
      source_id: opts.sourceId || null,
      currency: opts.currency || 'ZAR',
      created_by: opts.createdBy || null,
      posted_at: status === 'posted' ? new Date().toISOString() : null,
      metadata: opts.metadata || {},
    })
    .select('id, entry_number')
    .single();

  if (jeErr || !entry) {
    return {
      ok: false,
      error: jeErr?.message || 'Failed to create journal entry',
    };
  }

  type JournalLineRow = {
    journal_entry_id: number | string;
    profile_id: number;
    account_id: number;
    debit: number;
    credit: number;
    memo: string | null;
    counterparty: string | null;
    business_unit_id: number | null;
    work_center_id: number | null;
    work_station_id: number | null;
    asset_id: number | null;
    purchase_order_id: number | null;
    fixed_asset_id: number | null;
    liability_id: number | null;
  };

  const withDims: JournalLineRow[] = lines.map((l) => ({
    journal_entry_id: entry.id,
    profile_id: opts.profileId,
    account_id: l.account_id,
    debit: l.debit,
    credit: l.credit,
    memo: l.memo,
    counterparty: l.counterparty,
    business_unit_id: l.business_unit_id,
    work_center_id: l.work_center_id,
    work_station_id: l.work_station_id,
    asset_id: l.asset_id,
    purchase_order_id: l.purchase_order_id,
    fixed_asset_id: l.fixed_asset_id,
    liability_id: l.liability_id,
  }));

  let lineErr = (await supabase.from('journal_lines').insert(withDims)).error;
  // Soft retry without cost dims if migration not applied yet
  if (lineErr && /column|schema cache|does not exist/i.test(lineErr.message)) {
    // Progressive soft retries: drop newer dim columns first, then all dims
    const stripHeavy = withDims.map((l: JournalLineRow) => ({
      journal_entry_id: l.journal_entry_id,
      profile_id: l.profile_id,
      account_id: l.account_id,
      debit: l.debit,
      credit: l.credit,
      memo: l.memo,
      counterparty: l.counterparty,
      business_unit_id: l.business_unit_id,
      work_center_id: l.work_center_id,
      work_station_id: l.work_station_id,
      asset_id: l.asset_id,
      purchase_order_id: l.purchase_order_id,
    }));
    lineErr = (await supabase.from('journal_lines').insert(stripHeavy)).error;
    if (lineErr && /column|schema cache|does not exist/i.test(lineErr.message)) {
      const bare = withDims.map((row: JournalLineRow) => ({
        journal_entry_id: row.journal_entry_id,
        profile_id: row.profile_id,
        account_id: row.account_id,
        debit: row.debit,
        credit: row.credit,
        memo: row.memo,
        counterparty: row.counterparty,
      }));
      lineErr = (await supabase.from('journal_lines').insert(bare)).error;
    }
  }
  if (lineErr) {
    await supabase.from('journal_entries').delete().eq('id', entry.id);
    return { ok: false, error: lineErr.message };
  }

  return {
    ok: true,
    journalId: Number(entry.id),
    entryNumber: String(entry.entry_number || entryNumber),
  };
}

function asMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

/**
 * Reverse a posted journal (keeps history). No-op if already reversed.
 */
export async function reversePostedJournal(opts: {
  profileId: number;
  journalId: number;
  createdBy?: string | null;
  memo?: string;
  metadata?: Record<string, unknown>;
  entryDate?: string;
}): Promise<PostJournalResult | { ok: true; journalId: number; entryNumber: string; skipped: true }> {
  const supabase = getSupabaseServer();
  const { data: je } = await supabase
    .from('journal_entries')
    .select('id, status, entry_date, memo, entry_number, metadata, currency')
    .eq('id', opts.journalId)
    .eq('profile_id', opts.profileId)
    .maybeSingle();
  if (!je) return { ok: false, error: 'Journal not found' };
  if (String(je.status) !== 'posted') {
    return { ok: false, error: 'Only posted journals can be reversed' };
  }
  const meta = asMeta(je.metadata);
  if (meta.reversed_by_journal_id) {
    return {
      ok: true,
      skipped: true,
      journalId: Number(meta.reversed_by_journal_id),
      entryNumber: '',
    };
  }

  const { data: oldLines } = await supabase
    .from('journal_lines')
    .select('account_id, debit, credit, memo, counterparty')
    .eq('journal_entry_id', opts.journalId);
  if (!oldLines?.length) return { ok: false, error: 'No lines to reverse' };

  let entryDate =
    String(opts.entryDate || je.entry_date || new Date().toISOString()).slice(0, 10);
  const lock = await isPeriodLocked(opts.profileId, entryDate);
  if (lock.locked) {
    const today = new Date().toISOString().slice(0, 10);
    const todayLock = await isPeriodLocked(opts.profileId, today);
    if (!todayLock.locked) entryDate = today;
  }

  const posted = await postBalancedJournal({
    profileId: opts.profileId,
    entryDate,
    memo:
      opts.memo ||
      `Reversal of ${je.entry_number || opts.journalId}${je.memo ? `: ${je.memo}` : ''}`,
    source: 'reversal',
    sourceId: String(opts.journalId),
    currency: String(je.currency || 'ZAR'),
    createdBy: opts.createdBy || null,
    metadata: {
      reverses_journal_id: opts.journalId,
      reverses_entry_number: je.entry_number,
      ...(opts.metadata || {}),
    },
    lines: oldLines.map((l) => ({
      accountId: Number(l.account_id),
      debit: round2(Number(l.credit || 0)),
      credit: round2(Number(l.debit || 0)),
      memo: l.memo,
      counterparty: l.counterparty,
    })),
  });
  if (!posted.ok) return posted;

  const stamped = {
    ...meta,
    reversed_by_journal_id: posted.journalId,
    reversed_at: new Date().toISOString(),
  };
  let { error: stampErr } = await supabase
    .from('journal_entries')
    .update({ metadata: stamped })
    .eq('id', opts.journalId)
    .eq('profile_id', opts.profileId);
  if (stampErr) {
    console.warn('[reversePostedJournal] stamp', stampErr.message);
  }

  return posted;
}
