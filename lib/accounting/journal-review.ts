/**
 * Review posted journals for likely wrong GL accounts.
 * Uses past allocations + other journals (leave-one-out) and keyword rules.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import type { CoaAccount } from '@/lib/accounting/types';
import {
  DEFAULT_ALLOC_RULES,
  suggestGlForDescription,
} from '@/lib/accounting/mass-allocate';
import {
  loadLearnedPatterns,
  merchantKeyFromTxn,
  winningVote,
  type LearnedPattern,
} from '@/lib/banking/learning';
import {
  keepBlocksFlag,
  loadAllocationKeeps,
} from '@/lib/accounting/allocation-keep';
import { journalEligibleForReview } from '@/lib/accounting/journal-status';

export type JournalReviewFlag = {
  journal_id: number;
  journal_number: string | null;
  entry_date: string;
  memo: string | null;
  source: string | null;
  line_id: number | null;
  posted_account_id: number;
  posted_account_label: string;
  posted_account_type: string;
  suggested_account_id: number;
  suggested_account_label: string;
  suggested_account_type: string;
  amount: number;
  side: 'debit' | 'credit';
  description: string;
  confidence: number;
  reason: string;
  signal: 'learned' | 'keyword' | 'both' | 'type';
  merchant_key: string;
};

export type JournalReviewReport = {
  at: string;
  scanned: number;
  flagged: number;
  flags: JournalReviewFlag[];
};

export function reviewFlagKey(flag: {
  journal_id: number;
  line_id: number | null;
  posted_account_id: number;
}): string {
  return `${flag.journal_id}:${flag.line_id ?? 'x'}:${flag.posted_account_id}`;
}

/** Swap flagged lines onto the suggested GL (by line id, else account + side). */
export function applySuggestedAccountsToLines(
  lines: Array<{
    id?: number | null;
    account_id: number;
    debit?: number | null;
    credit?: number | null;
    memo?: string | null;
  }>,
  flags: Array<{
    line_id: number | null;
    posted_account_id: number;
    suggested_account_id: number;
    side: 'debit' | 'credit';
  }>
): Array<{ account_id: number; debit: number; credit: number; memo?: string }> {
  const remaining = flags.map((f) => ({ f, used: false }));
  return lines.map((l) => {
    const debit = Number(l.debit || 0);
    const credit = Number(l.credit || 0);
    const lineId = l.id != null ? Number(l.id) : null;
    let hit = remaining.find(
      (row) =>
        !row.used &&
        lineId != null &&
        row.f.line_id != null &&
        Number(row.f.line_id) === lineId
    );
    if (!hit) {
      hit = remaining.find((row) => {
        if (row.used) return false;
        if (
          lineId != null &&
          row.f.line_id != null &&
          Number(row.f.line_id) !== lineId
        ) {
          return false;
        }
        const sameAccount =
          Number(row.f.posted_account_id) === Number(l.account_id);
        const sameSide = row.f.side === 'debit' ? debit > 0 : credit > 0;
        return sameAccount && sameSide;
      });
    }
    if (hit) hit.used = true;
    return {
      account_id: hit
        ? Number(hit.f.suggested_account_id)
        : Number(l.account_id),
      debit,
      credit,
      memo: l.memo || undefined,
    };
  });
}

function skipAccount(a: {
  code?: string | null;
  subtype?: string | null;
  account_type?: string | null;
  is_header?: boolean | null;
  name?: string | null;
}): boolean {
  if (a.is_header) return true;
  const sub = String(a.subtype || '').toLowerCase();
  if (
    [
      'bank',
      'cash',
      'tax',
      'receivable',
      'payable',
      'contra_asset',
      'inventory',
      'fixed',
    ].includes(sub)
  ) {
    return true;
  }
  const code = String(a.code || '');
  if (['1110', '1120', '1130', '1150', '2110', '2120'].includes(code)) return true;
  const n = String(a.name || '').toLowerCase();
  if (/\bvat\b/.test(n) && sub === 'tax') return true;
  return false;
}

