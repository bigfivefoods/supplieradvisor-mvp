import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, clientIp } from '@/lib/http/rate-limit';
import { nsnpSystemOverviewFilename } from '@/lib/schools/nsnp-system-overview';
import { buildNsnpSystemOverviewPdf } from '@/lib/schools/nsnp-system-overview-pdf';
import type { ProcessGuideOrientation } from '@/lib/schools/process-guide-links';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/schools/system-overview/pdf
 *   orientation=landscape|portrait  (default landscape)
 *   download=1                      force attachment
 */
export async function GET(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit(`nsnp-overview-pdf:${ip}`, {
      limit: 40,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfterSec: rl.retryAfterSec },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }

    const sp = request.nextUrl.searchParams;
    const raw = String(sp.get('orientation') || sp.get('layout') || '')
      .toLowerCase()
      .trim();
    const orientation: ProcessGuideOrientation =
      raw === 'portrait' || raw === 'p' || raw === 'vertical'
        ? 'portrait'
        : 'landscape';
    const forceDownload =
      sp.get('download') === '1' || sp.get('download') === 'true';

    const buf = await buildNsnpSystemOverviewPdf({ orientation });
    const filename = nsnpSystemOverviewFilename(orientation);
    const bytes = new Uint8Array(buf);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': forceDownload
          ? `attachment; filename="${filename}"`
          : `inline; filename="${filename}"`,
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'X-System-Overview-Orientation': orientation,
      },
    });
  } catch (e: unknown) {
    console.error('nsnp system overview pdf', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'PDF generation failed' },
      { status: 500 }
    );
  }
}
