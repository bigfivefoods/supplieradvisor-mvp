import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import {
  calcInvoiceTotals,
  nextDocumentNumber,
  parseCompanyId,
  round2,
} from '@/lib/accounting/server';
import { invoiceBalance, isOverdue } from '@/lib/accounting/types';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/** GET ?companyId=&direction=receivable|payable&status= */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const direction = request.nextUrl.searchParams.get('direction');
    const status = request.nextUrl.searchParams.get('status');
    const q = request.nextUrl.searchParams.get('q');

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    let query = supabase
      .from('invoices')
      .select('*')
      .eq('profile_id', companyId)
      .order('issue_date', { ascending: false })
      .order('id', { ascending: false })
      .limit(300);

    if (direction === 'receivable' || direction === 'payable') {
      query = query.eq('direction', direction);
    }
    if (status && status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({
        success: true,
        invoices: [],
        warning: error.message,
        hint: 'Run world_class + accounting migrations',
      });
    }

    let invoices = (data || []).map((inv) => {
      let status = inv.status;
      if (isOverdue(inv) && !['paid', 'void', 'cancelled'].includes(String(status))) {
        status = 'overdue';
      }
      return {
        ...inv,
        status,
        balance_due: invoiceBalance(inv),
      };
    });

    if (q) {
      const n = q.toLowerCase();
      invoices = invoices.filter(
        (i) =>
          i.invoice_number?.toLowerCase().includes(n) ||
          i.counterparty_name?.toLowerCase().includes(n) ||
          i.notes?.toLowerCase().includes(n)
      );
    }

    return NextResponse.json({ success: true, invoices });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** POST — create AR or AP invoice */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const privyUserId = body.privyUserId as string | undefined;
    const direction = body.direction === 'payable' ? 'payable' : 'receivable';

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const taxRate = body.tax_rate != null ? Number(body.tax_rate) : 15;
    const items = Array.isArray(body.items) ? body.items : [];
    let totals = calcInvoiceTotals(items, taxRate);

    // Allow direct totals when no line items
    if (items.length === 0 && body.total_amount != null) {
      const subtotal = Number(body.subtotal ?? body.total_amount);
      const tax_amount = Number(body.tax_amount ?? 0);
      const total_amount = Number(body.total_amount);
      totals = {
        subtotal: round2(subtotal),
        tax_amount: round2(tax_amount),
        total_amount: round2(total_amount),
        tax_rate: taxRate,
      };
    }

    const invoiceNumber =
      body.invoice_number ||
      (await nextDocumentNumber(companyId, direction === 'payable' ? 'ap' : 'ar'));

    const supabase = getSupabaseServer();
    const counterpartyProfileId = body.counterparty_profile_id
      ? Number(body.counterparty_profile_id)
      : null;
    let counterpartyName = body.counterparty_name || null;

    // Resolve counterparty name from network profile when only id is given
    if (counterpartyProfileId && !counterpartyName) {
      const { data: peer } = await supabase
        .from('profiles')
        .select('id, trading_name, legal_name')
        .eq('id', counterpartyProfileId)
        .maybeSingle();
      if (peer) {
        counterpartyName = peer.trading_name || peer.legal_name || `Company #${counterpartyProfileId}`;
      }
    }

    const status = body.status || 'draft';
    const metaBase =
      body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? { ...(body.metadata as Record<string, unknown>) }
        : {};

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        profile_id: companyId,
        direction,
        counterparty_name: counterpartyName,
        counterparty_profile_id: counterpartyProfileId,
        customer_id: body.customer_id || null,
        supplier_id: body.supplier_id || null,
        invoice_number: invoiceNumber,
        status,
        issue_date: body.issue_date || new Date().toISOString().slice(0, 10),
        due_date: body.due_date || null,
        currency: body.currency || 'ZAR',
        subtotal: totals.subtotal,
        tax_rate: totals.tax_rate,
        tax_amount: totals.tax_amount,
        total_amount: totals.total_amount,
        amount_paid: Number(body.amount_paid || 0),
        po_id: body.po_id || null,
        sales_order_id: body.sales_order_id || body.order_id || null,
        order_id: body.order_id || null,
        notes: body.notes || null,
        items,
        bill_to_email: body.bill_to_email || null,
        billing_address: body.billing_address || null,
        entity_id: body.entity_id || null,
        metadata: metaBase,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Mirror to connected counterparty so both companies see the same commercial document
    let mirroredInvoiceId: number | null = null;
    if (
      counterpartyProfileId &&
      Number.isFinite(counterpartyProfileId) &&
      counterpartyProfileId !== companyId &&
      body.skipMirror !== true
    ) {
      try {
        // Only mirror when there is an accepted network edge
        const { data: edges } = await supabase
          .from('business_connections')
          .select('id, status, metadata')
          .or(
            `and(requester_profile_id.eq.${companyId},requestee_profile_id.eq.${counterpartyProfileId}),and(requester_profile_id.eq.${counterpartyProfileId},requestee_profile_id.eq.${companyId})`
          )
          .eq('status', 'accepted')
          .limit(1);
        const edge = edges?.[0];
        const meta =
          edge?.metadata && typeof edge.metadata === 'object' && !Array.isArray(edge.metadata)
            ? (edge.metadata as Record<string, unknown>)
            : {};
        const suspended = meta.suspended === true || meta.suspended === 'true';

        if (edge && !suspended) {
          // Resolve issuer name for counterparty view
          const { data: issuer } = await supabase
            .from('profiles')
            .select('trading_name, legal_name')
            .eq('id', companyId)
            .maybeSingle();
          const issuerName =
            issuer?.trading_name || issuer?.legal_name || `Company #${companyId}`;
          const mirrorDirection = direction === 'receivable' ? 'payable' : 'receivable';
          const mirrorNumber = await nextDocumentNumber(
            counterpartyProfileId,
            mirrorDirection === 'payable' ? 'ap' : 'ar'
          );
          const { data: mirrored } = await supabase
            .from('invoices')
            .insert({
              profile_id: counterpartyProfileId,
              direction: mirrorDirection,
              counterparty_name: issuerName,
              counterparty_profile_id: companyId,
              invoice_number: mirrorNumber,
              status: status === 'draft' ? 'draft' : status,
              issue_date: body.issue_date || new Date().toISOString().slice(0, 10),
              due_date: body.due_date || null,
              currency: body.currency || 'ZAR',
              subtotal: totals.subtotal,
              tax_rate: totals.tax_rate,
              tax_amount: totals.tax_amount,
              total_amount: totals.total_amount,
              amount_paid: Number(body.amount_paid || 0),
              po_id: body.po_id || null,
              notes: body.notes || null,
              items,
              bill_to_email: body.bill_to_email || null,
              billing_address: body.billing_address || null,
              metadata: {
                mirrored_from_invoice_id: data.id,
                mirrored_from_profile_id: companyId,
                network_sync: true,
              },
            })
            .select('id')
            .single();
          if (mirrored?.id) {
            mirroredInvoiceId = Number(mirrored.id);
            await supabase
              .from('invoices')
              .update({
                metadata: {
                  ...metaBase,
                  mirrored_invoice_id: mirroredInvoiceId,
                  mirrored_to_profile_id: counterpartyProfileId,
                },
              })
              .eq('id', data.id);
          }
        }
      } catch (mirrorErr) {
        console.warn('invoice mirror soft-fail:', mirrorErr);
      }
    }

    return NextResponse.json({
      success: true,
      invoice: { ...data, balance_due: invoiceBalance(data) },
      mirroredInvoiceId,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** PATCH — update status / fields */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const id = Number(body.id);
    const privyUserId = body.privyUserId as string | undefined;

    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: privyUserId || legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const allowed = [
      'status',
      'counterparty_name',
      'issue_date',
      'due_date',
      'notes',
      'bill_to_email',
      'billing_address',
      'items',
      'subtotal',
      'tax_rate',
      'tax_amount',
      'total_amount',
      'amount_paid',
      'paid_at',
    ];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }

    if (Array.isArray(body.items)) {
      const taxRate = body.tax_rate != null ? Number(body.tax_rate) : 15;
      const totals = calcInvoiceTotals(body.items, taxRate);
      patch.subtotal = totals.subtotal;
      patch.tax_amount = totals.tax_amount;
      patch.total_amount = totals.total_amount;
      patch.tax_rate = totals.tax_rate;
      patch.items = body.items;
    }

    if (body.status === 'paid' && !body.paid_at) {
      patch.paid_at = new Date().toISOString();
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('invoices')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({
      success: true,
      invoice: { ...data, balance_due: invoiceBalance(data) },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** DELETE soft-void */
export async function DELETE(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const id = Number(request.nextUrl.searchParams.get('id'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');

    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: privyUserId || legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from('invoices')
      .update({ status: 'void', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('profile_id', companyId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
