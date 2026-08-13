/**
 * GET /api/b2c/care — upcoming bookings, clinic cards, shared medical summaries.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { loadB2cProfile } from '@/lib/b2c/profile-store';
import { buildB2cCare } from '@/lib/b2c/care';

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
    const memberships = (profile?.memberships || []).filter(
      (m) => m.active !== false
    );
    const care = await buildB2cCare(memberships);
    return NextResponse.json({ success: true, ...care });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Load failed' },
      { status: 500 }
    );
  }
}