function accountLabel(a: CoaAccount | undefined, id: number): string {
  if (!a) return `#${id}`;
  return `${a.code} · ${a.name}`;
}

function typesConflict(a: string, b: string): boolean {
  const income = new Set(['revenue']);
  const cost = new Set(['expense', 'cogs']);
  return (
    (income.has(a) && cost.has(b)) ||
    (cost.has(a) && income.has(b))
  );
}

function keywordRuleSpecific(description: string): boolean {
  const desc = description || '';
  const generic = /pos purchase|purchase|fnb app payment to|internet pmt to|payment to|transfer to/i;
  for (const rule of DEFAULT_ALLOC_RULES) {
    if (!rule.pattern.test(desc)) continue;
    if (generic.test(rule.pattern.source)) return false;
    return true;
  }
  return false;
}

function keywordPrefersIncome(description: string): boolean | null {
  const desc = description || '';
  for (const rule of DEFAULT_ALLOC_RULES) {
    if (!rule.pattern.test(desc)) continue;
    return rule.preferIncome === true;
  }
  return null;
}

export function scorePostedLine(opts: {
  journalId: number;
  postedAccountId: number;
  description: string;
  amountSigned: number;
  coa: CoaAccount[];
  /** Other journals' GL votes for this merchant key */
  otherGlVotes: Map<number, number>;
  bankPattern?: LearnedPattern | null;
}): {
  suggestedId: number;
  confidence: number;
  reason: string;
  signal: JournalReviewFlag['signal'];
} | null {
  const posted = opts.coa.find((a) => Number(a.id) === Number(opts.postedAccountId));
  if (!posted || skipAccount(posted)) return null;

  const keyword = suggestGlForDescription(
    opts.description,
    opts.amountSigned,
    opts.coa
  );
  const majority = winningVote(opts.otherGlVotes);
  const bankGl = opts.bankPattern?.gl_account_id
    ? Number(opts.bankPattern.gl_account_id)
    : null;
  const bankHits = opts.bankPattern
    ? Math.max(opts.bankPattern.gl_hits, opts.bankPattern.hits)
    : 0;

  let suggestedId: number | null = null;
  let confidence = 0;
  let reason = '';
  let signal: JournalReviewFlag['signal'] = 'keyword';

  if (majority && majority.hits >= 2 && majority.key !== Number(opts.postedAccountId)) {
    suggestedId = majority.key;
    confidence = Math.min(92, 56 + majority.hits * 6);
    reason = `Similar journals usually use another account (${majority.hits} times)`;
    signal = 'learned';
  } else if (
    bankGl &&
    bankHits >= 2 &&
    bankGl !== Number(opts.postedAccountId) &&
    (!majority || majority.key === bankGl)
  ) {
    suggestedId = bankGl;
    confidence = Math.min(90, 54 + bankHits * 5);
    reason = `Past bank allocations for this description used another account (${bankHits} times)`;
    signal = 'learned';
  }

  if (keyword && keyword.id !== Number(opts.postedAccountId)) {
    const kwAcc = opts.coa.find((a) => Number(a.id) === Number(keyword.id));
    const postedType = String(posted.account_type || '');
    const kwType = String(kwAcc?.account_type || '');
    const conflict = typesConflict(postedType, kwType);
    const specific = keywordRuleSpecific(opts.description);
    const incomeHint = keywordPrefersIncome(opts.description);

    if (conflict || (incomeHint === true && postedType !== 'revenue')) {
      if (!suggestedId) suggestedId = keyword.id;
      confidence = Math.max(confidence, 72);
      reason = reason
        ? `${reason}. Description looks like ${kwType}, not ${postedType}`
        : `Description looks like ${kwType} (${keyword.label}), not ${postedType}`;
      signal = suggestedId === keyword.id && signal === 'learned' ? 'both' : 'type';
    } else if (specific) {
      if (!suggestedId) suggestedId = keyword.id;
      confidence = Math.max(confidence, 62);
      reason = reason
        ? `${reason}. Keyword match: ${keyword.label}`
        : `Keyword match suggests ${keyword.label}`;
      if (signal === 'learned' && suggestedId === keyword.id) signal = 'both';
      else if (signal !== 'learned') signal = 'keyword';
    }
  }

  if (!suggestedId || suggestedId === Number(opts.postedAccountId)) return null;
  if (confidence < 58) return null;

  const sug = opts.coa.find((a) => Number(a.id) === Number(suggestedId));
  if (!sug || skipAccount(sug)) return null;

  return {
    suggestedId,
    confidence: Math.round(confidence),
    reason,
    signal,
  };
}

