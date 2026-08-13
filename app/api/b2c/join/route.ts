/**
 * GET  ?company=&kind= — preview a desk QR invite
 * POST { company, kind } — accept and join that brand
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { acceptBrandJoin, previewBrandJoin } from '@/lib/b2c/join-brand';
import { loadB2cProfile } from '@/lib/b2c/profile-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('company'));
    const kind = request.nextUrl.searchParams.get('kind');
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'company required' }, { status: 400 });
    }
    const preview = await previewBrandJoin({ companyId, kind });
    if (!preview) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }
    let already = false;
    try {
      const auth = await requireVerifiedUser(request, {
        legacyPrivyUserId: legacyPrivyFrom(request),
      });
      if (auth.ok) {
        const userId = getCanonicalUserId(auth.userId);
        if (userId) {
          const profile = await loadB2cProfile(userId);
          already = Boolean(
            (profile?.memberships || []).some(
              (m) =>
                m.active !== false &&
                m.company_id === companyId &&
                (!kind || m.kind === kind)
            )
          );
        }
      }
    } catch {
      /* preview is public */
    }
    return NextResponse.json({ success: true, ...preview, already });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Preview failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const auth = await requireVerifiedUser(request, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!auth.ok) return auth.response;
    const userId = getCanonicalUserId(auth.userId);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = Number(body.company || body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'company required' }, { status: 400 });
    }
    const result = await acceptBrandJoin({
      userId,
      companyId,
      kind: body.kind ? String(body.kind) : null,
      email: body.email ? String(body.email) : null,
      full_name: body.full_name || body.name ? String(body.full_name || body.name) : null,
      phone: body.phone ? String(body.phone) : null,
    });
    return NextResponse.json({
      success: true,
      already: result.already,
      brand: result.brand,
      membership: result.membership,
      profile: result.profile,
      message: result.already
        ? `You already belong to ${result.brand}`
        : `You joined ${result.brand}`,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Join failed' },
      { status: 400 }
    );
  }
}
