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
    type InvRow = {
      id: number;
      invoice_number?: string | null;
      customer_name?: string | null;
      customer_id?: number | null;
      status?: string | null;
      total_amount?: number | null;
      amount_paid?: number | null;
      currency?: string | null;
      due_date?: string | null;
      issue_date?: string | null;
      created_at?: string | null;
      promise_to_pay_date?: string | null;
    };
    let data: InvRow[] | null = null;
    let error: { message: string } | null = null;

    {
      const first = await supabase
        .from('customer_invoices')
        .select(
          'id, invoice_number, customer_name, customer_id, status, total_amount, amount_paid, currency, due_date, issue_date, created_at, promise_to_pay_date'
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
      data = (first.data as InvRow[] | null) || null;
      error = first.error;
    }

    if (error && /promise_to_pay|column|schema cache/i.test(error.message || '')) {
      const retry = await supabase
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
      data = (retry.data as InvRow[] | null) || null;
      error = retry.error;
    }

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
      {
        count: number;
        amount: number;
        amountBase: number;
        invoices: Array<Record<string, unknown>>;
      }
    > = {
      current: { count: 0, amount: 0, amountBase: 0, invoices: [] },
      d1_30: { count: 0, amount: 0, amountBase: 0, invoices: [] },
      d31_60: { count: 0, amount: 0, amountBase: 0, invoices: [] },
      d61_90: { count: 0, amount: 0, amountBase: 0, invoices: [] },
      d90_plus: { count: 0, amount: 0, amountBase: 0, invoices: [] },
    };

    let openTotal = 0;
    let openTotalBase: number | null = 0;
    let partialCount = 0;
    let overdueCount = 0;
    let brokenPromiseCount = 0;
    const todayIso = today.toISOString().slice(0, 10);

    // FX rates for multi-currency base rollup (company primary_currency)
    let baseCurrency = 'ZAR';
    let ratesUsd: Record<string, number> = {
      ZAR: 18.5,
      USD: 1,
      EUR: 0.92,
      GBP: 0.79,
    };
    let convertAmountFn: typeof import('@/lib/fx/types').convertAmount | null =
      null;
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('primary_currency')
        .eq('id', companyId)
        .maybeSingle();
      baseCurrency = String(prof?.primary_currency || 'ZAR').toUpperCase();
      const fxRes = await fetch(
        'https://api.frankfurter.dev/v1/latest?base=USD',
        { next: { revalidate: 900 } }
      ).catch(() => null);
      if (fxRes?.ok) {
        const fxJson = (await fxRes.json()) as {
          rates?: Record<string, number>;
        };
        ratesUsd = { USD: 1 };
        for (const [k, v] of Object.entries(fxJson.rates || {})) {
          ratesUsd[k.toUpperCase()] = Number(v);
        }
      }
      convertAmountFn = (await import('@/lib/fx/types')).convertAmount;
    } catch {
      convertAmountFn = null;
    }

    // Batch ledger paid totals (avoid N+1)
    const ledgerPaidByInv = new Map<number, number>();
    try {
      const invIds = (data || []).map((i) => Number(i.id)).filter(Boolean);
      if (invIds.length) {
        const { data: led } = await supabase
          .from('customer_invoice_payments')
          .select('invoice_id, amount')
          .eq('profile_id', companyId)
          .in('invoice_id', invIds.slice(0, 400));
        for (const row of led || []) {
          const id = Number(row.invoice_id);
          ledgerPaidByInv.set(
            id,
            (ledgerPaidByInv.get(id) || 0) + Number(row.amount || 0)
          );
        }
      }
    } catch {
      /* table optional */
    }

    let convertedAny = false;
    for (const inv of data || []) {
      const st = String(inv.status || '').toLowerCase();
      if (st === 'draft') continue; // aging is for issued AR
      const total = Number(inv.total_amount || 0);
      let paid = Number(inv.amount_paid || 0);
      const ledPaid = ledgerPaidByInv.get(Number(inv.id));
      if (ledPaid != null) paid = Math.max(paid, ledPaid);
      const balance = Math.max(0, total - paid);
      if (balance <= 0.001 && st === 'paid') continue;
      if (balance <= 0.001 && st !== 'partial') continue;

      const ccy = String(inv.currency || 'ZAR').toUpperCase();
      let balanceBase = balance;
      if (convertAmountFn && ccy !== baseCurrency) {
        const conv = convertAmountFn(balance, ccy, baseCurrency, ratesUsd);
        if (conv != null && Number.isFinite(conv)) {
          balanceBase = conv;
          convertedAny = true;
        }
      } else {
        convertedAny = true;
      }

      openTotal += balance;
      openTotalBase = (openTotalBase || 0) + balanceBase;
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

      const ptpRaw = inv.promise_to_pay_date
        ? String(inv.promise_to_pay_date).slice(0, 10)
        : null;
      const brokenPromise = Boolean(ptpRaw && ptpRaw < todayIso);
      if (brokenPromise) brokenPromiseCount += 1;

      buckets[key].count += 1;
      buckets[key].amount += balance;
      buckets[key].amountBase += balanceBase;
      if (buckets[key].invoices.length < 25) {
        buckets[key].invoices.push({
          id: inv.id,
          invoice_number: inv.invoice_number,
          customer_name: inv.customer_name,
          status: inv.status,
          balance,
          balance_base: Math.round(balanceBase * 100) / 100,
          total_amount: total,
          amount_paid: paid,
          currency: inv.currency || 'ZAR',
          due_date: inv.due_date,
          days_past_due: Math.max(0, daysPast),
          promise_to_pay_date: ptpRaw,
          broken_promise: brokenPromise,
        });
      }
    }

    if (!convertedAny) openTotalBase = null;
    else openTotalBase = Math.round((openTotalBase || 0) * 100) / 100;

    const fmtBucket = (
      label: string,
      b: (typeof buckets)[BucketKey]
    ) => ({
      label,
      count: b.count,
      amount: Math.round(b.amount * 100) / 100,
      amountBase: Math.round(b.amountBase * 100) / 100,
      invoices: b.invoices,
    });

    return NextResponse.json({
      success: true,
      openTotal: Math.round(openTotal * 100) / 100,
      openTotalBase,
      baseCurrency,
      partialCount,
      overdueCount,
      brokenPromiseCount,
      buckets: {
        current: fmtBucket('Current (not yet due)', buckets.current),
        d1_30: fmtBucket('1–30 days', buckets.d1_30),
        d31_60: fmtBucket('31–60 days', buckets.d31_60),
        d61_90: fmtBucket('61–90 days', buckets.d61_90),
        d90_plus: fmtBucket('90+ days', buckets.d90_plus),
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
