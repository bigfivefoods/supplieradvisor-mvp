import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';

/**
 * GET ?companyId= — AR aging buckets for open commercial invoices.
 * Buckets: current (not due), 1–30, 31–60, 61–90, 90+ overdue days.
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
    const { data, error } = await supabase
      .from('customer_invoices')
      .select(
        'id, invoice_number, customer_name, customer_id, status, total_amount, amount_paid, currency, due_date, issue_date, created_at'
      )
      .eq('profile_id', companyId)
      .in('status', [
        'sent',
        'partial',
        'overdue',
        'viewed',
        'unpaid',
        'issued',
        'draft',
      ])
      .order('due_date', { ascending: true })
      .limit(400);

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: 'Run CRM sales lifecycle migrations' },
        { status: 500 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    type BucketKey = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus';
    const buckets: Record<
      BucketKey,
      { count: number; amount: number; invoices: Array<Record<string, unknown>> }
    > = {
      current: { count: 0, amount: 0, invoices: [] },
      d1_30: { count: 0, amount: 0, invoices: [] },
      d31_60: { count: 0, amount: 0, invoices: [] },
      d61_90: { count: 0, amount: 0, invoices: [] },
      d90_plus: { count: 0, amount: 0, invoices: [] },
    };

    let openTotal = 0;
    let partialCount = 0;
    let overdueCount = 0;

    for (const inv of data || []) {
      const st = String(inv.status || '').toLowerCase();
      if (st === 'draft') continue; // aging is for issued AR
      const total = Number(inv.total_amount || 0);
      const paid = Number(inv.amount_paid || 0);
      const balance = Math.max(0, total - paid);
      if (balance <= 0.001 && st === 'paid') continue;
      if (balance <= 0.001 && st !== 'partial') continue;

      openTotal += balance;
      if (st === 'partial') partialCount += 1;

      const dueRaw = inv.due_date || inv.issue_date || inv.created_at;
      const due = dueRaw ? new Date(String(dueRaw)) : null;
      let daysPast = 0;
      if (due && Number.isFinite(due.getTime())) {
        due.setHours(0, 0, 0, 0);
        daysPast = Math.floor(
          (today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
        );
      }
      if (daysPast > 0 || st === 'overdue') overdueCount += 1;

      let key: BucketKey = 'current';
      if (daysPast <= 0 && st !== 'overdue') key = 'current';
      else if (daysPast <= 30 || (st === 'overdue' && daysPast <= 0))
        key = 'd1_30';
      else if (daysPast <= 60) key = 'd31_60';
      else if (daysPast <= 90) key = 'd61_90';
      else key = 'd90_plus';
      // Force overdue status into at least 1-30 if no due date
      if (st === 'overdue' && key === 'current') key = 'd1_30';

      buckets[key].count += 1;
      buckets[key].amount += balance;
      if (buckets[key].invoices.length < 25) {
        buckets[key].invoices.push({
          id: inv.id,
          invoice_number: inv.invoice_number,
          customer_name: inv.customer_name,
          status: inv.status,
          balance,
          total_amount: total,
          amount_paid: paid,
          currency: inv.currency || 'ZAR',
          due_date: inv.due_date,
          days_past_due: Math.max(0, daysPast),
        });
      }
    }

    return NextResponse.json({
      success: true,
      openTotal: Math.round(openTotal * 100) / 100,
      partialCount,
      overdueCount,
      buckets: {
        current: {
          label: 'Current (not yet due)',
          ...buckets.current,
          amount: Math.round(buckets.current.amount * 100) / 100,
        },
        d1_30: {
          label: '1–30 days',
          ...buckets.d1_30,
          amount: Math.round(buckets.d1_30.amount * 100) / 100,
        },
        d31_60: {
          label: '31–60 days',
          ...buckets.d31_60,
          amount: Math.round(buckets.d31_60.amount * 100) / 100,
        },
        d61_90: {
          label: '61–90 days',
          ...buckets.d61_90,
          amount: Math.round(buckets.d61_90.amount * 100) / 100,
        },
        d90_plus: {
          label: '90+ days',
          ...buckets.d90_plus,
          amount: Math.round(buckets.d90_plus.amount * 100) / 100,
        },
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
