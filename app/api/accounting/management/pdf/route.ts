import { NextRequest, NextResponse } from 'next/server';
import { parseCompanyId } from '@/lib/accounting/server';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import {
  buildManagementPack,
  managementPackFilename,
} from '@/lib/accounting/management-pack';
import { buildManagementAccountsPdf } from '@/lib/accounting/management-pack-pdf';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** GET ?companyId=&from=&to=&label=&download=1 */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(
      request.nextUrl.searchParams.get('companyId')
    );
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to');
    if (!from || !to) {
      return NextResponse.json(
        { error: 'from and to (YYYY-MM-DD) are required' },
        { status: 400 }
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json(
        { error: 'from and to must be YYYY-MM-DD' },
        { status: 400 }
      );
    }
    if (from > to) {
      return NextResponse.json(
        { error: 'from must be on or before to' },
        { status: 400 }
      );
    }

    const pack = await buildManagementPack({
      profileId: companyId,
      from,
      to,
      label: request.nextUrl.searchParams.get('label'),
    });
    const buf = await buildManagementAccountsPdf(pack);
    const filename = managementPackFilename(pack);
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
    console.error('management accounts pdf', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'PDF generation failed' },
      { status: 500 }
    );
  }
}
