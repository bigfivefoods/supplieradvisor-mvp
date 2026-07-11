/**
 * Counterparty learning — learn GL / invoice patterns from past allocations
 * so auto-match improves without manual rules for every merchant.
 */

import { getSupabaseServer } from '@/lib/supabase/server-client';
import { normalizeMerchantKey } from '@/lib/accounting/mass-allocate';

export type LearnedPattern = {
  merchant_key: string;
  gl_account_id: number | null;
  invoice_counterparty: string | null;
  hits: number;
  last_amount?: number;
  sample_description?: string;
};

function merchantKeyFromTxn(description: string | null | undefined, counterparty?: string | null): string {
  if (counterparty && String(counterparty).trim().length > 2) {
    return normalizeMerchantKey(String(counterparty));
  }
  return normalizeMerchantKey(description);
}

/**
 * Build a map of merchant_key → preferred GL from historical allocated rows.
 */
export async function loadLearnedPatterns(companyId: number): Promise<Map<string, LearnedPattern>> {
  const supabase = getSupabaseServer();
  const { data: rows } = await supabase
    .from('bank_transactions')
    .select(
      'description, counterparty_name, gl_account_id, amount, allocation_status, matched_invoice_id'
    )
    .eq('profile_id', companyId)
    .in('allocation_status', ['allocated', 'matched_invoice'])
    .not('gl_account_id', 'is', null)
    .order('allocated_at', { ascending: false })
    .limit(800);

  const map = new Map<string, LearnedPattern>();

  for (const r of rows || []) {
    const key = merchantKeyFromTxn(r.description, r.counterparty_name);
    if (!key || key === 'other') continue;
    const gl = r.gl_account_id != null ? Number(r.gl_account_id) : null;
    if (!gl) continue;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        merchant_key: key,
        gl_account_id: gl,
        invoice_counterparty: r.counterparty_name || null,
        hits: 1,
        last_amount: Number(r.amount || 0),
        sample_description: String(r.description || '').slice(0, 120),
      });
    } else if (existing.gl_account_id === gl) {
      existing.hits += 1;
      existing.last_amount = Number(r.amount || 0);
    } else {
      // Conflicting GL — prefer higher hits; if tie, keep existing
      // Track alternate by reducing confidence later via lower hits
      existing.hits = Math.max(0, existing.hits - 1);
    }
  }

  // Also learn pure counterparty → gl from matched invoices' names
  const { data: matched } = await supabase
    .from('bank_transactions')
    .select('description, counterparty_name, amount, allocation_status')
    .eq('profile_id', companyId)
    .eq('allocation_status', 'matched_invoice')
    .limit(300);

  for (const r of matched || []) {
    const key = merchantKeyFromTxn(r.description, r.counterparty_name);
    if (!key || key === 'other') continue;
    if (!map.has(key)) {
      map.set(key, {
        merchant_key: key,
        gl_account_id: null,
        invoice_counterparty: r.counterparty_name || null,
        hits: 1,
        last_amount: Number(r.amount || 0),
        sample_description: String(r.description || '').slice(0, 120),
      });
    } else {
      const e = map.get(key)!;
      e.hits += 1;
      if (!e.invoice_counterparty && r.counterparty_name) {
        e.invoice_counterparty = r.counterparty_name;
      }
    }
  }

  return map;
}

export function learningBoost(
  description: string | null | undefined,
  counterparty: string | null | undefined,
  learned: Map<string, LearnedPattern>
): {
  gl_account_id: number | null;
  confidence: number;
  reason: string;
  hits: number;
} | null {
  const key = merchantKeyFromTxn(description, counterparty);
  if (!key || key === 'other') return null;
  const pat = learned.get(key);
  if (!pat || !pat.gl_account_id) return null;
  if (pat.hits < 2) {
    // single observation — weak signal
    return {
      gl_account_id: pat.gl_account_id,
      confidence: 48,
      reason: `Learned once from “${pat.sample_description || key}”`,
      hits: pat.hits,
    };
  }
  // 2+ consistent allocations
  const confidence = Math.min(82, 58 + pat.hits * 4);
  return {
    gl_account_id: pat.gl_account_id,
    confidence,
    reason: `Learned from ${pat.hits} past allocations (${key})`,
    hits: pat.hits,
  };
}

export { merchantKeyFromTxn };
