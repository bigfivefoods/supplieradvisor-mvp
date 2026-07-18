/**
 * Suggest unallocated bank inflows that match a confirmed payment claim.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';

export type BankClaimSuggestion = {
  bankTxnId: number | string;
  amount: number;
  description: string | null;
  reference: string | null;
  txnDate: string | null;
  confidence: number;
  reason: string;
};

export async function suggestBankMatchesForPayment(opts: {
  profileId: number;
  amount: number;
  reference?: string | null;
  invoiceNumber?: string | null;
  paidAt?: string | null;
  limit?: number;
}): Promise<BankClaimSuggestion[]> {
  try {
    const supabase = getSupabaseServer();

    // Learned patterns from prior claim auto-matches
    const learned: string[] = [];
    try {
      const since = new Date(Date.now() - 180 * 86400000).toISOString();
      const { data: learnedRows } = await supabase
        .from('activity_log')
        .select('metadata')
        .eq('profile_id', opts.profileId)
        .eq('action', 'banking.match_learned')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(40);
      for (const row of learnedRows || []) {
        const meta =
          row.metadata && typeof row.metadata === 'object'
            ? (row.metadata as Record<string, unknown>)
            : {};
        const p = String(meta.pattern || '')
          .toLowerCase()
          .trim();
        if (p.length > 3) learned.push(p);
      }
    } catch {
      /* soft */
    }

    const { data: txns } = await supabase
      .from('bank_transactions')
      .select(
        'id, amount, description, reference, counterparty_name, txn_date, tx_date, allocation_status'
      )
      .eq('profile_id', opts.profileId)
      .or('allocation_status.eq.unallocated,allocation_status.is.null')
      .gt('amount', 0)
      .order('txn_date', { ascending: false })
      .limit(80);

    const target = Math.abs(Number(opts.amount));
    const ref = String(opts.reference || '')
      .toLowerCase()
      .trim();
    const invNum = String(opts.invoiceNumber || '')
      .toLowerCase()
      .replace(/\s/g, '');
    const out: BankClaimSuggestion[] = [];

    for (const t of txns || []) {
      const amt = Math.abs(Number(t.amount || 0));
      if (amt <= 0) continue;
      let confidence = 0;
      const reasons: string[] = [];
      const hay = `${t.description || ''} ${t.reference || ''} ${
        t.counterparty_name || ''
      }`.toLowerCase();

      if (Math.abs(amt - target) <= 0.02) {
        confidence += 50;
        reasons.push('amount matches claim');
      } else if (Math.abs(amt - target) / Math.max(target, 1) < 0.05) {
        confidence += 25;
        reasons.push('amount within 5%');
      } else {
        continue;
      }

      if (ref && (hay.includes(ref) || String(t.reference || '').toLowerCase() === ref)) {
        confidence += 35;
        reasons.push('reference match');
      }
      if (invNum && hay.replace(/\s/g, '').includes(invNum)) {
        confidence += 25;
        reasons.push('invoice number in description');
      }

      // Learned counterparty / description patterns
      for (const p of learned) {
        if (p.length >= 4 && hay.includes(p)) {
          confidence += 20;
          reasons.push('learned pattern');
          break;
        }
      }

      const txnDate =
        (t.txn_date as string) ||
        (t.tx_date ? String(t.tx_date).slice(0, 10) : null);
      if (opts.paidAt && txnDate) {
        const days = Math.abs(
          (Date.parse(String(opts.paidAt).slice(0, 10)) -
            Date.parse(txnDate.slice(0, 10))) /
            86400000
        );
        if (days <= 3) {
          confidence += 10;
          reasons.push('date within 3 days');
        }
      }

      if (confidence >= 50) {
        out.push({
          bankTxnId: t.id,
          amount: amt,
          description: t.description ? String(t.description) : null,
          reference: t.reference ? String(t.reference) : null,
          txnDate,
          confidence: Math.min(99, confidence),
          reason: reasons.join('; '),
        });
      }
    }

    out.sort((a, b) => b.confidence - a.confidence);
    return out.slice(0, opts.limit || 5);
  } catch {
    return [];
  }
}
