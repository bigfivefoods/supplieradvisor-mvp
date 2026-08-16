import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import {
  buildInventoryReportPack,
  inventoryReportFilename,
} from '@/lib/inventory/report-pack';
import { buildInventoryReportPdf } from '@/lib/inventory/report-pack-pdf';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** GET ?companyId=&download=1 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const pack = await buildInventoryReportPack({ profileId: companyId });
    const buf = await buildInventoryReportPdf(pack);
    const filename = inventoryReportFilename(pack);
    const forceDownload =
      request.nextUrl.searchParams.get('download') === '1' ||
      request.nextUrl.searchParams.get('download') === 'true';

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${forceDownload ? 'attachment' : 'inline'}; filename="${filename}"`,
        'Content-Length': String(buf.byteLength),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e: unknown) {
    console.error('inventory report pdf', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'PDF generation failed' },
      { status: 500 }
    );
  }
}
