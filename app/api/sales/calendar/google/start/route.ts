import { NextRequest, NextResponse } from 'next/server';
import { legacyPrivyFrom, requireCompanyAccess } from '@/lib/auth/api-auth';
import { googleAuthUrl } from '@/lib/sales/calendar-google';
import { googleConfigured, signCalendarState } from '@/lib/sales/calendar-secrets';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const companyId = Number(request.nextUrl.searchParams.get('companyId'));
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 });
  }
  const access = await requireCompanyAccess(request, companyId, {
    legacyPrivyUserId: legacyPrivyFrom(request),
  });
  if (!access.ok) return access.response;
  if (!googleConfigured()) {
    return NextResponse.json(
      { error: 'Google Calendar sign-in is not configured on the server' },
      { status: 503 }
    );
  }
  const state = signCalendarState({ companyId, userId: access.userId, provider: 'google' });
  return NextResponse.redirect(googleAuthUrl(state));
}
