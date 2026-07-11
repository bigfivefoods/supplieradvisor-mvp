/**
 * Bank match engine — score unallocated bank lines against:
 *  - Open AR/AP invoices (reference, amount, date, counterparty)
 *  - Company bank_match_rules
 *  - Built-in keyword → GL heuristics
 */

import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  allocateBankTransaction,
  matchBankToInvoice,
} from '@/lib/accounting/allocate';
import { DEFAULT_ALLOC_RULES } from '@/lib/accounting/mass-allocate';
import type { CoaAccount } from '@/lib/accounting/types';
import { round2 } from '@/lib/accounting/server';

export type MatchSuggestion =
  | {
      kind: 'invoice';
      confidence: number; // 0–100
      invoice_id: number;
      invoice_number: string | null;
      direction: string;
      counterparty: string | null;
      amount: number;
      reason: string;
    }
  | {
      kind: 'gl';
      confidence: number;
      gl_account_id: number;
      gl_code?: string | null;
      gl_name?: string | null;
      reason: string;
      rule_id?: number | null;
    }
  | {
      kind: 'exclude';
      confidence: number;
      reason: string;
      rule_id?: number | null;
    };

export type MatchRuleRow = {
  id: number;
  profile_id: number;
  priority: number;
  name: string;
  match_type: string;
  pattern: string;
  target_type: string;
  target_id?: number | null;
  target_value?: string | null;
  is_active?: boolean | null;
};

export type BankTxnLite = {
  id: number | string;
  amount: number;
  description?: string | null;
  reference?: string | null;
  counterparty_name?: string | null;
  txn_date?: string | null;
  allocation_status?: string | null;
};

type InvoiceLite = {
  id: number;
  invoice_number?: string | null;
  direction?: string | null;
  counterparty_name?: string | null;
  total_amount?: number | null;
  amount_paid?: number | null;
  balance_due?: number | null;
  status?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
};

function norm(s: string | null | undefined): string {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTokens(text: string): string[] {
  const inv = text.match(/\b(?:inv|invoice|tax\s*inv)[-_\s]?(\d{3,})\b/gi) || [];
  const po = text.match(/\b(?:po|order)[-_\s]?(\d{3,})\b/gi) || [];
  const bare = text.match(/\b[A-Z]{0,4}\d{4,12}\b/g) || [];
  return [...inv, ...po, ...bare].map((t) => t.replace(/\s+/g, '').toUpperCase());
}

function amountClose(a: number, b: number, tol = 0.02): boolean {
  return Math.abs(Math.abs(a) - Math.abs(b)) <= tol;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a.slice(0, 10)).getTime();
  const db = new Date(b.slice(0, 10)).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 999;
  return Math.abs(Math.round((da - db) / 86400000));
}

function fuzzyNameScore(a: string, b: string): number {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 40;
  if (na.includes(nb) || nb.includes(na)) return 28;
  const ta = new Set(na.split(' ').filter((w) => w.length > 2));
  const tb = nb.split(' ').filter((w) => w.length > 2);
  let hit = 0;
  for (const w of tb) if (ta.has(w)) hit++;
  if (hit >= 2) return 20;
  if (hit === 1) return 10;
  return 0;
}

