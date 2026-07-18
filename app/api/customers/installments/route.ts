import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  loadInstallmentsForInvoice,
  replaceInstallmentSchedule,
  markInstallmentPaid,
} from '@/lib/customers/installments';
import { getSupabaseServer } from '@/lib/supabase/server-client';

/**
 * GET  ?companyId=&invoiceId=
 * POST { companyId, action: 'set'|'mark_paid', invoiceId, ... }
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const invoiceId = Number(request.nextUrl.searchParams.get('invoiceId'));
    if (!Number.isFinite(companyId) || !Number.isFinite(invoiceId)) {
      return NextResponse.json(
        { error: 'companyId and invoiceId required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data: inv } = await supabase
      .from('customer_invoices')
      .select('id, notes, total_amount, amount_paid, currency')
      .eq('id', invoiceId)
      .eq('profile_id', companyId)
      .maybeSingle();
    if (!inv) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const loaded = await loadInstallmentsForInvoice(
      companyId,
      invoiceId,
      inv.notes as string
    );
    return NextResponse.json({
      success: true,
      invoiceId,
      installments: loaded.rows,
      source: loaded.source,
      tableMissing: loaded.tableMissing,
      warning: loaded.tableMissing
        ? 'Run 20260718_installments_collections.sql for first-class installments'
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
    const invoiceId = Number(body.invoiceId || body.id);
    if (!Number.isFinite(companyId) || !Number.isFinite(invoiceId)) {
      return NextResponse.json(
        { error: 'companyId and invoiceId required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data: inv, error: invErr } = await supabase
      .from('customer_invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('profile_id', companyId)
      .maybeSingle();
    if (invErr || !inv) {
      return NextResponse.json(
        { error: invErr?.message || 'Invoice not found' },
        { status: 404 }
      );
    }

    const action = String(body.action || 'set').toLowerCase();
    const now = new Date().toISOString();

    if (action === 'mark_paid') {
      const result = await markInstallmentPaid({
        profileId: companyId,
        invoiceId,
        index: Number(body.index ?? 0),
        paid: body.paid !== false,
        actorUserId: gate.userId,
        notes: inv.notes as string,
        totalAmount: Number(inv.total_amount || 0),
        amountPaid: Number(inv.amount_paid || 0),
        currency: String(inv.currency || 'ZAR'),
        customerId: inv.customer_id ? Number(inv.customer_id) : null,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error || 'Failed' },
          { status: 400 }
        );
      }
      const fullyPaid =
        Number(inv.total_amount || 0) > 0 &&
        result.amountPaid >= Number(inv.total_amount) - 0.01;
      const { data: updated, error: uErr } = await supabase
        .from('customer_invoices')
        .update({
          notes: result.notes,
          amount_paid: result.amountPaid,
          status: result.status,
          paid_at: fullyPaid ? now : inv.paid_at || null,
          updated_at: now,
        })
        .eq('id', invoiceId)
        .select('*')
        .maybeSingle();
      if (uErr) {
        return NextResponse.json({ error: uErr.message }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        action: 'mark_paid',
        invoice: updated,
        installments: result.rows,
        tableMissing: result.tableMissing,
      });
    }

    // set schedule
    const schedule = Array.isArray(body.installments)
      ? body.installments.map(
          (x: { date?: string; amount?: number; due_date?: string }) => ({
            date: String(x.date || x.due_date || ''),
            amount: Number(x.amount),
          })
        )
      : [];
    const replaced = await replaceInstallmentSchedule({
      profileId: companyId,
      invoiceId,
      customerId: inv.customer_id ? Number(inv.customer_id) : null,
      currency: String(inv.currency || 'ZAR'),
      notes: inv.notes as string,
      schedule,
    });
    if (!replaced.ok) {
      return NextResponse.json(
        { error: replaced.error || 'Failed' },
        { status: 500 }
      );
    }
    const updatePayload: Record<string, unknown> = {
      notes: replaced.notes,
      updated_at: now,
    };
    if (schedule[0]?.date) {
      updatePayload.promise_to_pay_date = schedule[0].date;
    }
    let { data: updated, error: uErr } = await supabase
      .from('customer_invoices')
      .update(updatePayload)
      .eq('id', invoiceId)
      .select('*')
      .maybeSingle();
    if (uErr && /promise_to_pay|column|schema cache/i.test(uErr.message || '')) {
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
      action: 'set',
      invoice: updated,
      installments: replaced.rows,
      tableMissing: replaced.tableMissing,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
