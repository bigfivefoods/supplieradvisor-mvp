import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { loadDebitBatchBundle } from '@/lib/core-os/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const bundle = await loadDebitBatchBundle(companyId);
    const download = request.nextUrl.searchParams.get('download') === '1';
    if (download) {
      return new NextResponse(bundle.csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="debit-orders-${bundle.action_date}.csv"`,
        },
      });
    }
    return NextResponse.json({
      success: true,
      lines: bundle.lines,
      ready: bundle.ready,
      missing: bundle.missing,
      action_date: bundle.action_date,
      vat_sample: bundle.vat_sample,
      csv: bundle.csv,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
