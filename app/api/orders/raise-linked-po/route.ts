import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, logActivity } from '@/lib/customers/access';
import { mapSoItemsToPoItems } from '@/lib/orders/map-so-to-po-items';
import { resolvePreferredSupplier } from '@/lib/orders/preferred-supplier';
import { notifyLinkedPoCreated } from '@/lib/orders/notify-chain';

/**
 * POST /api/orders/raise-linked-po
 * One-click: create a PO from a Sales Order and create an active order_link.
 * Auto-resolves preferred manufacturer when supplier not provided (Phase D).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const companyId = Number(body.companyId);
    const salesOrderId = Number(body.salesOrderId);
    const privyUserId = body.privyUserId as string | undefined;
    const status = body.status === 'sent' ? 'sent' : 'draft';

    if (!companyId || !salesOrderId || !privyUserId) {
      return NextResponse.json(
        { error: 'companyId, salesOrderId and privyUserId are required' },
        { status: 400 }
      );
    }

    const mem = await assertCompanyMember(privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();

    const { data: so, error: soErr } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('id', salesOrderId)
      .eq('profile_id', companyId)
      .maybeSingle();

    if (soErr || !so) {
      return NextResponse.json(
        { error: soErr?.message || 'Sales order not found' },
        { status: 404 }
      );
    }

    // Guard: already has an active fulfillment link to a PO
    if (body.allowMultipleLinks !== true) {
      const { data: existingLink } = await supabase
        .from('order_links')
        .select('id, target_order_id')
        .eq('company_id', companyId)
        .eq('source_order_id', salesOrderId)
        .eq('source_order_type', 'sales_order')
        .eq('target_order_type', 'purchase_order')
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (existingLink?.id) {
        return NextResponse.json(
          {
            error: `SO already linked to PO #${existingLink.target_order_id}. Unlink first or pass allowMultipleLinks: true.`,
            code: 'ALREADY_LINKED',
            existingLink,
          },
          { status: 409 }
        );
      }
    }

    let supplierProfileId = body.supplierProfileId
      ? Number(body.supplierProfileId)
      : null;
    let srmSupplierId = body.srmSupplierId ? Number(body.srmSupplierId) : null;
    let srmId: number | null = null;
    let bookOnlyName: string | null = null;
    let preferredSource: string | null = null;

    // Phase D: auto-resolve preferred supplier
    if (
      (!supplierProfileId || !Number.isFinite(supplierProfileId)) &&
      (!srmSupplierId || !Number.isFinite(srmSupplierId))
    ) {
      const preferred = await resolvePreferredSupplier(
        supabase,
        companyId,
        so as Record<string, unknown>
      );
      if (preferred.srmSupplierId || preferred.supplierProfileId) {
        srmSupplierId = preferred.srmSupplierId;
        supplierProfileId = preferred.supplierProfileId;
        bookOnlyName = preferred.tradingName;
        preferredSource = preferred.source;
      }
    }

    if (srmSupplierId && Number.isFinite(srmSupplierId)) {
      const { data: srm } = await supabase
        .from('srm_suppliers')
        .select('id, linked_profile_id, trading_name, status')
        .eq('id', srmSupplierId)
        .eq('profile_id', companyId)
        .maybeSingle();
      if (!srm) {
        return NextResponse.json(
          { error: 'Supplier not found in your book' },
          { status: 404 }
        );
      }
      if (srm.status === 'blocked') {
        return NextResponse.json({ error: 'Supplier is blocked' }, { status: 403 });
      }
      srmId = Number(srm.id);
      if (srm.linked_profile_id) supplierProfileId = Number(srm.linked_profile_id);
      bookOnlyName = srm.trading_name || bookOnlyName;
    }

    if ((!supplierProfileId || !Number.isFinite(supplierProfileId)) && !srmId) {
      return NextResponse.json(
        {
          error:
            'No manufacturer selected and no preferred supplier configured. Pass supplierProfileId / srmSupplierId, or set preferred manufacturer in company settings.',
          code: 'SUPPLIER_REQUIRED',
        },
        { status: 400 }
      );
    }

    const mapped = mapSoItemsToPoItems(so.items, {
      copyPrices: body.copyPrices === true,
      defaultUnitPrice:
        body.defaultUnitPrice != null ? Number(body.defaultUnitPrice) : 0,
    });
    if ('error' in mapped) {
      return NextResponse.json({ error: mapped.error }, { status: 400 });
    }

    const orderQty = mapped.items.reduce((s, i) => s + Number(i.quantity || 0), 0);
    const now = new Date().toISOString();
    const soNumber = so.order_number || `#${salesOrderId}`;

    const payload: Record<string, unknown> = {
      buyer_profile_id: companyId,
      supplier_profile_id: supplierProfileId,
      supplier_id: supplierProfileId || srmId,
      supplier_name: bookOnlyName || body.supplier_name || null,
      total_amount: mapped.total,
      subtotal: mapped.total,
      currency: body.currency || so.currency || 'ZAR',
      description:
        body.description ||
        `Linked from SO ${soNumber}${so.customer_name ? ` · ${so.customer_name}` : ''}`,
      items: mapped.items,
      status,
      payment_terms: body.payment_terms || null,
      promised_date: body.promised_date || so.promised_date || null,
      order_quantity: orderQty,
      source: 'linked_so',
      production_status: null,
      confirmed_qty: null,
      payment_status: 'unpaid',
      amount_paid: 0,
      metadata: {
        linked_from_sales_order_id: salesOrderId,
        linked_from_order_number: so.order_number || null,
        srm_supplier_id: srmId,
        book_only: !supplierProfileId,
        raise_linked_po: true,
        preferred_source: preferredSource,
      },
      created_at: now,
      updated_at: now,
    };

    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .insert(payload)
      .select('*')
      .single();

    if (poErr || !po) {
      console.error('[raise-linked-po] insert', poErr);
      return NextResponse.json(
        { error: poErr?.message || 'Failed to create PO' },
        { status: 500 }
      );
    }

    const { data: link, error: linkErr } = await supabase
      .from('order_links')
      .insert({
        company_id: companyId,
        source_order_id: salesOrderId,
        source_order_type: 'sales_order',
        target_order_id: po.id,
        target_order_type: 'purchase_order',
        link_type: 'fulfillment',
        status: 'active',
        created_by: privyUserId,
        notes: 'Auto-linked from raise-linked-po',
        metadata: { sales_order_number: so.order_number || null },
      })
      .select('*')
      .single();

    if (linkErr) {
      console.error('[raise-linked-po] link', linkErr);
      return NextResponse.json(
        {
          success: true,
          purchaseOrder: po,
          link: null,
          warning: `PO created but link failed: ${linkErr.message}`,
          preferredSource,
        },
        { status: 201 }
      );
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: 'po.created.linked_so',
      entity_type: 'purchase_order',
      entity_id: String(po.id),
      summary: `Linked PO #${po.id} raised from SO ${soNumber}`,
      metadata: {
        sales_order_id: salesOrderId,
        link_id: link?.id,
        supplier_profile_id: supplierProfileId,
        preferred_source: preferredSource,
        status,
      },
    });

    void notifyLinkedPoCreated(supabase, {
      companyId,
      poId: Number(po.id),
      salesOrderId,
      orderNumber: so.order_number,
      supplierProfileId,
      sent: status === 'sent',
    });

    if (status === 'sent' && supplierProfileId) {
      void (async () => {
        try {
          const { data: buyerProf } = await supabase
            .from('profiles')
            .select('trading_name')
            .eq('id', companyId)
            .maybeSingle();
          const { notifyInboundPo } = await import(
            '@/lib/notifications/email-alerts'
          );
          await notifyInboundPo({
            supplierProfileId,
            buyerProfileId: companyId,
            buyerName: buyerProf?.trading_name || null,
            poId: Number(po.id),
            totalAmount: Number(po.total_amount ?? mapped.total),
            currency: String(po.currency || 'ZAR'),
            lineCount: mapped.items.length,
            source: 'linked_so',
          });
        } catch (e) {
          console.warn('raise-linked-po notify soft-fail', e);
        }
      })();
    }

    return NextResponse.json(
      {
        success: true,
        purchaseOrder: po,
        link,
        salesOrderId,
        preferredSource,
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    console.error('[raise-linked-po]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
