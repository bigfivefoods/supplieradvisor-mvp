import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  listLedgerForCompany,
  listLedgerForInvoice,
  recordArPayment,
  sumLedgerPaid,
} from '@/lib/customers/ar-ledger';
import { getSupabaseServer } from '@/lib/supabase/server-client';

/**
 * GET  ?companyId=&invoiceId?&customerId? — list ledger entries
 * POST { companyId, action: 'record'|'sync_invoice', invoiceId, amount, ... }
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

    const invoiceId = Number(request.nextUrl.searchParams.get('invoiceId') || 0);
    const customerId = Number(
      request.nextUrl.searchParams.get('customerId') || 0
    );

    if (invoiceId > 0) {
      const { entries, tableMissing } = await listLedgerForInvoice(
        companyId,
        invoiceId
      );
      const sum = await sumLedgerPaid(companyId, invoiceId);
      return NextResponse.json({
        success: true,
        invoiceId,
        entries,
        ledgerTotal: sum.total,
        tableMissing,
        warning: tableMissing
          ? 'Run 20260717_ar_ledger.sql to enable first-class payment ledger'
          : undefined,
      });
    }

    const { entries, tableMissing } = await listLedgerForCompany(companyId, {
      customerId: customerId > 0 ? customerId : undefined,
      limit: Number(request.nextUrl.searchParams.get('limit') || 80),
    });
    return NextResponse.json({
      success: true,
      entries,
      tableMissing,
      warning: tableMissing
        ? 'Run 20260717_ar_ledger.sql to enable first-class payment ledger'
        : undefined,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const action = String(body.action || 'record').toLowerCase();
    const invoiceId = Number(body.invoiceId || body.id);
    if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
      return NextResponse.json({ error: 'invoiceId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: inv, error: invErr } = await supabase
      .from('customer_invoices')
      .select(
        'id, profile_id, customer_id, total_amount, amount_paid, status, currency'
      )
      .eq('id', invoiceId)
      .eq('profile_id', companyId)
      .maybeSingle();
    if (invErr || !inv) {
      return NextResponse.json(
        { error: invErr?.message || 'Invoice not found' },
        { status: 404 }
      );
    }

    if (action === 'list') {
      const { entries, tableMissing } = await listLedgerForInvoice(
        companyId,
        invoiceId
      );
      return NextResponse.json({ success: true, entries, tableMissing });
    }

    // record payment line + update invoice rollup
    const amount = Number(body.amount ?? body.amount_delta);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'amount must be a positive number' },
        { status: 400 }
      );
    }

    const paidAt = body.paid_at
      ? String(body.paid_at)
      : new Date().toISOString();
    const reference =
      body.reference != null
        ? String(body.reference).trim().slice(0, 200)
        : body.payment_reference != null
          ? String(body.payment_reference).trim().slice(0, 200)
          : null;

    const ledger = await recordArPayment({
      profile_id: companyId,
      invoice_id: invoiceId,
      customer_id: inv.customer_id ? Number(inv.customer_id) : null,
      amount,
      currency: String(body.currency || inv.currency || 'ZAR'),
      paid_at: paidAt,
      method: body.method ? String(body.method).slice(0, 40) : 'manual',
      reference,
      proof_url: body.proof_url ? String(body.proof_url).slice(0, 500) : null,
      notes: body.notes ? String(body.notes).slice(0, 500) : null,
      created_by: gate.userId || null,
    });
    if (!ledger.ok) {
      return NextResponse.json({ error: ledger.error }, { status: 500 });
    }

    // Recompute amount_paid from ledger if available, else additive
    let nextPaid = Number(inv.amount_paid || 0) + amount;
    const sum = await sumLedgerPaid(companyId, invoiceId);
    if (sum.total != null && !sum.tableMissing) {
      nextPaid = sum.total;
    }
    const total = Number(inv.total_amount || 0);
    const eps = Math.max(0.01, total * 0.001);
    const fullyPaid = total <= 0 ? nextPaid > 0 : nextPaid >= total - eps;
    const nextStatus = fullyPaid
      ? 'paid'
      : nextPaid > 0
        ? 'partial'
        : String(inv.status || 'sent');

    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      amount_paid: nextPaid,
      status: nextStatus,
      paid_at: fullyPaid ? now : null,
      updated_at: now,
    };
    if (reference) updatePayload.payment_reference = reference;
    if (fullyPaid) updatePayload.promise_to_pay_date = null;

    let { data: updated, error: uErr } = await supabase
      .from('customer_invoices')
      .update(updatePayload)
      .eq('id', invoiceId)
      .select('*')
      .maybeSingle();
    if (
      uErr &&
      /payment_reference|promise_to_pay|column|schema cache/i.test(
        uErr.message || ''
      )
    ) {
      delete updatePayload.payment_reference;
      delete updatePayload.promise_to_pay_date;
      const retry = await supabase
        .from('customer_invoices')
        .update(updatePayload)
        .eq('id', invoiceId)
        .select('*')
        .maybeSingle();
      updated = retry.data;
      uErr = retry.error;
    }
    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action: 'record',
      ledgerEntry: ledger.entry,
      tableMissing: ledger.tableMissing || false,
      invoice: updated,
      amount_paid: nextPaid,
      status: nextStatus,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
