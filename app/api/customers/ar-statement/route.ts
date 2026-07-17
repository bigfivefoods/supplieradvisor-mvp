import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { buildArStatementPdf } from '@/lib/customers/ar-statement-pdf';

const OPEN = [
  'sent',
  'partial',
  'overdue',
  'viewed',
  'unpaid',
  'issued',
] as const;

/**
 * GET ?companyId=&customerId= — PDF statement of open invoices for one customer.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const customerId = Number(sp.get('customerId'));
    if (!Number.isFinite(companyId) || !Number.isFinite(customerId)) {
      return NextResponse.json(
        { error: 'companyId and customerId required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const today = new Date().toISOString().slice(0, 10);

    const { data: seller } = await supabase
      .from('profiles')
      .select('trading_name, legal_name')
      .eq('id', companyId)
      .maybeSingle();

    let { data: invs, error } = await supabase
      .from('customer_invoices')
      .select(
        'id, invoice_number, status, total_amount, amount_paid, currency, due_date, promise_to_pay_date, customer_name'
      )
      .eq('profile_id', companyId)
      .eq('customer_id', customerId)
      .in('status', [...OPEN])
      .order('due_date', { ascending: true })
      .limit(200);

    if (error && /promise_to_pay|column|schema cache/i.test(error.message || '')) {
      const retry = await supabase
        .from('customer_invoices')
        .select(
          'id, invoice_number, status, total_amount, amount_paid, currency, due_date, customer_name'
        )
        .eq('profile_id', companyId)
        .eq('customer_id', customerId)
        .in('status', [...OPEN])
        .order('due_date', { ascending: true })
        .limit(200);
      invs = retry.data as typeof invs;
      error = retry.error;
    }
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const lines = [];
    let openTotal = 0;
    let currency = 'ZAR';
    let customerName = 'Customer';
    for (const inv of invs || []) {
      const balance = Math.max(
        0,
        Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)
      );
      if (balance <= 0.009) continue;
      const ptp = (inv as { promise_to_pay_date?: string | null })
        .promise_to_pay_date
        ? String(
            (inv as { promise_to_pay_date?: string | null }).promise_to_pay_date
          ).slice(0, 10)
        : null;
      currency = String(inv.currency || currency);
      customerName = String(inv.customer_name || customerName);
      openTotal += balance;
      lines.push({
        invoiceNumber: String(inv.invoice_number || `#${inv.id}`),
        status: String(inv.status || ''),
        dueDate: inv.due_date ? String(inv.due_date).slice(0, 10) : null,
        promiseDate: ptp,
        balance,
        currency,
        brokenPromise: Boolean(ptp && ptp < today),
      });
    }

    if (!lines.length) {
      return NextResponse.json(
        { error: 'No open invoices for this customer' },
        { status: 404 }
      );
    }

    const pdf = await buildArStatementPdf({
      sellerName:
        seller?.trading_name || seller?.legal_name || `Company #${companyId}`,
      customerName,
      asOf: today,
      lines,
      openTotal,
      currency,
    });

    const filename = `statement-${customerId}-${today}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
