/**
 * Posted-journal debit/credit totals by account.
 * Prefers sa_account_totals RPC; falls back to paged JS reads.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { round2 } from '@/lib/accounting/server';
import {
  fetchJournalLinesByEntryIds,
  fetchPostedJournalIds,
} from '@/lib/accounting/journal-query';

export type AccountTotalRow = {
  account_id: number;
  debit: number;
  credit: number;
  code?: string | null;
  name?: string | null;
  account_type?: string | null;
};

export type AccountTotals = {
  ok: boolean;
  entry_count: number;
  total_debit: number;
  total_credit: number;
  rows: AccountTotalRow[];
  warning?: string;
};

export function dayBeforeIso(iso: string): string {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function totalsMap(
  rows: AccountTotalRow[]
): Map<number, { debit: number; credit: number }> {
  const m = new Map<number, { debit: number; credit: number }>();
  for (const r of rows) {
    m.set(Number(r.account_id), {
      debit: Number(r.debit || 0),
      credit: Number(r.credit || 0),
    });
  }
  return m;
}

export async function fetchAccountTotals(opts: {
  profileId: number;
  from?: string | null;
  to?: string | null;
  excludeSources?: string[] | null;
}): Promise<AccountTotals> {
  const from = opts.from ? String(opts.from).slice(0, 10) : null;
  const to = opts.to ? String(opts.to).slice(0, 10) : null;
  const exclude = (opts.excludeSources || []).filter(Boolean);

  const supabase = getSupabaseServer();
  const rpc = await supabase.rpc('sa_account_totals', {
    p_company_id: opts.profileId,
    p_from: from,
    p_to: to,
    p_exclude_sources: exclude.length ? exclude : null,
  });
  if (!rpc.error && rpc.data && typeof rpc.data === 'object') {
    const raw = rpc.data as Record<string, unknown>;
    if (raw.ok === true && Array.isArray(raw.rows)) {
      const rows = (raw.rows as AccountTotalRow[]).map((r) => ({
        account_id: Number(r.account_id),
        debit: round2(Number(r.debit || 0)),
        credit: round2(Number(r.credit || 0)),
        code: r.code != null ? String(r.code) : null,
        name: r.name != null ? String(r.name) : null,
        account_type: r.account_type != null ? String(r.account_type) : null,
      }));
      return {
        ok: true,
        entry_count: Number(raw.entry_count) || 0,
        total_debit: round2(Number(raw.total_debit || 0)),
        total_credit: round2(Number(raw.total_credit || 0)),
        rows,
      };
    }
  }

  return fetchAccountTotalsJs(opts);
}

async function fetchAccountTotalsJs(opts: {
  profileId: number;
  from?: string | null;
  to?: string | null;
  excludeSources?: string[] | null;
}): Promise<AccountTotals> {
  const exclude = new Set(
    (opts.excludeSources || []).map((s) => String(s).toLowerCase())
  );
  const { ids, warning: idWarn } = await fetchPostedJournalIds({
    profileId: opts.profileId,
    from: opts.from,
    to: opts.to,
  });
  if (!ids.length) {
    return {
      ok: true,
      entry_count: 0,
      total_debit: 0,
      total_credit: 0,
      rows: [],
      warning: idWarn,
    };
  }

  let useIds = ids;
  if (exclude.size) {
    const supabase = getSupabaseServer();
    const live: number[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data } = await supabase
        .from('journal_entries')
        .select('id, source')
        .in('id', chunk);
      for (const row of data || []) {
        const src = String(row.source || '').toLowerCase();
        if (exclude.has(src)) continue;
        live.push(Number(row.id));
      }
    }
    useIds = live;
  }

  const { lines, warning: lErr } = await fetchJournalLinesByEntryIds(
    useIds,
    'account_id, debit, credit'
  );
  const byAcct = new Map<number, { debit: number; credit: number }>();
  let totalDebit = 0;
  let totalCredit = 0;
  for (const l of lines) {
    const aid = Number(l.account_id);
    if (!Number.isFinite(aid)) continue;
    const d = Number(l.debit || 0);
    const c = Number(l.credit || 0);
    totalDebit += d;
    totalCredit += c;
    const cur = byAcct.get(aid) || { debit: 0, credit: 0 };
    cur.debit += d;
    cur.credit += c;
    byAcct.set(aid, cur);
  }

  return {
    ok: !lErr,
    entry_count: useIds.length,
    total_debit: round2(totalDebit),
    total_credit: round2(totalCredit),
    rows: [...byAcct.entries()].map(([account_id, v]) => ({
      account_id,
      debit: round2(v.debit),
      credit: round2(v.credit),
    })),
    warning: lErr || idWarn,
  };
}
