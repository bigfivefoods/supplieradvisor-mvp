/**
 * Soft credit-limit checks for commercial documents.
 */
import type { getSupabaseServer } from '@/lib/supabase/server-client';

const OPEN = [
  'sent',
  'partial',
  'overdue',
  'viewed',
  'unpaid',
  'issued',
  'draft',
] as const;

export type CreditCheckResult =
  | { ok: true; creditLimit: number | null; openBalance: number; projected: number }
  | {
      ok: false;
      code: 'OVER_CREDIT_LIMIT';
      creditLimit: number;
      openBalance: number;
      projected: number;
      overBy: number;
      customerName: string | null;
    };

export async function checkCustomerCreditLimit(
  supabase: ReturnType<typeof getSupabaseServer>,
  opts: {
    companyId: number;
    customerId: number;
    /** Amount of the new document (or conversion delta) */
    additionalAmount: number;
  }
): Promise<CreditCheckResult> {
  const { data: cust } = await supabase
    .from('customers')
    .select('id, trading_name, legal_name, credit_limit')
    .eq('id', opts.customerId)
    .eq('profile_id', opts.companyId)
    .maybeSingle();

  const limit = Number(cust?.credit_limit);
  if (!Number.isFinite(limit) || limit <= 0) {
    return {
      ok: true,
      creditLimit: null,
      openBalance: 0,
      projected: opts.additionalAmount,
    };
  }

  // Open AR across invoices
  const { data: invs } = await supabase
    .from('customer_invoices')
    .select('total_amount, amount_paid, status')
    .eq('profile_id', opts.companyId)
    .eq('customer_id', opts.customerId)
    .in('status', [...OPEN])
    .limit(400);

  let openBalance = 0;
  for (const inv of invs || []) {
    const st = String(inv.status || '').toLowerCase();
    if (st === 'void' || st === 'cancelled' || st === 'paid') continue;
    openBalance += Math.max(
      0,
      Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)
    );
  }

  const projected = openBalance + Math.max(0, opts.additionalAmount);
  if (projected <= limit + 0.01) {
    return { ok: true, creditLimit: limit, openBalance, projected };
  }

  return {
    ok: false,
    code: 'OVER_CREDIT_LIMIT',
    creditLimit: limit,
    openBalance,
    projected,
    overBy: Math.round((projected - limit) * 100) / 100,
    customerName:
      cust?.trading_name || cust?.legal_name
        ? String(cust.trading_name || cust.legal_name)
        : null,
  };
}
