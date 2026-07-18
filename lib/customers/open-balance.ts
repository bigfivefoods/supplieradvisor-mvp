/**
 * Open AR balance helpers — prefer ledger sum when available.
 */

import { getSupabaseServer } from '@/lib/supabase/server-client';
import { sumLedgerPaid } from '@/lib/customers/ar-ledger';

const OPEN = [
  'sent',
  'partial',
  'overdue',
  'viewed',
  'unpaid',
  'issued',
  'draft',
] as const;

export function balanceFromInvoice(inv: {
  total_amount?: number | null;
  amount_paid?: number | null;
  status?: string | null;
}): number {
  const st = String(inv.status || '').toLowerCase();
  if (st === 'paid' || st === 'void' || st === 'cancelled') return 0;
  return Math.max(
    0,
    Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)
  );
}

/** Invoice open balance; if ledger has rows, use max(invoice rollup, ledger-derived). */
export async function invoiceOpenBalance(
  profileId: number,
  invoice: {
    id: number;
    total_amount?: number | null;
    amount_paid?: number | null;
    status?: string | null;
  }
): Promise<{ balance: number; amountPaid: number; fromLedger: boolean }> {
  const total = Number(invoice.total_amount || 0);
  let amountPaid = Number(invoice.amount_paid || 0);
  let fromLedger = false;
  try {
    const sum = await sumLedgerPaid(profileId, Number(invoice.id));
    if (sum.total != null && !sum.tableMissing) {
      // Prefer ledger as source of truth when present
      amountPaid = Math.max(amountPaid, sum.total);
      fromLedger = true;
    }
  } catch {
    /* soft */
  }
  const st = String(invoice.status || '').toLowerCase();
  if (st === 'paid' || st === 'void' || st === 'cancelled') {
    return { balance: 0, amountPaid, fromLedger };
  }
  return {
    balance: Math.max(0, total - amountPaid),
    amountPaid,
    fromLedger,
  };
}

/** Sum open AR for a customer (ledger-aware per invoice). */
export async function customerOpenBalance(
  companyId: number,
  customerId: number
): Promise<{ openBalance: number; invoiceCount: number; fromLedger: boolean }> {
  const supabase = getSupabaseServer();
  const { data: invs } = await supabase
    .from('customer_invoices')
    .select('id, total_amount, amount_paid, status')
    .eq('profile_id', companyId)
    .eq('customer_id', customerId)
    .in('status', [...OPEN])
    .limit(400);

  let openBalance = 0;
  let fromLedger = false;
  let invoiceCount = 0;
  for (const inv of invs || []) {
    const st = String(inv.status || '').toLowerCase();
    if (st === 'void' || st === 'cancelled' || st === 'paid') continue;
    const b = await invoiceOpenBalance(companyId, inv as {
      id: number;
      total_amount?: number | null;
      amount_paid?: number | null;
      status?: string | null;
    });
    if (b.balance <= 0.009) continue;
    openBalance += b.balance;
    invoiceCount += 1;
    if (b.fromLedger) fromLedger = true;
  }
  return {
    openBalance: Math.round(openBalance * 100) / 100,
    invoiceCount,
    fromLedger,
  };
}
