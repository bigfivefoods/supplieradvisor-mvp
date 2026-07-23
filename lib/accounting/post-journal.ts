/**
 * Shared double-entry journal poster for operational modules (manufacturing, etc.).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { ensureDefaultCoa, nextDocumentNumber, round2 } from '@/lib/accounting/server';

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

  const totalDr = round2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCr = round2(lines.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(totalDr - totalCr) > 0.02) {
    return {
      ok: false,
      error: `Unbalanced journal (Dr ${totalDr} vs Cr ${totalCr})`,
    };
  }

  let entryNumber: string;
  try {
    entryNumber = await nextDocumentNumber(opts.profileId, 'journal');
  } catch {
    entryNumber = `JE-MFG-${Date.now()}`;
  }

  const status = opts.status || 'posted';
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

  const withDims = lines.map((l) => ({
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
    const stripHeavy = withDims.map((l) => {
      const {
        fixed_asset_id: _f,
        liability_id: _li,
        ...rest
      } = l;
      return rest;
    });
    lineErr = (await supabase.from('journal_lines').insert(stripHeavy)).error;
    if (lineErr && /column|schema cache|does not exist/i.test(lineErr.message)) {
      const bare = withDims.map((row) => ({
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
