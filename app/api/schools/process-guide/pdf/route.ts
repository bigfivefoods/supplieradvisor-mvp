import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, clientIp } from '@/lib/http/rate-limit';
import {
  buildNsnpProcessGuidePdf,
  nsnpProcessGuideFilename,
  parseProcessGuideOrientation,
} from '@/lib/schools/nsnp-process-guide';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/schools/process-guide/pdf
 *
 * Query:
 *   orientation=landscape|portrait  (default landscape)
 *   download=1                      force attachment download
 */
export async function GET(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit(`nsnp-process-pdf:${ip}`, {
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
    const orientation = parseProcessGuideOrientation(
      sp.get('orientation') || sp.get('layout')
    );
    const forceDownload =
      sp.get('download') === '1' || sp.get('download') === 'true';

    const buf = await buildNsnpProcessGuidePdf({ orientation });
    const filename = nsnpProcessGuideFilename(orientation);
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
        'X-Process-Guide-Orientation': orientation,
      },
    });
  } catch (e: unknown) {
    console.error('nsnp process guide pdf', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'PDF generation failed' },
      { status: 500 }
    );
  }
}