export async function reviewPostedJournals(opts: {
  companyId: number;
  from?: string | null;
  to?: string | null;
}): Promise<JournalReviewReport> {
  const empty: JournalReviewReport = {
    at: new Date().toISOString(),
    scanned: 0,
    flagged: 0,
    flags: [],
  };
  const supabase = getSupabaseServer();
  const companyId = opts.companyId;

  const { data: accounts, error: coaErr } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, account_type, subtype, is_header, is_active')
    .eq('profile_id', companyId);
  if (coaErr || !accounts?.length) return empty;
  const coa = (accounts || []) as CoaAccount[];
  const skipIds = new Set(
    coa.filter((a) => skipAccount(a)).map((a) => Number(a.id))
  );

  type ReviewJournalRow = {
    id: number;
    entry_number: string | null;
    entry_date: string | null;
    memo: string | null;
    source: string | null;
    status: string | null;
    metadata?: unknown;
  };
  let journals: ReviewJournalRow[] | null = null;
  let jErr: { message?: string } | null = null;
  {
    let jq = supabase
      .from('journal_entries')
      .select('id, entry_number, entry_date, memo, source, status, metadata')
      .eq('profile_id', companyId)
      .eq('status', 'posted')
      .order('entry_date', { ascending: false })
      .limit(500);
    if (opts.from) jq = jq.gte('entry_date', opts.from);
    if (opts.to) jq = jq.lte('entry_date', opts.to);
    const first = await jq;
    journals = (first.data || null) as ReviewJournalRow[] | null;
    jErr = first.error;
  }
  if (jErr) {
    let retry = supabase
      .from('journal_entries')
      .select('id, entry_number, entry_date, memo, source, status')
      .eq('profile_id', companyId)
      .eq('status', 'posted')
      .order('entry_date', { ascending: false })
      .limit(500);
    if (opts.from) retry = retry.gte('entry_date', opts.from);
    if (opts.to) retry = retry.lte('entry_date', opts.to);
    const r2 = await retry;
    journals = (r2.data || null) as ReviewJournalRow[] | null;
    jErr = r2.error;
  }
  if (jErr || !journals?.length) return empty;

  const usable = journals.filter((j) => journalEligibleForReview(j));
  const ids = usable.map((j) => Number(j.id)).filter((n) => Number.isFinite(n));
  if (!ids.length) return empty;

  const byJournal = new Map(
    usable.map((j) => [
      Number(j.id),
      {
        id: Number(j.id),
        entry_number: j.entry_number ? String(j.entry_number) : null,
        entry_date: String(j.entry_date || ''),
        memo: j.memo ? String(j.memo) : null,
        source: j.source ? String(j.source) : null,
      },
    ])
  );

  let lines: Array<Record<string, unknown>> = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const lined = await supabase
      .from('journal_lines')
      .select('id, journal_entry_id, account_id, memo, counterparty, debit, credit')
      .in('journal_entry_id', chunk);
    if (lined.error) {
      const retry = await supabase
        .from('journal_lines')
        .select('id, journal_entry_id, account_id, memo, debit, credit')
        .in('journal_entry_id', chunk);
      lines = lines.concat((retry.data || []) as Array<Record<string, unknown>>);
    } else {
      lines = lines.concat((lined.data || []) as Array<Record<string, unknown>>);
    }
  }

  const votes = new Map<string, Array<{ journalId: number; glId: number }>>();
  type Reviewable = {
    journalId: number;
    lineId: number | null;
    accountId: number;
    debit: number;
    credit: number;
    description: string;
    key: string;
  };
  const reviewable: Reviewable[] = [];

  for (const l of lines) {
    const journalId = Number(l.journal_entry_id);
    const accountId = Number(l.account_id);
    if (!byJournal.has(journalId)) continue;
    if (!Number.isFinite(accountId) || skipIds.has(accountId)) continue;
    const debit = Number(l.debit || 0);
    const credit = Number(l.credit || 0);
    if (Math.abs(debit) < 0.005 && Math.abs(credit) < 0.005) continue;
    const je = byJournal.get(journalId)!;
    const description = String(
      l.counterparty || l.memo || je.memo || ''
    ).trim();
    const key = merchantKeyFromTxn(
      description,
      l.counterparty ? String(l.counterparty) : null
    );
    const row: Reviewable = {
      journalId,
      lineId: l.id != null ? Number(l.id) : null,
      accountId,
      debit,
      credit,
      description,
      key,
    };
    reviewable.push(row);
    if (key && key !== 'other') {
      const list = votes.get(key) || [];
      list.push({ journalId, glId: accountId });
      votes.set(key, list);
    }
  }

  let learned = new Map<string, LearnedPattern>();
  try {
    learned = await loadLearnedPatterns(companyId);
  } catch {
    /* bank history optional */
  }

  let keeps = { lines: {}, patterns: {} };
  try {
    keeps = await loadAllocationKeeps(companyId);
  } catch {
    /* optional */
  }

  const flags: JournalReviewFlag[] = [];
  const seenLine = new Set<string>();

  for (const row of reviewable) {
    const unique = `${row.journalId}:${row.lineId || row.accountId}:${row.debit}:${row.credit}`;
    if (seenLine.has(unique)) continue;
    seenLine.add(unique);
    if (
      keepBlocksFlag(keeps, {
        journalId: row.journalId,
        lineId: row.lineId,
        merchantKey: row.key,
        postedAccountId: row.accountId,
      })
    ) {
      continue;
    }

    const other = new Map<number, number>();
    for (const v of votes.get(row.key) || []) {
      if (v.journalId === row.journalId) continue;
      other.set(v.glId, (other.get(v.glId) || 0) + 1);
    }

    const signed = row.credit - row.debit;
    const scored = scorePostedLine({
      journalId: row.journalId,
      postedAccountId: row.accountId,
      description: row.description || row.key,
      amountSigned: signed,
      coa,
      otherGlVotes: other,
      bankPattern: learned.get(row.key) || null,
    });
    if (!scored) continue;

    const posted = coa.find((a) => Number(a.id) === row.accountId);
    const sug = coa.find((a) => Number(a.id) === scored.suggestedId);
    const je = byJournal.get(row.journalId)!;
    flags.push({
      journal_id: row.journalId,
      journal_number: je.entry_number,
      entry_date: je.entry_date,
      memo: je.memo,
      source: je.source,
      line_id: row.lineId,
      posted_account_id: row.accountId,
      posted_account_label: accountLabel(posted, row.accountId),
      posted_account_type: String(posted?.account_type || ''),
      suggested_account_id: scored.suggestedId,
      suggested_account_label: accountLabel(sug, scored.suggestedId),
      suggested_account_type: String(sug?.account_type || ''),
      amount: Math.round(Math.abs(row.debit || row.credit) * 100) / 100,
      side: row.debit >= row.credit ? 'debit' : 'credit',
      description: row.description || je.memo || '',
      confidence: scored.confidence,
      reason: scored.reason,
      signal: scored.signal,
      merchant_key: row.key,
    });
  }

  flags.sort((a, b) => b.confidence - a.confidence || b.amount - a.amount);

  return {
    at: new Date().toISOString(),
    scanned: reviewable.length,
    flagged: flags.length,
    flags: flags.slice(0, 80),
  };
}
