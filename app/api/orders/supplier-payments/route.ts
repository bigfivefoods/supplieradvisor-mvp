import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, logActivity } from '@/lib/customers/access';

/**
 * GET  /api/orders/supplier-payments?companyId=&poId=
 * POST /api/orders/supplier-payments
 *   Body: {
 *     companyId, privyUserId, poId,
 *     amount, currency?, payment_date?, reference?, method?,
 *     pop_url?, pop_document_id?, share_with_supplier?, notes?, status?
 *   }
 * Records a supplier payment, updates PO amount_paid + payment_status.
 */

function paymentStatusFromTotals(total: number, paid: number): 'unpaid' | 'partial' | 'paid' {
  if (paid <= 0.009) return 'unpaid';
  if (total > 0 && paid >= total - 0.01) return 'paid';
  return 'partial';
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = Number(searchParams.get('companyId'));
    const poId = Number(searchParams.get('poId'));
    const privyUserId = searchParams.get('privyUserId');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    if (privyUserId) {
      const mem = await assertCompanyMember(privyUserId, companyId);
      if (!mem.ok) {
        return NextResponse.json({ error: mem.error }, { status: mem.status });
      }
    }

    const supabase = getSupabaseServer();
    let q = supabase
      .from('supplier_payments')
      .select('*')
      .eq('company_id', companyId)
      .order('payment_date', { ascending: false })
      .limit(200);
    if (poId) q = q.eq('po_id', poId);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ payments: data || [] });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const companyId = Number(body.companyId);
    const poId = Number(body.poId);
    const privyUserId = body.privyUserId as string | undefined;
    const amount = Number(body.amount);

    if (!companyId || !poId || !privyUserId) {
      return NextResponse.json(
        { error: 'companyId, poId and privyUserId are required' },
        { status: 400 }
      );
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 });
    }

    const mem = await assertCompanyMember(privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();

    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .select('id, buyer_profile_id, total_amount, amount_paid, payment_status, currency, supplier_profile_id')
      .eq('id', poId)
      .eq('buyer_profile_id', companyId)
      .maybeSingle();

    if (poErr || !po) {
      return NextResponse.json(
        { error: poErr?.message || 'Purchase order not found' },
        { status: 404 }
      );
    }

    const currency = body.currency || po.currency || 'ZAR';
    const paymentDate =
      body.payment_date || new Date().toISOString().slice(0, 10);
    const status = body.status === 'pending' ? 'pending' : 'recorded';

    const { data: payment, error: payErr } = await supabase
      .from('supplier_payments')
      .insert({
        company_id: companyId,
        po_id: poId,
        amount,
        currency,
        payment_date: paymentDate,
        reference: body.reference ? String(body.reference).slice(0, 200) : null,
        method: body.method ? String(body.method).slice(0, 40) : null,
        status,
        pop_document_id: body.pop_document_id || null,
        pop_url: body.pop_url || null,
        share_with_supplier: body.share_with_supplier === true,
        notes: body.notes ? String(body.notes).slice(0, 1000) : null,
        created_by: privyUserId,
        metadata: {},
      })
      .select('*')
      .single();

    if (payErr || !payment) {
      console.error('[supplier-payments POST]', payErr);
      return NextResponse.json(
        { error: payErr?.message || 'Failed to record payment' },
        { status: 500 }
      );
    }

    // Recompute paid total from all non-void payments
    const { data: allPays } = await supabase
      .from('supplier_payments')
      .select('amount, status')
      .eq('po_id', poId)
      .eq('company_id', companyId)
      .neq('status', 'void');

    const paidSum = (allPays || []).reduce(
      (s, p) => s + (Number(p.amount) || 0),
      0
    );
    const poTotal = Number(po.total_amount) || 0;
    const paymentStatus = paymentStatusFromTotals(poTotal, paidSum);

    await supabase
      .from('purchase_orders')
      .update({
        amount_paid: Math.round(paidSum * 100) / 100,
        payment_status: paymentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', poId)
      .eq('buyer_profile_id', companyId);

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: 'po.supplier_payment.recorded',
      entity_type: 'purchase_order',
      entity_id: String(poId),
      summary: `Supplier payment ${amount} ${currency} on PO #${poId} → ${paymentStatus}`,
      metadata: {
        payment_id: payment.id,
        amount,
        payment_status: paymentStatus,
        share_with_supplier: body.share_with_supplier === true,
      },
    });

    // Soft notify supplier when shared
    if (body.share_with_supplier === true && po.supplier_profile_id) {
      void supabase.from('notifications').insert({
        profile_id: Number(po.supplier_profile_id),
        type: 'supplier_payment_received',
        title: `Payment recorded on PO #${poId}`,
        body: `${amount.toLocaleString()} ${currency} recorded by buyer${
          body.reference ? ` · ref ${body.reference}` : ''
        }`,
        metadata: {
          poId,
          paymentId: payment.id,
          amount,
          currency,
          pop_url: body.pop_url || null,
        },
        read: false,
      });
    }

    return NextResponse.json(
      {
        success: true,
        payment,
        poPaymentStatus: paymentStatus,
        amountPaid: paidSum,
        poTotal,
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    console.error('[supplier-payments POST]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
