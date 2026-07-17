import { NextRequest, NextResponse } from 'next/server';
import { parseDocShareToken } from '@/lib/customers/doc-share-token';
import { loadCommercialDocument } from '@/lib/customers/load-commercial-doc';
import {
  buildCommercialDocumentPdf,
  commercialPdfFilename,
} from '@/lib/customers/commercial-doc-pdf';

/**
 * GET /api/public/docs/pdf?token=
 * Public signed PDF for WhatsApp / email links (no auth).
 */
export async function GET(request: NextRequest) {
  try {
    const token = String(request.nextUrl.searchParams.get('token') || '').trim();
    const payload = parseDocShareToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired document link' },
        { status: 403 }
      );
    }

    const loaded = await loadCommercialDocument({
      companyId: payload.companyId,
      type: payload.type,
      id: payload.id,
    });
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    const pdf = await buildCommercialDocumentPdf(loaded.input);
    const filename = commercialPdfFilename(loaded.input);
    // inline = open as PDF document (WhatsApp / browsers), not forced download UX
    const safeName = filename.replace(/[^\w.\-]+/g, '_');

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'public, max-age=300',
        // Help WhatsApp / Twilio fetch the file as a document attachment
        'Access-Control-Allow-Origin': '*',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'PDF failed' },
      { status: 500 }
    );
  }
}
