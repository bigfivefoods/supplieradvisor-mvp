import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { buildArStatementPdf } from '@/lib/customers/ar-statement-pdf';
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';

const OPEN = [
  'sent',
  'partial',
  'overdue',
  'viewed',
  'unpaid',
  'issued',
] as const;

async function loadStatement(companyId: number, customerId: number) {
  const supabase = getSupabaseServer();
  const today = new Date().toISOString().slice(0, 10);

  const { data: seller } = await supabase
    .from('profiles')
    .select('trading_name, legal_name, email')
    .eq('id', companyId)
    .maybeSingle();

  const { data: cust } = await supabase
    .from('customers')
    .select('id, trading_name, legal_name, email, contact_email, credit_limit')
    .eq('id', customerId)
    .eq('profile_id', companyId)
    .maybeSingle();

  let { data: invs, error } = await supabase
    .from('customer_invoices')
    .select(
      'id, invoice_number, status, total_amount, amount_paid, currency, due_date, promise_to_pay_date, customer_name, contact_email'
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
        'id, invoice_number, status, total_amount, amount_paid, currency, due_date, customer_name, contact_email'
      )
      .eq('profile_id', companyId)
      .eq('customer_id', customerId)
      .in('status', [...OPEN])
      .order('due_date', { ascending: true })
      .limit(200);
    invs = retry.data as typeof invs;
    error = retry.error;
  }
  if (error) throw new Error(error.message);

  const lines = [];
  let openTotal = 0;
  let currency = 'ZAR';
  let customerName =
    cust?.trading_name || cust?.legal_name || 'Customer';
  let contactEmail =
    String(cust?.email || cust?.contact_email || '').trim() || '';

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
    if (!contactEmail && inv.contact_email) {
      contactEmail = String(inv.contact_email).trim();
    }
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
    return { ok: false as const, error: 'No open invoices for this customer' };
  }

  const sellerName =
    seller?.trading_name || seller?.legal_name || `Company #${companyId}`;
  const pdf = await buildArStatementPdf({
    sellerName,
    customerName,
    asOf: today,
    lines,
    openTotal,
    currency,
  });

  return {
    ok: true as const,
    pdf,
    sellerName,
    customerName,
    contactEmail,
    sellerEmail: seller?.email ? String(seller.email) : null,
    openTotal,
    currency,
    today,
    lineCount: lines.length,
    filename: `statement-${customerId}-${today}.pdf`,
  };
}

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

    const result = await loadStatement(companyId, customerId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(result.pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${result.filename}"`,
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

/**
 * POST { companyId, customerId, to?, action: 'email' }
 * Email PDF statement to customer (or override to=).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = Number(body.companyId);
    const customerId = Number(body.customerId);
    if (!Number.isFinite(companyId) || !Number.isFinite(customerId)) {
      return NextResponse.json(
        { error: 'companyId and customerId required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY not configured' },
        { status: 503 }
      );
    }

    const result = await loadStatement(companyId, customerId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    const to = String(body.to || result.contactEmail || '')
      .trim()
      .toLowerCase();
    if (!to.includes('@')) {
      return NextResponse.json(
        {
          error:
            'No customer email on file — pass to= or set email on the customer profile',
        },
        { status: 400 }
      );
    }

    const resend = getResend();
    const { error: sendErr } = await resend.emails.send({
      from: getResendFrom(),
      to: [to],
      ...(result.sellerEmail ? { replyTo: getResendReplyTo() || result.sellerEmail } : {}),
      subject: `Account statement — ${result.customerName} · ${result.currency} ${result.openTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} open`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#0f172a">Account statement</h2>
          <p>Dear ${result.customerName},</p>
          <p><strong>${result.sellerName}</strong> has sent your open-invoice statement as of <strong>${result.today}</strong>.</p>
          <p>Open balance: <strong>${result.currency} ${result.openTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong> across ${result.lineCount} invoice(s).</p>
          <p>The PDF is attached. Please arrange payment or contact us to renegotiate a promise-to-pay date.</p>
          <p style="font-size:12px;color:#64748b">Powered by SupplierAdvisor®</p>
        </div>
      `,
      attachments: [
        {
          filename: result.filename,
          content: result.pdf,
        },
      ],
    });

    if (sendErr) {
      return NextResponse.json(
        { error: String(sendErr) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      to,
      openTotal: result.openTotal,
      currency: result.currency,
      lineCount: result.lineCount,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
