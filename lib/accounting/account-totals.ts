/**
 * Posted-journal debit/credit totals by account.
 * Always the shared paged ledger (`loadPostedLedger`). The SQL function
 * `sa_account_totals` is not used: a second total would let the AFS and the
 * balance sheet disagree.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { loadPostedLedger, totalsFromLedger } from '@/lib/accounting/posted-ledger';

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
  const ledger = await loadPostedLedger({
    profileId: opts.profileId,
    from,
    to,
    includeLines: true,
    journalColumns: 'core',
    lineColumns: 'amounts',
  });
  const agg = totalsFromLedger({
    journals: ledger.journals,
    lines: ledger.lines,
    excludeSources: opts.excludeSources,
  });

  const names = new Map<
    number,
    { code: string | null; name: string | null; account_type: string | null }
  >();
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, account_type')
      .eq('profile_id', opts.profileId);
    if (!error) {
      for (const account of data || []) {
        names.set(Number(account.id), {
          code: account.code != null ? String(account.code) : null,
          name: account.name != null ? String(account.name) : null,
          account_type:
            account.account_type != null ? String(account.account_type) : null,
        });
      }
    }
  } catch {
    /* Codes are display-only. Totals already come from the shared ledger. */
  }

  return {
    ok: !ledger.warning || agg.rows.length > 0,
    entry_count: agg.entry_count,
    total_debit: agg.total_debit,
    total_credit: agg.total_credit,
    rows: agg.rows.map((row) => {
      const meta = names.get(row.account_id);
      return {
        account_id: row.account_id,
        debit: row.debit,
        credit: row.credit,
        code: meta?.code ?? null,
        name: meta?.name ?? null,
        account_type: meta?.account_type ?? null,
      };
    }),
    warning: ledger.warning,
  };
}
