import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';

const OPEN = [
  'sent',
  'partial',
  'overdue',
  'viewed',
  'unpaid',
  'issued',
] as const;

/**
 * GET ?companyId= — AR rollup by customer (open balances + broken promises).
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const today = new Date().toISOString().slice(0, 10);

    let { data, error } = await supabase
      .from('customer_invoices')
      .select(
        'id, customer_id, customer_name, invoice_number, status, total_amount, amount_paid, currency, due_date, promise_to_pay_date'
      )
      .eq('profile_id', companyId)
      .in('status', [...OPEN])
      .limit(500);

    if (error && /promise_to_pay|column|schema cache/i.test(error.message || '')) {
      const retry = await supabase
        .from('customer_invoices')
        .select(
          'id, customer_id, customer_name, invoice_number, status, total_amount, amount_paid, currency, due_date'
        )
        .eq('profile_id', companyId)
        .in('status', [...OPEN])
        .limit(500);
      data = retry.data as typeof data;
      error = retry.error;
    }
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type Rollup = {
      customerId: number | null;
      customerName: string;
      invoiceCount: number;
      openBalance: number;
      overdueCount: number;
      partialCount: number;
      brokenPromiseCount: number;
      promiseDueCount: number;
      currency: string;
      invoiceIds: number[];
    };

    const byKey = new Map<string, Rollup>();
    let openTotal = 0;
    let brokenTotal = 0;

    for (const inv of data || []) {
      const total = Number(inv.total_amount || 0);
      const paid = Number(inv.amount_paid || 0);
      const balance = Math.max(0, total - paid);
      if (balance <= 0.009) continue;

      const cid =
        inv.customer_id != null && Number(inv.customer_id) > 0
          ? Number(inv.customer_id)
          : null;
      const name = String(inv.customer_name || 'Unknown customer').trim() || 'Unknown';
      const key = cid != null ? `id:${cid}` : `name:${name.toLowerCase()}`;
      let row = byKey.get(key);
      if (!row) {
        row = {
          customerId: cid,
          customerName: name,
          invoiceCount: 0,
          openBalance: 0,
          overdueCount: 0,
          partialCount: 0,
          brokenPromiseCount: 0,
          promiseDueCount: 0,
          currency: String(inv.currency || 'ZAR'),
          invoiceIds: [],
        };
        byKey.set(key, row);
      }

      const st = String(inv.status || '').toLowerCase();
      const ptp = (inv as { promise_to_pay_date?: string | null })
        .promise_to_pay_date
        ? String(
            (inv as { promise_to_pay_date?: string | null }).promise_to_pay_date
          ).slice(0, 10)
        : null;
      const broken = Boolean(ptp && ptp < today);
      const promiseDue = Boolean(ptp && ptp <= today);

      row.invoiceCount += 1;
      row.openBalance += balance;
      row.invoiceIds.push(Number(inv.id));
      if (st === 'overdue' || (inv.due_date && String(inv.due_date).slice(0, 10) < today)) {
        row.overdueCount += 1;
      }
      if (st === 'partial') row.partialCount += 1;
      if (broken) {
        row.brokenPromiseCount += 1;
        brokenTotal += 1;
      } else if (promiseDue) {
        row.promiseDueCount += 1;
      }
      openTotal += balance;
    }

    const customers = [...byKey.values()].sort(
      (a, b) => b.openBalance - a.openBalance
    );

    return NextResponse.json({
      success: true,
      openTotal: Math.round(openTotal * 100) / 100,
      customerCount: customers.length,
      brokenPromiseInvoices: brokenTotal,
      customers,
      asOf: today,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