/** Score a single bank line against open invoices + rules + heuristics. */
export function scoreBankTransaction(
  txn: BankTxnLite,
  invoices: InvoiceLite[],
  rules: MatchRuleRow[],
  coa: CoaAccount[]
): MatchSuggestion[] {
  const suggestions: MatchSuggestion[] = [];
  const amount = Number(txn.amount || 0);
  const isInflow = amount > 0;
  const desc = String(txn.description || '');
  const ref = String(txn.reference || '');
  const hay = `${desc} ${ref} ${txn.counterparty_name || ''}`;
  const hayNorm = norm(hay);
  const tokens = extractTokens(hay);
  const txnDate = String(txn.txn_date || '').slice(0, 10);

  // ── Invoice matches ───────────────────────────────────────────────────────
  const expectedDir = isInflow ? 'receivable' : 'payable';
  for (const inv of invoices) {
    if (inv.direction && inv.direction !== expectedDir) continue;
    const st = String(inv.status || '').toLowerCase();
    if (['paid', 'void', 'cancelled', 'draft'].includes(st)) continue;

    const balance =
      inv.balance_due != null
        ? Number(inv.balance_due)
        : round2(Number(inv.total_amount || 0) - Number(inv.amount_paid || 0));
    if (balance <= 0.005) continue;

    let confidence = 0;
    const reasons: string[] = [];
    const invNum = String(inv.invoice_number || '').trim();
    const invNumNorm = invNum.replace(/\s+/g, '').toUpperCase();

    if (invNum) {
      const invUpper = invNum.toUpperCase();
      if (ref.toUpperCase() === invUpper || ref.toUpperCase().replace(/\s/g, '') === invNumNorm) {
        confidence += 55;
        reasons.push(`exact reference = ${invNum}`);
      } else if (hay.toUpperCase().includes(invUpper) || hay.toUpperCase().includes(invNumNorm)) {
        confidence += 42;
        reasons.push(`description/ref contains ${invNum}`);
      } else {
        // token match e.g. INV-1042 vs 1042
        const digits = invNumNorm.replace(/\D/g, '');
        if (digits.length >= 4 && tokens.some((t) => t.includes(digits) || digits.includes(t.replace(/\D/g, '')))) {
          confidence += 30;
          reasons.push(`token match ${invNum}`);
        }
      }
    }

    if (amountClose(amount, balance)) {
      confidence += 30;
      reasons.push('amount matches balance due');
    } else if (amountClose(amount, Number(inv.total_amount || 0))) {
      confidence += 22;
      reasons.push('amount matches invoice total');
    } else if (Math.abs(Math.abs(amount) - balance) / Math.max(balance, 1) < 0.05) {
      confidence += 12;
      reasons.push('amount within 5% of balance');
    }

    const nameScore = fuzzyNameScore(
      String(txn.counterparty_name || desc),
      String(inv.counterparty_name || '')
    );
    if (nameScore) {
      confidence += nameScore;
      reasons.push('counterparty name similarity');
    }

    if (txnDate && (inv.invoice_date || inv.due_date)) {
      const dInv = String(inv.due_date || inv.invoice_date || '').slice(0, 10);
      const days = daysBetween(txnDate, dInv);
      if (days <= 3) {
        confidence += 10;
        reasons.push('date within 3 days');
      } else if (days <= 14) {
        confidence += 5;
        reasons.push('date within 14 days');
      }
    }

    // Cap and floor
    confidence = Math.min(99, confidence);
    if (confidence >= 35) {
      suggestions.push({
        kind: 'invoice',
        confidence,
        invoice_id: inv.id,
        invoice_number: inv.invoice_number || null,
        direction: String(inv.direction || expectedDir),
        counterparty: inv.counterparty_name || null,
        amount: balance,
        reason: reasons.join('; '),
      });
    }
  }

  // ── Company rules (priority order) ────────────────────────────────────────
  const activeRules = [...rules]
    .filter((r) => r.is_active !== false)
    .sort((a, b) => (a.priority || 100) - (b.priority || 100));

  for (const rule of activeRules) {
    const pattern = String(rule.pattern || '');
    if (!pattern) continue;
    let hit = false;
    const mt = String(rule.match_type || 'description_contains');

    if (mt === 'description_contains') {
      hit = hayNorm.includes(norm(pattern));
    } else if (mt === 'reference_equals') {
      hit = norm(ref) === norm(pattern);
    } else if (mt === 'amount_equals') {
      const p = Number(pattern);
      hit = Number.isFinite(p) && amountClose(amount, p);
    } else if (mt === 'description_regex') {
      try {
        hit = new RegExp(pattern, 'i').test(hay);
      } catch {
        hit = false;
      }
    }

    if (!hit) continue;

    if (rule.target_type === 'exclude') {
      suggestions.push({
        kind: 'exclude',
        confidence: 88,
        reason: `Rule: ${rule.name}`,
        rule_id: rule.id,
      });
      break;
    }
    if (rule.target_type === 'gl_account' && rule.target_id) {
      const acc = coa.find((c) => Number(c.id) === Number(rule.target_id));
      suggestions.push({
        kind: 'gl',
        confidence: 85,
        gl_account_id: Number(rule.target_id),
        gl_code: acc?.code || null,
        gl_name: acc?.name || null,
        reason: `Rule: ${rule.name}`,
        rule_id: rule.id,
      });
      break;
    }
  }

  // ── Keyword heuristics (if no high GL rule yet) ───────────────────────────
  const hasStrongGl = suggestions.some((s) => s.kind === 'gl' && s.confidence >= 80);
  if (!hasStrongGl) {
    for (const kr of DEFAULT_ALLOC_RULES) {
      if (!kr.pattern.test(hay)) continue;
      // Prefer income rules for inflows
      if (kr.preferIncome && !isInflow) continue;
      if (!kr.preferIncome && isInflow && !kr.preferIncome) {
        // allow fee-like income side later
      }

      let acc: CoaAccount | undefined;
      for (const code of kr.codes) {
        acc = coa.find((c) => c.code === code && !c.is_header);
        if (acc) break;
      }
      if (!acc) {
        for (const hint of kr.nameHints) {
          acc = coa.find(
            (c) =>
              !c.is_header &&
              String(c.name || '')
                .toLowerCase()
                .includes(hint) &&
              (isInflow
                ? c.account_type === 'revenue'
                : ['expense', 'cogs'].includes(String(c.account_type)))
          );
          if (acc) break;
        }
      }
      if (!acc) continue;

      suggestions.push({
        kind: 'gl',
        confidence: 55,
        gl_account_id: Number(acc.id),
        gl_code: acc.code,
        gl_name: acc.name,
        reason: `Keyword heuristic (${kr.pattern.source.slice(0, 40)})`,
        rule_id: null,
      });
      break;
    }
  }

  // Sort: highest confidence first; prefer invoice over gl at same score
  suggestions.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    const rank = (k: string) => (k === 'invoice' ? 0 : k === 'exclude' ? 1 : 2);
    return rank(a.kind) - rank(b.kind);
  });

  return suggestions.slice(0, 5);
}

