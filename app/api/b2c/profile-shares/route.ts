/**
 * Member-owned profile shares.
 * GET  — pending / active grants
 * POST { action: consent | decline | revoke | request }
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { loadB2cProfile } from '@/lib/b2c/profile-store';
import {
  decideProfileShare,
  isAdvisorShareKind,
  memberShareTargets,
  readMemberShares,
  requestProfileShare,
} from '@/lib/b2c/profile-shares';

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
    const shares = profile ? readMemberShares(profile) : [];
    return NextResponse.json({
      success: true,
      pending: shares.filter((s) => s.status === 'pending'),
      active: shares.filter((s) => s.status === 'active'),
      history: shares.filter(
        (s) => s.status === 'declined' || s.status === 'revoked'
      ),
      targets: profile ? memberShareTargets(profile) : [],
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
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || '');

    if (action === 'request') {
      const fromKind = body.from_kind;
      const toKind = body.to_kind;
      if (!isAdvisorShareKind(fromKind) || !isAdvisorShareKind(toKind)) {
        return NextResponse.json({ error: 'Pick two Advisor desks' }, { status: 400 });
      }
      const fromRef = String(body.from_ref_id || '');
      const fromCo = Number(body.from_company_id);
      const toCo = Number(body.to_company_id);
      if (!fromRef || !Number.isFinite(fromCo) || !Number.isFinite(toCo)) {
        return NextResponse.json({ error: 'Missing share pair' }, { status: 400 });
      }
      const result = await requestProfileShare({
        profile,
        fromCompanyId: fromCo,
        fromKind,
        fromRefId: fromRef,
        toCompanyId: toCo,
        toKind,
        requestedBy: 'member',
        note: body.note ? String(body.note) : null,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        share: result.share,
        message: `Shared with ${result.share.to_company_name}`,
      });
    }

    const shareId = String(body.share_id || body.shareId || '');
    if (!shareId) {
      return NextResponse.json({ error: 'share_id required' }, { status: 400 });
    }
    const status =
      action === 'consent' || action === 'approve'
        ? 'active'
        : action === 'decline'
          ? 'declined'
          : action === 'revoke'
            ? 'revoked'
            : null;
    if (!status) {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
    const result = await decideProfileShare({ profile, shareId, status });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      share: result.share,
      message:
        status === 'active'
          ? 'Share approved'
          : status === 'declined'
            ? 'Share declined'
            : 'Share revoked',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Save failed' },
      { status: 500 }
    );
  }
}
