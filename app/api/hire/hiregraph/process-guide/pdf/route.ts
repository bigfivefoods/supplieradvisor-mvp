import { NextRequest, NextResponse } from 'next/server';
import {
  buildHiregraphProcessGuidePdf,
  hiregraphProcessGuideFilename,
} from '@/lib/hire/hiregraph-process-guide';
import type { HiregraphProcessGuideOrientation } from '@/lib/hire/hiregraph-process-guide-links';

export const runtime = 'nodejs';

/**
 * GET /api/hire/hiregraph/process-guide/pdf?orientation=landscape|portrait
 */
export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get('orientation');
    const orientation: HiregraphProcessGuideOrientation =
      raw === 'portrait' ? 'portrait' : 'landscape';
    const buf = await buildHiregraphProcessGuidePdf({ orientation });
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${hiregraphProcessGuideFilename(orientation)}"`,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'PDF failed' },
      { status: 500 }
    );
  }
}
