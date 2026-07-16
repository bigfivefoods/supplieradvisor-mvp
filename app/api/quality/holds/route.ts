import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { findLotHolds } from '@/lib/quality/holds';

/**
 * GET ?companyId=&lots=LOT1,LOT2
 * Pre-check QA holds for transfer UI (soft, never blocks the GET).
 */
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

    const lotsParam = request.nextUrl.searchParams.get('lots') || '';
    const lots = lotsParam
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);

    if (!lots.length) {
      return NextResponse.json({
        success: true,
        blocked: false,
        holds: [],
        lots: [],
      });
    }

    const holds = await findLotHolds(companyId, lots);
    const heldLots = [...new Set(holds.map((h) => h.lot_number))];

    return NextResponse.json({
      success: true,
      blocked: holds.length > 0,
      holds,
      lots: heldLots,
      resolve_href: '/dashboard/quality/inspections',
      code: holds.length ? 'QA_HOLD' : null,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
