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

  const lineRows = lines.map((l) => ({
    journal_entry_id: entry.id,
    profile_id: opts.profileId,
    account_id: l.account_id,
    debit: l.debit,
    credit: l.credit,
    memo: l.memo,
    counterparty: l.counterparty,
  }));

  const { error: lineErr } = await supabase.from('journal_lines').insert(lineRows);
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
