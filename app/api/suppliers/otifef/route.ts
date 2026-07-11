import { NextRequest, NextResponse } from 'next/server';
import { computeBuyerOtifef, persistScorecards } from '@/lib/suppliers/otifef';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * GET ?companyId=&from=&to=&persist=1
 * Live OTIFEF portfolio + per-supplier rows. Optionally write scorecards.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = sp.get('companyId') ? Number(sp.get('companyId')) : null;
    const persist = sp.get('persist') === '1' || sp.get('persist') === 'true';

    const to = sp.get('to') || new Date().toISOString().slice(0, 10);
    let from = sp.get('from');
    if (!from) {
      const d = new Date(to);
      d.setFullYear(d.getFullYear() - 1);
      from = d.toISOString().slice(0, 10);
    }

    const result = await computeBuyerOtifef({
      buyerProfileId: companyId,
      fromDate: from,
      toDate: to,
    });

    if (persist && companyId && Number.isFinite(companyId) && result.rows.length) {
      await persistScorecards({
        buyerProfileId: companyId,
        fromDate: from,
        toDate: to,
        rows: result.rows,
      });
    }

    return NextResponse.json({
      success: true,
      from,
      to,
      summary: result.summary,
      rows: result.rows,
      warning: result.warning,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
