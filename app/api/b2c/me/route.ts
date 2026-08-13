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

    let profile = await loadB2cProfile(userId);
    if (!profile) {
      profile = await ensureB2cProfile(userId);
    }

    const memberships = (profile.memberships || [])
      .filter((m) => m.active !== false)
      .map((m) => ({
        ...m,
        kind_label: kindLabel(m.kind),
      }));

    return NextResponse.json({
      success: true,
      profile: {
        ...profile,
        memberships,
      },
      stats: {
        memberships: memberships.length,
        hire: memberships.filter((m) => m.kind === 'hire').length,
        gym: memberships.filter((m) => m.kind === 'gym').length,
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
