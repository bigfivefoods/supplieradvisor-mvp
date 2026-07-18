/**
 * Soft-link a bank transaction to an invoice after claim confirm.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';

export async function applyBankMatchToInvoice(opts: {
  profileId: number;
  bankTxnId: number | string;
  invoiceId: number;
  actorUserId?: string;
}): Promise<{ ok: boolean; error?: string; bankTxnId?: string | number }> {
  try {
    const supabase = getSupabaseServer();
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      allocation_status: 'allocated',
      allocated: true,
      is_allocated: true,
      invoice_id: opts.invoiceId,
      matched_invoice_id: opts.invoiceId,
      updated_at: now,
    };

    let { error } = await supabase
      .from('bank_transactions')
      .update(updates)
      .eq('id', opts.bankTxnId)
      .eq('profile_id', opts.profileId);

    if (error && /column|schema cache/i.test(error.message || '')) {
      const soft: Record<string, unknown> = {
        allocation_status: 'allocated',
        updated_at: now,
      };
      const retry = await supabase
        .from('bank_transactions')
        .update(soft)
        .eq('id', opts.bankTxnId)
        .eq('profile_id', opts.profileId);
      error = retry.error;
    }

    if (error) return { ok: false, error: error.message };

    try {
      await supabase.from('activity_log').insert({
        profile_id: opts.profileId,
        actor_user_id: opts.actorUserId || 'system',
        action: 'banking.claim_auto_match',
        entity_type: 'bank_transactions',
        entity_id: String(opts.bankTxnId),
        summary: `Auto-matched bank txn to invoice #${opts.invoiceId} after claim confirm`,
        metadata: {
          bankTxnId: opts.bankTxnId,
          invoiceId: opts.invoiceId,
        },
      });
    } catch {
      /* soft */
    }

    // Learn counterparty → invoice pattern for future auto-match
    try {
      const { data: txn } = await supabase
        .from('bank_transactions')
        .select('description, reference, counterparty_name, amount')
        .eq('id', opts.bankTxnId)
        .eq('profile_id', opts.profileId)
        .maybeSingle();
      if (txn) {
        const key = String(
          txn.counterparty_name || txn.reference || txn.description || ''
        )
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .slice(0, 80);
        if (key.length > 3) {
          await supabase.from('activity_log').insert({
            profile_id: opts.profileId,
            actor_user_id: opts.actorUserId || 'system',
            action: 'banking.match_learned',
            entity_type: 'customer_invoices',
            entity_id: String(opts.invoiceId),
            summary: `Learned bank pattern → inv #${opts.invoiceId}`,
            metadata: {
              pattern: key,
              invoiceId: opts.invoiceId,
              amount: txn.amount,
            },
          });
        }
      }
    } catch {
      /* soft */
    }

    return { ok: true, bankTxnId: opts.bankTxnId };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'match failed',
    };
  }
}
