import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { requireVerifiedUser, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';

/**
 * POST { public_id, invite_token, contact_name?, contact_phone? }
 * Activates an invited supplier. Requires Privy session + high-entropy invite token
 * (same bar as /api/invites/claim). Dummy passwords are not collected.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const publicId = String(body.public_id || '').trim();
    const inviteToken = String(body.invite_token || body.token || '').trim();
    const contactName = String(body.contact_name || '').trim();
    const contactPhone = String(body.contact_phone || '').trim();

    if (!publicId) {
      return NextResponse.json({ error: 'public_id required' }, { status: 400 });
    }
    if (inviteToken.length < 16) {
      return NextResponse.json(
        { error: 'A valid invite token is required.' },
        { status: 400 }
      );
    }

    const auth = await requireVerifiedUser(request, {
      legacyPrivyUserId: body.privyUserId || legacyPrivyFrom(request),
    });
    if (!auth.ok) return auth.response;
    const userId = getCanonicalUserId(auth.userId);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const rl = checkRateLimit({
      key: `join-claim:${userId}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      const r = rateLimitResponse(rl.retryAfterSeconds);
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }

    const supabase = getSupabaseServer();
    const { data: profile, error: findErr } = await supabase
      .from('profiles')
      .select('id, public_id, trading_name, supplier_status, email, invite_token')
      .eq('public_id', publicId)
      .eq('invite_token', inviteToken)
      .maybeSingle();

    if (findErr) {
      return NextResponse.json({ error: findErr.message }, { status: 500 });
    }
    if (!profile) {
      return NextResponse.json(
        { error: 'This invitation link is invalid or has expired.' },
        { status: 404 }
      );
    }
    const status = String(profile.supplier_status || '').toLowerCase();
    if (status === 'active') {
      return NextResponse.json(
        { error: 'This supplier has already joined SupplierAdvisor.' },
        { status: 409 }
      );
    }
    if (status && status !== 'invited' && status !== 'pending') {
      return NextResponse.json(
        { error: 'This invitation link is invalid or has expired.' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const { data: claimed, error: updateError } = await supabase
      .from('profiles')
      .update({
        supplier_status: 'active',
        claimed_at: now,
        contact_name: contactName || null,
        contact_phone: contactPhone || null,
        user_id: userId,
        invite_token: null,
        updated_at: now,
      })
      .eq('id', profile.id)
      .eq('public_id', publicId)
      .eq('invite_token', inviteToken)
      .in('supplier_status', ['invited', 'pending'])
      .select('id')
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    if (!claimed) {
      return NextResponse.json(
        { error: 'This invitation has already been claimed.' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Profile claimed.',
      trading_name: profile.trading_name,
      profileId: profile.id,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
