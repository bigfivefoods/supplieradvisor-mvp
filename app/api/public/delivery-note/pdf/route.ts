import { NextRequest, NextResponse } from 'next/server';
import { normalizeDeliveryNoteToken } from '@/lib/customers/delivery-note-token';
import {
  buildDeliveryNotePdf,
  deliveryNotePdfFilename,
} from '@/lib/customers/delivery-note-pdf';
import { loadPublicDeliveryNote } from '@/lib/customers/delivery-note-store';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/public/delivery-note/pdf?token=
 * Mobile-friendly A4 PDF. No login. No prices. Not cached, so revoke takes effect immediately.
 */
export async function GET(request: NextRequest) {
  try {
    const rl = checkRateLimit({
      key: `delivery-note:pdf:${request.headers.get('x-forwarded-for') || 'ip'}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!rl.ok) {
      const r = rateLimitResponse(rl.retryAfterSeconds);
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }
    const token = normalizeDeliveryNoteToken(request.nextUrl.searchParams.get('token'));
    const loaded = await loadPublicDeliveryNote(token);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }
    const pdf = await buildDeliveryNotePdf(loaded.view);
    const filename = deliveryNotePdfFilename(loaded.view.number);
    const disposition = request.nextUrl.searchParams.get('download') === '1' ? 'attachment' : 'inline';
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'PDF failed' },
      { status: 500 }
    );
  }
}
