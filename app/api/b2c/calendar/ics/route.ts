/**
 * SA Member calendar as .ics for Google / Outlook / Apple Calendar.
 * GET ?event=id  — one event
 * GET            — next 90 days
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
import { memberCalendarIcs } from '@/lib/b2c/calendar-links';

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
      return new NextResponse(memberCalendarIcs([]), {
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="sa-member.ics"',
        },
      });
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
    let events = await buildMemberCalendar(memberships);
    const one = request.nextUrl.searchParams.get('event');
    if (one) events = events.filter((e) => e.id === one);
    const ics = memberCalendarIcs(events, 'SA Member');
    return new NextResponse(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${
          one ? 'sa-event.ics' : 'sa-member.ics'
        }"`,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'ICS failed' },
      { status: 500 }
    );
  }
}
