import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { buildPurchaseOrderPdf } from '@/lib/procurement/po-document-pdf';
import { purchaseOrderPdfFilename } from '@/lib/procurement/po-email';
import { assemblePurchaseOrderPdfInput } from '@/lib/procurement/po-parties';

/**
 * GET ?companyId=&id=
 * Download the same A4 purchase-order PDF used for email.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(companyId) || companyId <= 0 || !Number.isFinite(id) || id <= 0) {
      return NextResponse.json(
        { error: 'companyId and id required' },
        { status: 400 }
      );
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', id)
      .eq('buyer_profile_id', companyId)
      .maybeSingle();
    if (poErr) {
      return NextResponse.json({ error: poErr.message }, { status: 500 });
    }
    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const assembled = await assemblePurchaseOrderPdfInput({
      companyId,
      po: po as Record<string, unknown>,
    });
    const pdfBuffer = await buildPurchaseOrderPdf(assembled.input);
    const filename = purchaseOrderPdfFilename(assembled.input.number);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
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
