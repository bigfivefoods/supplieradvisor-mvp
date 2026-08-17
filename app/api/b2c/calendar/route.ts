/**
 * SA Member combined diary.
 * GET — upcoming hire / gym / clinic events
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  requireVerifiedUser,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { loadB2cProfile } from '@/lib/b2c/profile-store';
import { isWalletVisibleMembership } from '@/lib/b2c/company-modules';
import {
  loadBusinessWorkspaceSummary,
  operatorCompanyIds,
} from '@/lib/b2c/workspace';
import { buildMemberCalendar } from '@/lib/b2c/member-calendar';
import {
  googleCalendarUrl,
  outlookCalendarUrl,
} from '@/lib/b2c/calendar-links';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireVerifiedUser(request, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!auth.ok) return auth.response;
    const userId = getCanonicalUserId(auth.userId);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const profile = await loadB2cProfile(userId);
    if (!profile) {
      return NextResponse.json({ success: true, events: [] });
    }
    let owned: number[] = [];
    try {
      const ws = await loadBusinessWorkspaceSummary(userId);
      owned = operatorCompanyIds(ws);
    } catch {
      owned = [];
    }
    const memberships = (profile.memberships || []).filter((m) =>
      isWalletVisibleMembership(m, owned)
    );
    const events = await buildMemberCalendar(memberships);
    return NextResponse.json({
      success: true,
      events: events.map((e) => ({
        ...e,
        google_url: googleCalendarUrl(e),
        outlook_url: outlookCalendarUrl(e),
      })),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Load failed' },
      { status: 500 }
    );
  }
}
