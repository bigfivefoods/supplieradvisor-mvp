/**
 * B2C consumer wallet API.
 * GET  — profile + memberships (auth required)
 * POST { action: update_profile | unlink }
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  requireVerifiedUser,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  ensureB2cProfile,
  loadB2cProfile,
  removeMembership,
  saveB2cProfile,
} from '@/lib/b2c/profile-store';
import { kindLabel } from '@/lib/b2c/link-token';
import { discoverAndAttachMemberships } from '@/lib/b2c/discover-memberships';
import { buildB2cActivity } from '@/lib/b2c/activity';

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

    const qEmail = request.nextUrl.searchParams.get('email');
    const qPhone = request.nextUrl.searchParams.get('phone');
    const qName = request.nextUrl.searchParams.get('name');

    let profile =
      (await loadB2cProfile(userId)) ||
      (await ensureB2cProfile(userId, {
        email: qEmail,
        phone: qPhone,
        full_name: qName,
      }));

    if (qEmail && !profile.email) profile.email = qEmail;
    if (qPhone && !profile.phone) profile.phone = qPhone;
    if (qName && !profile.full_name) profile.full_name = qName;

    // Auto-attach hire/gym/clinic books that already have this email or phone
    try {
      const found = await discoverAndAttachMemberships(profile, {
        email: profile.email || qEmail,
        phone: profile.phone || qPhone,
        platformUserId: userId,
      });
      if (found.attached > 0) {
        profile = found.profile;
        await saveB2cProfile(profile);
      }
    } catch {
      /* discover is best-effort */
    }

    const memberships = (profile.memberships || [])
      .filter((m) => m.active !== false)
      .map((m) => ({
        ...m,
        kind_label: kindLabel(m.kind),
      }));

    let activity: Awaited<ReturnType<typeof buildB2cActivity>> = [];
    try {
      activity = await buildB2cActivity(memberships);
    } catch {
      activity = [];
    }

    const docs = activity.filter((a) => a.tone === 'docs' || a.tone === 'alert');

    return NextResponse.json({
      success: true,
      profile: {
        ...profile,
        memberships,
      },
      activity,
      stats: {
        memberships: memberships.length,
        hire: memberships.filter((m) => m.kind === 'hire').length,
        gym: memberships.filter((m) => m.kind === 'gym').length,
        clinic: memberships.filter((m) =>
          ['physio', 'dental', 'medical', 'psychiatry'].includes(m.kind)
        ).length,
        needs_attention: docs.length,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Load failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const auth = await requireVerifiedUser(request, {
      legacyPrivyUserId:
        body.privyUserId || body.userId || legacyPrivyFrom(request, body),
    });
    if (!auth.ok) return auth.response;
    const userId = getCanonicalUserId(auth.userId);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const action = String(body.action || 'update_profile');
    let profile = (await loadB2cProfile(userId)) || (await ensureB2cProfile(userId));

    if (action === 'unlink' || action === 'remove_membership') {
      const mid = String(body.membership_id || body.id || '');
      if (!mid) {
        return NextResponse.json(
          { error: 'membership_id required' },
          { status: 400 }
        );
      }
      profile = removeMembership(profile, mid);
      await saveB2cProfile(profile);
      return NextResponse.json({
        success: true,
        profile,
        message: 'Membership unlinked',
      });
    }

    // update_profile
    if (body.email != null) profile.email = String(body.email).trim() || null;
    if (body.full_name != null || body.name != null) {
      profile.full_name = String(body.full_name || body.name || '').trim() || null;
    }
    if (body.phone != null) profile.phone = String(body.phone).trim() || null;
    if (body.photo_url != null) {
      profile.photo_url = String(body.photo_url).trim() || null;
    }
    await saveB2cProfile(profile);
    return NextResponse.json({
      success: true,
      profile,
      message: 'Profile saved',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Save failed' },
      { status: 500 }
    );
  }
}
