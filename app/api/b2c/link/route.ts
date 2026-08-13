/**
 * Link a hire/gym portal token into the logged-in B2C wallet.
 * POST { token | url, email?, full_name?, phone? }
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  requireVerifiedUser,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  ensureB2cProfile,
  saveB2cProfile,
  upsertMembership,
} from '@/lib/b2c/profile-store';
import { resolveAndLinkPortalToken } from '@/lib/b2c/link-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({
      key: `b2c-link:${ip}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      );
    }

    const body = await request.json();
    const auth = await requireVerifiedUser(request, {
      legacyPrivyUserId:
        body.privyUserId || body.userId || legacyPrivyFrom(request, body),
    });
    if (!auth.ok) return auth.response;
    const userId = getCanonicalUserId(auth.userId);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = String(body.token || body.url || body.link || '').trim();
    if (!token) {
      return NextResponse.json(
        {
          error:
            'Paste your hire or gym portal link (or token) to link this account',
        },
        { status: 400 }
      );
    }

    const resolved = await resolveAndLinkPortalToken(token, userId);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    let profile = await ensureB2cProfile(userId, {
      email: body.email ? String(body.email) : null,
      full_name: body.full_name || body.name ? String(body.full_name || body.name) : null,
      phone: body.phone ? String(body.phone) : null,
    });
    profile = upsertMembership(profile, resolved.membership);
    if (!profile.email && resolved.membership.email) {
      profile.email = resolved.membership.email;
    }
    if (!profile.full_name && resolved.membership.ref_label) {
      profile.full_name = resolved.membership.ref_label;
    }
    await saveB2cProfile(profile);

    return NextResponse.json({
      success: true,
      membership: resolved.membership,
      brand: resolved.brand,
      profile,
      message: `Linked to ${resolved.brand}`,
      portal_path: resolved.membership.portal_path,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Link failed' },
      { status: 500 }
    );
  }
}
