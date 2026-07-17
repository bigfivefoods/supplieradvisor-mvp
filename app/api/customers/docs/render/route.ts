import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { loadCommercialDocument } from '@/lib/customers/load-commercial-doc';
import {
  buildCommercialDocumentPdf,
  commercialPdfFilename,
} from '@/lib/customers/commercial-doc-pdf';

/**
 * GET ?companyId=&type=invoice|quote|order&id=&format=html|pdf
 * Default format=html (print-ready). format=pdf returns real PDF (pdfkit).
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const id = Number(sp.get('id'));
    const type = String(sp.get('type') || 'invoice').toLowerCase() as
      | 'quote'
      | 'order'
      | 'invoice';
    const format = String(sp.get('format') || 'html').toLowerCase();

    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'companyId, type, id required' },
        { status: 400 }
      );
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const loaded = await loadCommercialDocument({ companyId, type, id });
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    if (format === 'pdf') {
      const pdf = await buildCommercialDocumentPdf(loaded.input);
      const filename = commercialPdfFilename(loaded.input);
      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return new NextResponse(loaded.html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
