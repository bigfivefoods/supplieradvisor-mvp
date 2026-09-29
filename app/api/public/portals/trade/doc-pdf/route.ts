import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { resolveGuestViewer } from '@/lib/portals/portal-guest';
import { loadCommercialDocument } from '@/lib/customers/load-commercial-doc';
import {
  buildCommercialDocumentPdf,
  commercialPdfFilename,
} from '@/lib/customers/commercial-doc-pdf';

const DOC_TYPES = ['quote', 'order', 'invoice'] as const;
type DocType = (typeof DOC_TYPES)[number];

function isDocType(v: string): v is DocType {
  return (DOC_TYPES as readonly string[]).includes(v);
}

/**
 * GET /api/public/portals/trade/doc-pdf?token=&id=&type=quote|order|invoice
 * Same A4 commercial PDF the seller issued (enquiry, quotation, sales order, invoice).
 */
export async function GET(request: NextRequest) {
  try {
    const token = String(request.nextUrl.searchParams.get('token') || '').trim();
    const id = Number(request.nextUrl.searchParams.get('id'));
    const typeRaw = String(request.nextUrl.searchParams.get('type') || 'invoice')
      .trim()
      .toLowerCase();
    const type: DocType = isDocType(typeRaw) ? typeRaw : 'invoice';
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'ip';
    const rl = checkRateLimit({
      key: `portal-doc-pdf:${token.slice(0, 24)}:${ip}`,
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
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    const customerId = Number(guest.ctx.viewer.customer_id || 0);
    if (!Number.isFinite(id) || id <= 0 || customerId <= 0) {
      return NextResponse.json({ error: 'Document required' }, { status: 400 });
    }
    const loaded = await loadCommercialDocument({
      companyId: guest.ctx.portal.profile_id,
      type,
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
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    const pdf = await buildCommercialDocumentPdf(loaded.input);
    const filename = commercialPdfFilename(loaded.input);
    const safeName = filename.replace(/[^\w.\-]+/g, '_');
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `inline; filename="${safeName}"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'PDF failed' },
      { status: 500 }
    );
  }
}
