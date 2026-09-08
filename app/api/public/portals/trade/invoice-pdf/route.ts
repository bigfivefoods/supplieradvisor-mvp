import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { resolveGuestViewer } from '@/lib/portals/portal-guest';
import { loadCommercialDocument } from '@/lib/customers/load-commercial-doc';
import {
  buildCommercialDocumentPdf,
  commercialPdfFilename,
} from '@/lib/customers/commercial-doc-pdf';

/**
 * GET /api/public/portals/trade/invoice-pdf?token=&id=
 * Same A4 tax invoice PDF the seller issued. Guest/host customer portal token.
 */
export async function GET(request: NextRequest) {
  try {
    const token = String(request.nextUrl.searchParams.get('token') || '').trim();
    const id = Number(request.nextUrl.searchParams.get('id'));
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'ip';
    const rl = checkRateLimit({
      key: `portal-inv-pdf:${token.slice(0, 24)}:${ip}`,
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
    if (guest.ctx.portal.kind !== 'customer') {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    const customerId = Number(guest.ctx.viewer.customer_id || 0);
    if (!Number.isFinite(id) || id <= 0 || customerId <= 0) {
      return NextResponse.json({ error: 'Invoice required' }, { status: 400 });
    }
    const companyId = guest.ctx.portal.profile_id;
    const loaded = await loadCommercialDocument({
      companyId,
      type: 'invoice',
      id,
    });
    if (!loaded.ok) {
      return NextResponse.json(
        { error: loaded.error },
        { status: loaded.status }
      );
    }
    const owner = Number(
      (loaded.doc as { customer_id?: unknown }).customer_id || 0
    );
    if (owner !== customerId) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    const pdf = await buildCommercialDocumentPdf(loaded.input);
    const filename = commercialPdfFilename(loaded.input);
    const safeName = filename.replace(/[^\w.\-]+/g, '_');
    return new NextResponse(new Uint8Array(pdf), {
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
