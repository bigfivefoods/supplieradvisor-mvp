/**
 * Year-end close: transfer P&L for a completed financial year into retained earnings.
 * IAS 1 presentation — equity must include accumulated profits after close.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  postBalancedJournal,
  resolveCoaAccountId,
  resolveCoaAccountIdByCode,
  type JournalLineInput,
} from '@/lib/accounting/post-journal';
import { computeTrialBalance } from '@/lib/accounting/trial-balance';
import { setPeriodLock } from '@/lib/accounting/period-lock';
import {
  fiscalYearEnd,
  fiscalYearLabelForStartYear,
  fiscalYearStart,
  normalizeFyStartMonth,
  toIsoDate,
} from '@/lib/accounting/fiscal';
import { getOrCreateSettings, round2 } from '@/lib/accounting/server';
import {
  fetchJournalLinesByEntryIds,
  fetchPostedJournalIds,
} from '@/lib/accounting/journal-query';

export async function closeFiscalYear(opts: {
  profileId: number;
  fyStartYear?: number;
  createdBy?: string | null;
  lockPeriods?: boolean;
}): Promise<
  | {
      ok: true;
      journalId: number;
      entryNumber: string;
      fyLabel: string;
      from: string;
      to: string;
      netIncome: number;
      lockedMonths: string[];
    }
  | { ok: false; error: string }
> {
  const settings = await getOrCreateSettings(opts.profileId);
  const startMonth = normalizeFyStartMonth(settings.fiscal_year_start_month);
  const today = new Date();
  const currentStart = fiscalYearStart(today, startMonth);
  const currentEnd = fiscalYearEnd(today, startMonth);
  let defaultStartYear = currentStart.getFullYear();
  if (toIsoDate(currentEnd) > toIsoDate(today)) {
    defaultStartYear -= 1;
  }
  const startYear = Number(
    opts.fyStartYear != null && Number.isFinite(Number(opts.fyStartYear))
      ? opts.fyStartYear
      : defaultStartYear
  );
  const fyRef = new Date(startYear, startMonth - 1, 15);
  const from = toIsoDate(fiscalYearStart(fyRef, startMonth));
  const to = toIsoDate(fiscalYearEnd(fyRef, startMonth));
  const fyLabel = fiscalYearLabelForStartYear(startYear, startMonth);

  if (to > toIsoDate(today)) {
    return {
      ok: false,
      error: `Financial year ${fyLabel} has not ended (${to}). Close only after year-end.`,
    };
  }

  const supabase = getSupabaseServer();
  const { data: prior } = await supabase
    .from('journal_entries')
    .select('id, metadata')
    .eq('profile_id', opts.profileId)
    .eq('source', 'year_end_close')
    .eq('status', 'posted')
    .limit(50);
  const already = (prior || []).some((row) => {
    const m =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {};
    return String(m.fy_end || '') === to || String(m.fy_label || '') === fyLabel;
  });
  if (already) {
    return { ok: false, error: `Year-end close for ${fyLabel} is already posted` };
  }

  const tb = await computeTrialBalance({
    profileId: opts.profileId,
    from,
    to,
  });
  if (!tb.ok) {
    return { ok: false, error: tb.warning || 'Could not compute trial balance' };
  }
  if (!tb.balanced && tb.entry_count > 0) {
    return {
      ok: false,
      error: `Cannot close ${fyLabel}: trial balance is out by ${tb.difference}`,
    };
  }

  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('id, code, account_type, is_header, is_active')
    .eq('profile_id', opts.profileId);
  const pl = (accounts || []).filter(
    (a) =>
      !a.is_header &&
      a.is_active !== false &&
      ['revenue', 'expense', 'cogs'].includes(String(a.account_type))
  );
  const plIds = new Set(pl.map((a) => Number(a.id)));

  const { ids, warning } = await fetchPostedJournalIds({
    profileId: opts.profileId,
    from,
    to,
  });
  if (warning && !ids.length) return { ok: false, error: warning };

  const { lines, warning: lineWarn } = await fetchJournalLinesByEntryIds(ids);
  if (lineWarn) return { ok: false, error: lineWarn };

  const bal = new Map<number, number>();
  for (const l of lines) {
    const aid = Number(l.account_id);
    if (!plIds.has(aid)) continue;
    const net = Number(l.debit || 0) - Number(l.credit || 0);
    bal.set(aid, (bal.get(aid) || 0) + net);
  }

  const reId =
    (await resolveCoaAccountIdByCode(opts.profileId, '3200')) ||
    (await resolveCoaAccountId({
      profileId: opts.profileId,
      subtypes: ['retained'],
      accountTypes: ['equity'],
    }));
  if (!reId) {
    return {
      ok: false,
      error: 'COA missing retained earnings (3200) — seed Chart of Accounts',
    };
  }

  const closeLines: JournalLineInput[] = [];
  let netIncome = 0;
  for (const a of pl) {
    const netDr = round2(bal.get(Number(a.id)) || 0);
    if (Math.abs(netDr) < 0.005) continue;
    // netDr > 0 → expense/cogs (debit balance) — credit to close
    // netDr < 0 → revenue (credit balance) — debit to close
    closeLines.push({
      accountId: Number(a.id),
      debit: netDr < 0 ? round2(-netDr) : 0,
      credit: netDr > 0 ? netDr : 0,
      memo: `Close ${a.code} FY ${fyLabel}`,
    });
    netIncome -= netDr;
  }
  netIncome = round2(netIncome);
  if (!closeLines.length) {
    return { ok: false, error: `No P&L balances to close for ${fyLabel}` };
  }
  if (netIncome >= 0) {
    closeLines.push({
      accountId: reId,
      debit: 0,
      credit: netIncome,
      memo: `Retained earnings FY ${fyLabel}`,
    });
  } else {
    closeLines.push({
      accountId: reId,
      debit: round2(-netIncome),
      credit: 0,
      memo: `Retained earnings (loss) FY ${fyLabel}`,
    });
  }

  const posted = await postBalancedJournal({
    profileId: opts.profileId,
    entryDate: to,
    memo: `Year-end close FY ${fyLabel}`,
    source: 'year_end_close',
    sourceId: fyLabel,
    createdBy: opts.createdBy || null,
    metadata: {
      fy_start_year: startYear,
      fy_start: from,
      fy_end: to,
      fy_label: fyLabel,
      net_income: netIncome,
    },
    lines: closeLines,
  });
  if (!posted.ok) return { ok: false, error: posted.error };

  const lockedMonths: string[] = [];
  if (opts.lockPeriods !== false) {
    const start = fiscalYearStart(fyRef, startMonth);
    for (let i = 0; i < 12; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const res = await setPeriodLock({
        profileId: opts.profileId,
        period_key: key,
        locked: true,
        userId: opts.createdBy || null,
        note: `Year-end close FY ${fyLabel}`,
      });
      if (res.ok) lockedMonths.push(key);
    }
  }

  return {
    ok: true,
    journalId: posted.journalId,
    entryNumber: posted.entryNumber,
    fyLabel,
    from,
    to,
    netIncome,
    lockedMonths,
  };
}
