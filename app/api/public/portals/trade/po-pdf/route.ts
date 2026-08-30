import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { resolveGuestViewer } from '@/lib/portals/portal-guest';
import { buildPurchaseOrderPdf } from '@/lib/procurement/po-document-pdf';
import { purchaseOrderPdfFilename } from '@/lib/procurement/po-email';
import { assemblePurchaseOrderPdfInput } from '@/lib/procurement/po-parties';
import {
  poBelongsToSupplierViewer,
  poHostedByBuyer,
} from '@/lib/portals/supplier-portal-party';

/**
 * GET /api/public/portals/trade/po-pdf?token=&id=
 * Same A4 PO PDF the buyer emailed (Brief 16). Guest/host portal token.
 */
export async function GET(request: NextRequest) {
  try {
    const token = String(request.nextUrl.searchParams.get('token') || '').trim();
    const id = Number(request.nextUrl.searchParams.get('id'));
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'ip';
    const rl = checkRateLimit({
      key: `portal-po-pdf:${token.slice(0, 24)}:${ip}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      const r = rateLimitResponse(rl.retryAfterSeconds);
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }
    const guest = await resolveGuestViewer(token);
    if (!guest.ok) {
      return NextResponse.json({ error: guest.error }, { status: guest.status });
    }
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Purchase order required' }, { status: 400 });
    }
    const companyId = guest.ctx.portal.profile_id;
    const supabase = getSupabaseServer();
    const { data: po, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!po || !poHostedByBuyer(po as Record<string, unknown>, companyId)) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }
    if (guest.ctx.portal.kind === 'supplier') {
      const belongs = poBelongsToSupplierViewer(po as Record<string, unknown>, {
        supplierId: Number(guest.ctx.viewer.supplier_id || 0),
        linkedProfileId: guest.ctx.linkedProfileId,
      });
      if (!belongs) {
        return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
      }
    }
    const assembled = await assemblePurchaseOrderPdfInput({
      companyId,
      po: po as Record<string, unknown>,
    });
    const pdfBuffer = await buildPurchaseOrderPdf(assembled.input);
    const filename = purchaseOrderPdfFilename(assembled.input.number);
    const safeName = filename.replace(/[^\w.\-]+/g, '_');
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeName}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'PDF failed' },
      { status: 500 }
    );
  }
}
