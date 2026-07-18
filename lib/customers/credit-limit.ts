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
  | { ok: true; creditLimit: number | null; openBalance: number; projected: number; creditHold?: boolean }
  | {
      ok: false;
      code: 'OVER_CREDIT_LIMIT' | 'CREDIT_HOLD';
      creditLimit: number;
      openBalance: number;
      projected: number;
      overBy: number;
      customerName: string | null;
      creditHold?: boolean;
      overrideCount?: number;
    };

const OVERRIDE_HOLD_THRESHOLD = 3;

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
    .select('id, trading_name, legal_name, credit_limit, notes, status')
    .eq('id', opts.customerId)
    .eq('profile_id', opts.companyId)
    .maybeSingle();

  const notes = cust?.notes != null ? String(cust.notes) : '';
  const creditHold =
    /\[credit hold\]/i.test(notes) ||
    String(cust?.status || '').toLowerCase() === 'credit_hold';
  const overrideMatch = notes.match(/\[credit overrides:(\d+)\]/i);
  const overrideCount = overrideMatch ? Number(overrideMatch[1]) : 0;

  const limit = Number(cust?.credit_limit);
  if (creditHold) {
    return {
      ok: false,
      code: 'CREDIT_HOLD',
      creditLimit: Number.isFinite(limit) ? limit : 0,
      openBalance: 0,
      projected: opts.additionalAmount,
      overBy: 0,
      customerName:
        cust?.trading_name || cust?.legal_name
          ? String(cust.trading_name || cust.legal_name)
          : null,
      creditHold: true,
      overrideCount,
    };
  }

  if (!Number.isFinite(limit) || limit <= 0) {
    return {
      ok: true,
      creditLimit: null,
      openBalance: 0,
      projected: opts.additionalAmount,
    };
  }

  // Open AR — ledger-aware when customer_invoice_payments exists
  let openBalance = 0;
  try {
    const { customerOpenBalance } = await import(
      '@/lib/customers/open-balance'
    );
    const ar = await customerOpenBalance(opts.companyId, opts.customerId);
    openBalance = ar.openBalance;
  } catch {
    const { data: invs } = await supabase
      .from('customer_invoices')
      .select('total_amount, amount_paid, status')
      .eq('profile_id', opts.companyId)
      .eq('customer_id', opts.customerId)
      .in('status', [...OPEN])
      .limit(400);

    for (const inv of invs || []) {
      const st = String(inv.status || '').toLowerCase();
      if (st === 'void' || st === 'cancelled' || st === 'paid') continue;
      openBalance += Math.max(
        0,
        Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)
      );
    }
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
    overrideCount,
  };
}

/** Record a credit override; auto credit-hold after threshold. */
export async function recordCreditOverride(
  supabase: ReturnType<typeof getSupabaseServer>,
  opts: { companyId: number; customerId: number }
): Promise<{ overrideCount: number; creditHold: boolean }> {
  const { data: cust } = await supabase
    .from('customers')
    .select('id, notes')
    .eq('id', opts.customerId)
    .eq('profile_id', opts.companyId)
    .maybeSingle();
  if (!cust) return { overrideCount: 0, creditHold: false };

  let notes = cust.notes != null ? String(cust.notes) : '';
  const m = notes.match(/\[credit overrides:(\d+)\]/i);
  const next = (m ? Number(m[1]) : 0) + 1;
  if (m) {
    notes = notes.replace(
      /\[credit overrides:\d+\]/i,
      `[credit overrides:${next}]`
    );
  } else {
    notes = notes
      ? `${notes}\n[credit overrides:${next}]`
      : `[credit overrides:${next}]`;
  }
  let creditHold = next >= OVERRIDE_HOLD_THRESHOLD;
  if (creditHold && !/\[credit hold\]/i.test(notes)) {
    notes = `${notes}\n[credit hold] auto after ${next} overrides ${new Date().toISOString().slice(0, 10)}`;
  }
  await supabase
    .from('customers')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', opts.customerId)
    .eq('profile_id', opts.companyId);
  return { overrideCount: next, creditHold };
}
