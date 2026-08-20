/**
 * Counterparty learning — learn GL / VAT patterns from past bank allocations
 * and posted journals so bank-statement proposals improve without a rule for
 * every merchant.
 */

import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  normalizeMerchantKey,
  suggestGlForDescription,
} from '@/lib/accounting/mass-allocate';
import { suggestVatCode, vatFromInclusive } from '@/lib/accounting/vat';
import type { CoaAccount } from '@/lib/accounting/types';

export type LearnedPattern = {
  merchant_key: string;
  gl_account_id: number | null;
  gl_hits: number;
  tax_code: string | null;
  tax_hits: number;
  invoice_counterparty: string | null;
  hits: number;
  last_amount?: number;
  sample_description?: string;
  source: 'bank' | 'journal' | 'mixed';
};

export type AllocationProposal = {
  gl_account_id: number;
  gl_code: string | null;
  gl_name: string | null;
  tax_code: string | null;
  tax_reason: string | null;
  tax_amount: number;
  confidence: number;
  reason: string;
  source: 'learned' | 'journal' | 'keyword';
  hits: number;
};

export function merchantKeyFromTxn(
  description: string | null | undefined,
  counterparty?: string | null
): string {
  if (counterparty && String(counterparty).trim().length > 2) {
    return normalizeMerchantKey(String(counterparty));
  }
  return normalizeMerchantKey(description);
}

export function winningVote<T>(votes: Map<T, number>): { key: T; hits: number } | null {
  let best: { key: T; hits: number } | null = null;
  for (const [key, hits] of votes) {
    if (!best || hits > best.hits) best = { key, hits };
  }
  return best;
}

function isCashLike(a: {
  code?: string | null;
  subtype?: string | null;
  account_type?: string | null;
}): boolean {
  const s = String(a.subtype || '').toLowerCase();
  const c = String(a.code || '');
  return s === 'bank' || s === 'cash' || c === '1110' || c === '1120';
}

type Bucket = {
  glVotes: Map<number, number>;
  taxVotes: Map<string, number>;
  invoice_counterparty: string | null;
  last_amount: number;
  sample_description: string;
  source: LearnedPattern['source'];
};

function bump(
  map: Map<string, Bucket>,
  key: string,
  opts: {
    gl?: number | null;
    tax?: string | null;
    counterparty?: string | null;
    amount?: number;
    sample?: string;
    source: LearnedPattern['source'];
  }
) {
  if (!key || key === 'other') return;
  let b = map.get(key);
  if (!b) {
    b = {
      glVotes: new Map(),
      taxVotes: new Map(),
      invoice_counterparty: null,
      last_amount: 0,
      sample_description: '',
      source: opts.source,
    };
    map.set(key, b);
  }
  if (opts.gl && Number.isFinite(opts.gl)) {
    b.glVotes.set(opts.gl, (b.glVotes.get(opts.gl) || 0) + 1);
  }
  const tax = String(opts.tax || '').trim().toUpperCase();
  if (tax) b.taxVotes.set(tax, (b.taxVotes.get(tax) || 0) + 1);
  if (opts.counterparty && !b.invoice_counterparty) {
    b.invoice_counterparty = opts.counterparty;
  }
  if (opts.amount != null) b.last_amount = opts.amount;
  if (opts.sample && !b.sample_description) {
    b.sample_description = opts.sample.slice(0, 120);
  }
  if (b.source !== opts.source) b.source = 'mixed';
}

function freeze(map: Map<string, Bucket>): Map<string, LearnedPattern> {
  const out = new Map<string, LearnedPattern>();
  for (const [key, b] of map) {
    const gl = winningVote(b.glVotes);
    const tax = winningVote(b.taxVotes);
    const hits = Math.max(
      [...b.glVotes.values()].reduce((s, n) => s + n, 0),
      [...b.taxVotes.values()].reduce((s, n) => s + n, 0)
    );
    out.set(key, {
      merchant_key: key,
      gl_account_id: gl?.key ?? null,
      gl_hits: gl?.hits ?? 0,
      tax_code: tax?.key ?? null,
      tax_hits: tax?.hits ?? 0,
      invoice_counterparty: b.invoice_counterparty,
      hits,
      last_amount: b.last_amount,
      sample_description: b.sample_description,
      source: b.source,
    });
  }
  return out;
}

