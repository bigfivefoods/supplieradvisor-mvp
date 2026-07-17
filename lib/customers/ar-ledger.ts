/**
 * First-class AR payment ledger helpers.
 * Table: customer_invoice_payments (migration 20260717_ar_ledger.sql).
 * Soft-fails when table missing so mark_paid notes path still works.
 */

import { getSupabaseServer } from '@/lib/supabase/server-client';

export type ArLedgerEntry = {
  id?: number;
  profile_id: number;
  invoice_id: number;
  customer_id?: number | null;
  amount: number;
  currency: string;
  paid_at: string;
  method?: string | null;
  reference?: string | null;
  proof_url?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string;
};

export function isMissingLedgerTable(msg: string | undefined | null): boolean {
  return /relation|does not exist|schema cache|customer_invoice_payments/i.test(
    msg || ''
  );
}

/** Insert a payment row; returns null if table missing. */
export async function recordArPayment(
  entry: Omit<ArLedgerEntry, 'id' | 'created_at'>
): Promise<{ ok: true; entry: ArLedgerEntry | null; tableMissing?: boolean } | {
  ok: false;
  error: string;
  tableMissing?: boolean;
}> {
  try {
    const supabase = getSupabaseServer();
    const row = {
      profile_id: entry.profile_id,
      invoice_id: entry.invoice_id,
      customer_id: entry.customer_id ?? null,
      amount: entry.amount,
      currency: entry.currency || 'ZAR',
      paid_at: entry.paid_at || new Date().toISOString(),
      method: entry.method || 'manual',
      reference: entry.reference || null,
      proof_url: entry.proof_url || null,
      notes: entry.notes || null,
      created_by: entry.created_by || null,
    };
    const { data, error } = await supabase
      .from('customer_invoice_payments')
      .insert(row)
      .select('*')
      .maybeSingle();
    if (error) {
      if (isMissingLedgerTable(error.message)) {
        return { ok: true, entry: null, tableMissing: true };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, entry: data as ArLedgerEntry };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'ledger error';
    if (isMissingLedgerTable(msg)) {
      return { ok: true, entry: null, tableMissing: true };
    }
    return { ok: false, error: msg };
  }
}

/** Sum ledger payments for an invoice (null if table missing). */
export async function sumLedgerPaid(
  profileId: number,
  invoiceId: number
): Promise<{ total: number | null; tableMissing: boolean }> {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('customer_invoice_payments')
      .select('amount')
      .eq('profile_id', profileId)
      .eq('invoice_id', invoiceId);
    if (error) {
      if (isMissingLedgerTable(error.message)) {
        return { total: null, tableMissing: true };
      }
      return { total: null, tableMissing: false };
    }
    const total = (data || []).reduce(
      (s, r) => s + Number((r as { amount?: number }).amount || 0),
      0
    );
    return { total, tableMissing: false };
  } catch {
    return { total: null, tableMissing: true };
  }
}

export async function listLedgerForInvoice(
  profileId: number,
  invoiceId: number,
  limit = 50
): Promise<{ entries: ArLedgerEntry[]; tableMissing: boolean }> {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('customer_invoice_payments')
      .select('*')
      .eq('profile_id', profileId)
      .eq('invoice_id', invoiceId)
      .order('paid_at', { ascending: false })
      .limit(limit);
    if (error) {
      return {
        entries: [],
        tableMissing: isMissingLedgerTable(error.message),
      };
    }
    return { entries: (data || []) as ArLedgerEntry[], tableMissing: false };
  } catch {
    return { entries: [], tableMissing: true };
  }
}

export async function listLedgerForCompany(
  profileId: number,
  opts?: { customerId?: number; limit?: number }
): Promise<{ entries: ArLedgerEntry[]; tableMissing: boolean }> {
  try {
    const supabase = getSupabaseServer();
    let q = supabase
      .from('customer_invoice_payments')
      .select('*')
      .eq('profile_id', profileId)
      .order('paid_at', { ascending: false })
      .limit(opts?.limit || 100);
    if (opts?.customerId) {
      q = q.eq('customer_id', opts.customerId);
    }
    const { data, error } = await q;
    if (error) {
      return {
        entries: [],
        tableMissing: isMissingLedgerTable(error.message),
      };
    }
    return { entries: (data || []) as ArLedgerEntry[], tableMissing: false };
  } catch {
    return { entries: [], tableMissing: true };
  }
}
