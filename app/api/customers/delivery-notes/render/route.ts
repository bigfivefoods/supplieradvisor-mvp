import { NextRequest, NextResponse } from 'next/server';
import { legacyPrivyFrom, requireCompanyAccess } from '@/lib/auth/api-auth';
import { renderDeliveryNoteHtml } from '@/lib/customers/delivery-note-document';
import {
  buildDeliveryNotePdf,
  deliveryNotePdfFilename,
} from '@/lib/customers/delivery-note-pdf';
import { loadSellerDeliveryNote } from '@/lib/customers/delivery-note-store';

/**
 * GET ?companyId=&invoiceId=&noteId=&format=pdf|html
 * Authenticated delivery-note download. HTML and PDF omit prices.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const invoiceId = Number(sp.get('invoiceId'));
    const noteId = String(sp.get('noteId') || '').trim();
    const format = String(sp.get('format') || 'pdf').toLowerCase();
    if (
      !Number.isFinite(companyId) ||
      companyId <= 0 ||
      !Number.isFinite(invoiceId) ||
      invoiceId <= 0 ||
      !noteId
    ) {
      return NextResponse.json(
        { error: 'companyId, invoiceId and noteId required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const loaded = await loadSellerDeliveryNote({ companyId, invoiceId, noteId });
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    if (format === 'html') {
      return new NextResponse(renderDeliveryNoteHtml(loaded.view), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'private, no-store',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      });
    }

    const pdf = await buildDeliveryNotePdf(loaded.view);
    const filename = deliveryNotePdfFilename(loaded.view.number);
    const disposition = sp.get('download') === '1' ? 'attachment' : 'inline';
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
