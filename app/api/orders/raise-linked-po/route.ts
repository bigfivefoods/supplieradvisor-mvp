import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, logActivity } from '@/lib/customers/access';
import {
  raiseFulfillmentPosFromSo,
  raiseLinkedPoFromSo,
  type RaiseLinkedPoInput,
} from '@/lib/orders/raise-linked-po';

/**
 * POST /api/orders/raise-linked-po
 * One-click: create a PO from a Sales Order and create an active order_link.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const companyId = Number(body.companyId);
    const salesOrderId = Number(body.salesOrderId);
    const privyUserId = body.privyUserId as string | undefined;
    const status: 'draft' | 'sent' = body.status === 'sent' ? 'sent' : 'draft';

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
    const pickedSupplier =
      (body.srmSupplierId && Number(body.srmSupplierId) > 0) ||
      (body.supplierProfileId && Number(body.supplierProfileId) > 0);
    const args: RaiseLinkedPoInput = {
      supabase,
      companyId,
      salesOrderId,
      status,
      createdBy: privyUserId,
      srmSupplierId: body.srmSupplierId ? Number(body.srmSupplierId) : null,
      supplierProfileId: body.supplierProfileId
        ? Number(body.supplierProfileId)
        : null,
      allowMultipleLinks: body.allowMultipleLinks === true,
      promisedDate: body.promised_date ? String(body.promised_date) : null,
      paymentTerms: body.payment_terms ? String(body.payment_terms) : null,
    };
    const result = pickedSupplier
      ? await raiseLinkedPoFromSo(args)
      : await raiseFulfillmentPosFromSo(args);

    if (result.skipped && result.code === 'ALREADY_LINKED') {
      return NextResponse.json(
        {
          error: `SO already linked to PO #${result.purchaseOrder?.id}. Unlink first or pass allowMultipleLinks: true.`,
          code: 'ALREADY_LINKED',
          existingLink: { target_order_id: result.purchaseOrder?.id },
        },
        { status: 409 }
      );
    }
    if (!result.ok) {
      const statusCode =
        result.code === 'SO_NOT_FOUND' || result.code === 'SUPPLIER_NOT_FOUND'
          ? 404
          : result.code === 'SUPPLIER_BLOCKED'
            ? 403
            : 400;
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: statusCode }
      );
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: 'po.created.linked_so',
      entity_type: 'purchase_order',
      entity_id: String(result.purchaseOrder?.id || ''),
      summary: `Linked PO #${result.purchaseOrder?.id} raised from SO ${salesOrderId}`,
      metadata: {
        sales_order_id: salesOrderId,
        link_id: result.link?.id,
        preferred_source: result.preferredSource,
        status,
      },
    });

    return NextResponse.json(
      {
        success: true,
        purchaseOrder: result.purchaseOrder,
        link: result.link,
        salesOrderId,
        preferredSource: result.preferredSource,
        warning: result.warning,
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
