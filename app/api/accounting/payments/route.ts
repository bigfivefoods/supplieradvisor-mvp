import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId, round2 } from '@/lib/accounting/server';
import { invoiceBalance } from '@/lib/accounting/types';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/** GET ?companyId=&direction=inbound|outbound */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const direction = request.nextUrl.searchParams.get('direction');

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    let query = supabase
      .from('payments')
      .select('*')
      .eq('profile_id', companyId)
      .order('paid_at', { ascending: false })
      .limit(300);

    if (direction === 'inbound' || direction === 'outbound') {
      query = query.eq('direction', direction);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({
        success: true,
        payments: [],
        warning: error.message,
      });
    }

    const invoiceIds = [
      ...new Set((data || []).map((p) => p.invoice_id).filter(Boolean)),
    ] as number[];
    let invMap: Record<number, Record<string, unknown>> = {};
    if (invoiceIds.length) {
      const { data: invs } = await supabase
        .from('invoices')
        .select('id, invoice_number, counterparty_name, direction, total_amount, amount_paid, status')
        .in('id', invoiceIds);
      for (const inv of invs || []) invMap[inv.id] = inv;
    }

    const payments = (data || []).map((p) => ({
      ...p,
      invoice: p.invoice_id ? invMap[p.invoice_id] || null : null,
    }));

    return NextResponse.json({ success: true, payments });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * POST — record payment and optionally apply to invoice
 * body: { companyId, amount, direction, invoice_id?, method, reference, bank_account_id? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const privyUserId = body.privyUserId as string | undefined;
    const amount = round2(Number(body.amount || 0));

    if (!Number.isFinite(companyId) || amount <= 0) {
      return NextResponse.json(
        { error: 'companyId and positive amount required' },
        { status: 400 }
      );
    }
    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: privyUserId || legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    let direction = body.direction as string | undefined;
    let counterparty = body.counterparty_name as string | undefined;
    let invoiceId = body.invoice_id ? Number(body.invoice_id) : null;

    if (invoiceId) {
      const { data: inv, error: invErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .eq('profile_id', companyId)
        .maybeSingle();
      if (invErr || !inv) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }
      direction = inv.direction === 'payable' ? 'outbound' : 'inbound';
      counterparty = counterparty || inv.counterparty_name || undefined;
    }

    if (!direction) {
      direction = 'inbound';
    }

    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        profile_id: companyId,
        invoice_id: invoiceId,
        direction,
        amount,
        currency: body.currency || 'ZAR',
        method: body.method || 'eft',
        reference: body.reference || null,
        paid_at: body.paid_at || new Date().toISOString(),
        status: body.status || 'completed',
        onchain_tx: body.onchain_tx || null,
        counterparty_name: counterparty || null,
        bank_account_id: body.bank_account_id || null,
        entity_id: body.entity_id || null,
        notes: body.notes || null,
        metadata: body.metadata || {},
      })
      .select('*')
      .single();

    if (error || !payment) {
      return NextResponse.json(
        { error: error?.message || 'Failed to record payment' },
        { status: 400 }
      );
    }

    // Apply to invoice
    if (invoiceId) {
      const { data: inv } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .maybeSingle();
      if (inv) {
        const newPaid = round2(Number(inv.amount_paid || 0) + amount);
        const total = Number(inv.total_amount || 0);
        let status = inv.status;
        if (newPaid >= total - 0.005) {
          status = 'paid';
        } else if (newPaid > 0) {
          status = 'partial';
        }
        await supabase
          .from('invoices')
          .update({
            amount_paid: newPaid,
            status,
            paid_at: status === 'paid' ? new Date().toISOString() : inv.paid_at,
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoiceId);
      }
    }

    // Update bank account balance
    if (body.bank_account_id) {
      const bankId = Number(body.bank_account_id);
      const { data: bank } = await supabase
        .from('bank_accounts')
        .select('id, current_balance')
        .eq('id', bankId)
        .eq('profile_id', companyId)
        .maybeSingle();
      if (bank) {
        const delta = direction === 'inbound' ? amount : -amount;
        await supabase
          .from('bank_accounts')
          .update({
            current_balance: round2(Number(bank.current_balance || 0) + delta),
            updated_at: new Date().toISOString(),
          })
          .eq('id', bankId);
      }
    }

    return NextResponse.json({
      success: true,
      payment,
      invoice_balance: invoiceId
        ? await (async () => {
            const { data: inv } = await supabase
              .from('invoices')
              .select('total_amount, amount_paid')
              .eq('id', invoiceId!)
              .maybeSingle();
            return inv ? invoiceBalance(inv) : null;
          })()
        : null,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