/**
 * Build a map of merchant_key → preferred GL / VAT from history.
 */
export async function loadLearnedPatterns(
  companyId: number
): Promise<Map<string, LearnedPattern>> {
  const supabase = getSupabaseServer();
  const buckets = new Map<string, Bucket>();

  const { data: rows } = await supabase
    .from('bank_transactions')
    .select(
      'description, counterparty_name, gl_account_id, amount, allocation_status, tax_code'
    )
    .eq('profile_id', companyId)
    .in('allocation_status', ['allocated', 'matched_invoice'])
    .order('allocated_at', { ascending: false })
    .limit(800);

  for (const r of rows || []) {
    const key = merchantKeyFromTxn(r.description, r.counterparty_name);
    bump(buckets, key, {
      gl: r.gl_account_id != null ? Number(r.gl_account_id) : null,
      tax: r.tax_code ? String(r.tax_code) : null,
      counterparty: r.counterparty_name ? String(r.counterparty_name) : null,
      amount: Number(r.amount || 0),
      sample: String(r.description || ''),
      source: 'bank',
    });
  }

  try {
    await learnFromPostedJournals(companyId, buckets);
  } catch {
    /* journal columns may differ — bank history still counts */
  }

  return freeze(buckets);
}

async function learnFromPostedJournals(
  companyId: number,
  buckets: Map<string, Bucket>
) {
  const supabase = getSupabaseServer();
  const { data: journals, error } = await supabase
    .from('journal_entries')
    .select('id, memo, source, status')
    .eq('profile_id', companyId)
    .eq('status', 'posted')
    .order('entry_date', { ascending: false })
    .limit(400);
  if (error || !journals?.length) return;

  const allowedSource = new Set([
    'bank_allocation',
    'manual',
    'journal',
    'bank',
    '',
  ]);
  const usable = journals.filter((j) =>
    allowedSource.has(String(j.source || '').toLowerCase())
  );
  const ids = usable.map((j) => Number(j.id)).filter((n) => Number.isFinite(n));
  if (!ids.length) return;

  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('id, code, subtype, account_type, is_header')
    .eq('profile_id', companyId);
  const skip = new Set(
    (accounts || [])
      .filter((a) => isCashLike(a) || a.is_header)
      .map((a) => Number(a.id))
  );

  let lines: Array<Record<string, unknown>> = [];
  const lined = await supabase
    .from('journal_lines')
    .select('journal_entry_id, account_id, memo, counterparty, debit, credit')
    .in('journal_entry_id', ids);
  if (lined.error) {
    const retry = await supabase
      .from('journal_lines')
      .select('journal_entry_id, account_id, memo, debit, credit')
      .in('journal_entry_id', ids);
    lines = (retry.data || []) as Array<Record<string, unknown>>;
  } else {
    lines = (lined.data || []) as Array<Record<string, unknown>>;
  }

  const memoById = new Map(
    usable.map((j) => [Number(j.id), String(j.memo || '')])
  );

  for (const l of lines) {
    const accountId = Number(l.account_id);
    if (!Number.isFinite(accountId) || skip.has(accountId)) continue;
    const d = Number(l.debit || 0);
    const c = Number(l.credit || 0);
    if (Math.abs(d) < 0.005 && Math.abs(c) < 0.005) continue;
    const jid = Number(l.journal_entry_id);
    const sample = String(
      l.counterparty || l.memo || memoById.get(jid) || ''
    );
    const key = merchantKeyFromTxn(sample, l.counterparty ? String(l.counterparty) : null);
    bump(buckets, key, {
      gl: accountId,
      sample,
      amount: c - d,
      source: 'journal',
    });
  }
}