export type AutoMatchOptions = {
  companyId: number;
  privyUserId?: string | null;
  bankAccountId?: number | null;
  /** Only apply when confidence >= this (default 80) */
  minConfidence?: number;
  /** Preview only */
  dryRun?: boolean;
  /** Max lines to process */
  limit?: number;
  txnIds?: Array<string | number>;
};

export type AutoMatchResult = {
  scanned: number;
  applied: number;
  suggested: number;
  skipped: number;
  errors: number;
  results: Array<{
    bank_transaction_id: string | number;
    applied: boolean;
    action?: string;
    confidence?: number;
    detail?: string;
    error?: string;
    suggestions?: MatchSuggestion[];
  }>;
};

export async function runAutoMatch(opts: AutoMatchOptions): Promise<AutoMatchResult> {
  const supabase = getSupabaseServer();
  const minConf = opts.minConfidence ?? 80;
  const limit = Math.min(500, opts.limit || 200);
  const dryRun = !!opts.dryRun;

  let tq = supabase
    .from('bank_transactions')
    .select(
      'id, amount, description, reference, counterparty_name, txn_date, tx_date, allocation_status, bank_account_id'
    )
    .eq('profile_id', opts.companyId)
    .or('allocation_status.eq.unallocated,allocation_status.is.null')
    .order('txn_date', { ascending: false })
    .limit(limit);

  if (opts.bankAccountId) tq = tq.eq('bank_account_id', opts.bankAccountId);
  if (opts.txnIds?.length) tq = tq.in('id', opts.txnIds as (string | number)[]);

  const { data: rawTxns } = await tq;
  const txns: BankTxnLite[] = (rawTxns || []).map((t) => ({
    id: t.id,
    amount: Number(t.amount || 0),
    description: t.description,
    reference: t.reference,
    counterparty_name: t.counterparty_name,
    txn_date:
      (t.txn_date as string) ||
      (t.tx_date ? String(t.tx_date).slice(0, 10) : null),
    allocation_status: t.allocation_status,
  }));

  const { data: invRows } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, direction, counterparty_name, total_amount, amount_paid, status, invoice_date, due_date'
    )
    .eq('profile_id', opts.companyId)
    .in('status', ['sent', 'partial', 'overdue', 'open', 'issued']);

  // Also pull non-paid if status filter too strict
  let invoices: InvoiceLite[] = invRows || [];
  if (!invoices.length) {
    const { data: allInv } = await supabase
      .from('invoices')
      .select(
        'id, invoice_number, direction, counterparty_name, total_amount, amount_paid, status, invoice_date, due_date'
      )
      .eq('profile_id', opts.companyId)
      .limit(500);
    invoices = (allInv || []).filter(
      (i) => !['paid', 'void', 'cancelled', 'draft'].includes(String(i.status || '').toLowerCase())
    );
  }

  const { data: rules } = await supabase
    .from('bank_match_rules')
    .select('*')
    .eq('profile_id', opts.companyId)
    .eq('is_active', true)
    .order('priority', { ascending: true });

  const { data: coaRows } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, account_type, is_header, is_active')
    .eq('profile_id', opts.companyId)
    .eq('is_active', true);

  const coa = (coaRows || []) as CoaAccount[];
  const ruleRows = (rules || []) as MatchRuleRow[];

  const result: AutoMatchResult = {
    scanned: txns.length,
    applied: 0,
    suggested: 0,
    skipped: 0,
    errors: 0,
    results: [],
  };

  // Track invoices already claimed in this run
  const claimedInvoices = new Set<number>();

  for (const txn of txns) {
    let suggestions = scoreBankTransaction(txn, invoices, ruleRows, coa);
    // Drop invoice suggestions already claimed
    suggestions = suggestions.filter(
      (s) => s.kind !== 'invoice' || !claimedInvoices.has(s.invoice_id)
    );

    const best = suggestions[0];
    if (!best || best.confidence < 35) {
      result.skipped++;
      result.results.push({
        bank_transaction_id: txn.id,
        applied: false,
        detail: 'No confident match',
        suggestions,
      });
      continue;
    }

    result.suggested++;

    // Persist top suggestion on metadata for UI even in dry-run
    if (!dryRun) {
      await supabase
        .from('bank_transactions')
        .update({
          metadata: {
            match_suggestions: suggestions,
            match_best: best,
            match_scored_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', txn.id)
        .eq('profile_id', opts.companyId);
    }

    if (best.confidence < minConf) {
      result.results.push({
        bank_transaction_id: txn.id,
        applied: false,
        confidence: best.confidence,
        detail: `Below threshold (${minConf}): ${best.kind} — ${'reason' in best ? best.reason : ''}`,
        suggestions,
      });
      continue;
    }

    if (dryRun) {
      result.results.push({
        bank_transaction_id: txn.id,
        applied: false,
        action: `would_${best.kind}`,
        confidence: best.confidence,
        detail: best.kind === 'invoice'
          ? `Match invoice ${best.invoice_number || best.invoice_id}`
          : best.kind === 'gl'
            ? `Allocate to ${best.gl_code || best.gl_account_id} ${best.gl_name || ''}`
            : 'Exclude',
        suggestions,
      });
      continue;
    }

    // Apply
    try {
      if (best.kind === 'invoice') {
        const m = await matchBankToInvoice({
          profileId: opts.companyId,
          bankTxnId: txn.id,
          invoiceId: best.invoice_id,
          privyUserId: opts.privyUserId,
        });
        if (!m.ok) {
          result.errors++;
          result.results.push({
            bank_transaction_id: txn.id,
            applied: false,
            confidence: best.confidence,
            error: m.error,
            suggestions,
          });
          continue;
        }
        claimedInvoices.add(best.invoice_id);
        result.applied++;
        result.results.push({
          bank_transaction_id: txn.id,
          applied: true,
          action: 'match_invoice',
          confidence: best.confidence,
          detail: `Matched ${best.invoice_number || best.invoice_id}`,
          suggestions,
        });
      } else if (best.kind === 'gl') {
        const a = await allocateBankTransaction({
          profileId: opts.companyId,
          bankTxnId: txn.id,
          glAccountId: best.gl_account_id,
          privyUserId: opts.privyUserId,
          memo: `Auto-match: ${best.reason}`,
          markReconciled: true,
        });
        if (!a.ok) {
          result.errors++;
          result.results.push({
            bank_transaction_id: txn.id,
            applied: false,
            confidence: best.confidence,
            error: a.error,
            suggestions,
          });
          continue;
        }
        result.applied++;
        result.results.push({
          bank_transaction_id: txn.id,
          applied: true,
          action: 'allocate',
          confidence: best.confidence,
          detail: `Allocated to ${best.gl_code || best.gl_account_id}`,
          suggestions,
        });
      } else if (best.kind === 'exclude') {
        await supabase
          .from('bank_transactions')
          .update({
            allocation_status: 'excluded',
            status: 'excluded',
            notes: `Auto-match: ${best.reason}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', txn.id)
          .eq('profile_id', opts.companyId);
        result.applied++;
        result.results.push({
          bank_transaction_id: txn.id,
          applied: true,
          action: 'exclude',
          confidence: best.confidence,
          detail: best.reason,
          suggestions,
        });
      }
    } catch (e) {
      result.errors++;
      result.results.push({
        bank_transaction_id: txn.id,
        applied: false,
        error: e instanceof Error ? e.message : 'Apply failed',
        suggestions,
      });
    }
  }

  return result;
}

/** Seed a few useful default rules for a company (idempotent by name). */
export async function seedDefaultMatchRules(companyId: number): Promise<number> {
  const supabase = getSupabaseServer();
  const defaults = [
    {
      name: 'Bank service fees',
      match_type: 'description_contains',
      pattern: 'service fee',
      target_type: 'gl_account',
      priority: 10,
      target_value: 'bank_charges',
    },
    {
      name: 'Monthly service fee',
      match_type: 'description_contains',
      pattern: 'monthly service',
      target_type: 'gl_account',
      priority: 10,
      target_value: 'bank_charges',
    },
    {
      name: 'Interest earned',
      match_type: 'description_contains',
      pattern: 'interest',
      target_type: 'gl_account',
      priority: 20,
      target_value: 'interest_income',
    },
    {
      name: 'Ignore zero / reverse',
      match_type: 'description_contains',
      pattern: 'reversal',
      target_type: 'exclude',
      priority: 50,
    },
  ];

  // Resolve GL targets by code/name hints
  const { data: coa } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, account_type')
    .eq('profile_id', companyId)
    .eq('is_active', true);

  const resolve = (key: string): number | null => {
    const rows = coa || [];
    if (key === 'bank_charges') {
      const a =
        rows.find((r) => r.code === '6800') ||
        rows.find((r) => /bank\s*charge|bank\s*fee|finance\s*cost/i.test(String(r.name)));
      return a ? Number(a.id) : null;
    }
    if (key === 'interest_income') {
      const a =
        rows.find((r) => r.code === '4200' || r.code === '4900') ||
        rows.find((r) => /interest/i.test(String(r.name)) && r.account_type === 'revenue');
      return a ? Number(a.id) : null;
    }
    return null;
  };

  const { data: existing } = await supabase
    .from('bank_match_rules')
    .select('name')
    .eq('profile_id', companyId);
  const names = new Set((existing || []).map((r) => String(r.name)));

  let inserted = 0;
  for (const d of defaults) {
    if (names.has(d.name)) continue;
    const target_id =
      d.target_type === 'gl_account' && d.target_value
        ? resolve(d.target_value)
        : null;
    if (d.target_type === 'gl_account' && !target_id) continue;

    const { error } = await supabase.from('bank_match_rules').insert({
      profile_id: companyId,
      name: d.name,
      match_type: d.match_type,
      pattern: d.pattern,
      target_type: d.target_type,
      target_id,
      target_value: d.target_value || null,
      priority: d.priority,
      is_active: true,
    });
    if (!error) inserted++;
  }
  return inserted;
}
