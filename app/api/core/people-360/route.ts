import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { loadPeople360Bundle } from '@/lib/core-os/server';

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
    const bundle = await loadPeople360Bundle(companyId);
    return NextResponse.json({ success: true, ...bundle });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