export function learningBoost(
  description: string | null | undefined,
  counterparty: string | null | undefined,
  learned: Map<string, LearnedPattern>
): {
  gl_account_id: number | null;
  tax_code: string | null;
  confidence: number;
  reason: string;
  hits: number;
  source: LearnedPattern['source'];
} | null {
  const key = merchantKeyFromTxn(description, counterparty);
  if (!key || key === 'other') return null;
  const pat = learned.get(key);
  if (!pat || !pat.gl_account_id) return null;
  const hits = Math.max(pat.gl_hits, pat.hits);
  if (hits < 2) {
    return {
      gl_account_id: pat.gl_account_id,
      tax_code: pat.tax_hits >= 1 ? pat.tax_code : null,
      confidence: 48,
      reason: `Learned once from “${pat.sample_description || key}”`,
      hits,
      source: pat.source,
    };
  }
  const confidence = Math.min(88, 58 + hits * 4);
  return {
    gl_account_id: pat.gl_account_id,
    tax_code: pat.tax_code,
    confidence,
    reason: `Learned from ${hits} past ${pat.source === 'journal' ? 'journals' : 'allocations'} (${key})`,
    hits,
    source: pat.source,
  };
}

export function taxAmountForCode(
  amount: number,
  taxCode: string | null | undefined
): number {
  const c = String(taxCode || '').toUpperCase();
  if (c === 'VAT15' || c === 'STANDARD' || c === 'ST15') {
    return vatFromInclusive(Math.abs(Number(amount) || 0), 15).vat;
  }
  return 0;
}

export function proposeForBankLine(
  txn: {
    description?: string | null;
    counterparty_name?: string | null;
    amount: number;
  },
  learned: Map<string, LearnedPattern>,
  coa: CoaAccount[]
): AllocationProposal | null {
  const desc = txn.description || '';
  const boost = learningBoost(desc, txn.counterparty_name, learned);
  const vatHint = suggestVatCode(desc, Number(txn.amount || 0));
  const taxCode = boost?.tax_code || vatHint.code;
  const taxReason = boost?.tax_code
    ? `VAT from your past postings (${boost.tax_code})`
    : vatHint.reason;

  if (boost?.gl_account_id) {
    const acc = coa.find((a) => Number(a.id) === Number(boost.gl_account_id));
    return {
      gl_account_id: boost.gl_account_id,
      gl_code: acc?.code || null,
      gl_name: acc?.name || null,
      tax_code: taxCode,
      tax_reason: taxReason,
      tax_amount: taxAmountForCode(txn.amount, taxCode),
      confidence: boost.confidence,
      reason: boost.reason,
      source: boost.source === 'journal' ? 'journal' : 'learned',
      hits: boost.hits,
    };
  }

  const keyword = suggestGlForDescription(desc, Number(txn.amount || 0), coa);
  if (!keyword) return null;
  return {
    gl_account_id: keyword.id,
    gl_code: keyword.label.split(' · ')[0] || null,
    gl_name: keyword.label.split(' · ').slice(1).join(' · ') || null,
    tax_code: vatHint.code,
    tax_reason: vatHint.reason,
    tax_amount: taxAmountForCode(txn.amount, vatHint.code),
    confidence: 55,
    reason: `Keyword match · ${keyword.label}`,
    source: 'keyword',
    hits: 0,
  };
}

export async function proposeForTransactions(
  companyId: number,
  txns: Array<{
    id: number | string;
    description?: string | null;
    counterparty_name?: string | null;
    amount: number;
    allocation_status?: string | null;
  }>
): Promise<Map<string, AllocationProposal>> {
  const out = new Map<string, AllocationProposal>();
  const unalloc = txns.filter(
    (t) => (t.allocation_status || 'unallocated') === 'unallocated'
  );
  if (!unalloc.length) return out;

  const supabase = getSupabaseServer();
  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, account_type, subtype, is_header, is_active')
    .eq('profile_id', companyId);
  const coa = (accounts || []) as CoaAccount[];
  const learned = await loadLearnedPatterns(companyId);

  for (const t of unalloc) {
    const p = proposeForBankLine(t, learned, coa);
    if (p) out.set(String(t.id), p);
  }
  return out;
}


