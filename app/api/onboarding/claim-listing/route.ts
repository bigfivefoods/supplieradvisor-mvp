import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { requireVerifiedUser, legacyPrivyFrom } from '@/lib/auth/api-auth';

/**
 * POST { claimProfileId, privyUserId?, contact_name?, contact_email?, contact_phone? }
 * Attach the signed-in user as owner of an existing public directory profile
 * when it has no active owner membership (true claim).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const claimProfileId = Number(body.claimProfileId || body.claim || body.id);
    if (!Number.isFinite(claimProfileId) || claimProfileId <= 0) {
      return NextResponse.json(
        { error: 'claimProfileId required' },
        { status: 400 }
      );
    }

    const auth = await requireVerifiedUser(request, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!auth.ok) return auth.response;
    const userId = getCanonicalUserId(auth.userId);
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, email, user_id, claimed_at, is_discoverable'
      )
      .eq('id', claimProfileId)
      .maybeSingle();

    if (pErr || !profile) {
      return NextResponse.json(
        { error: pErr?.message || 'Company not found' },
        { status: 404 }
      );
    }

    // Existing active owners?
    const { data: owners } = await supabase
      .from('business_users')
      .select('id, user_id, role, status')
      .eq('profile_id', claimProfileId)
      .eq('status', 'active')
      .in('role', ['owner', 'admin'])
      .limit(10);

    const activeOwners = (owners || []).filter((o) => o.user_id);
    const alreadyMine = activeOwners.some(
      (o) => String(o.user_id) === String(userId)
    );
    if (alreadyMine) {
      return NextResponse.json({
        success: true,
        alreadyOwner: true,
        profileId: claimProfileId,
        tradingName: profile.trading_name,
        message: 'You already manage this company.',
      });
    }

    if (activeOwners.length > 0) {
      return NextResponse.json(
        {
          error:
            'This listing already has an owner. Sign in as that team, or connect as a partner.',
          code: 'ALREADY_CLAIMED',
          profileId: claimProfileId,
          connectHref: `/c/${claimProfileId}`,
        },
        { status: 409 }
      );
    }

    // Soft: if profile.user_id set to someone else, block
    if (
      profile.user_id &&
      String(profile.user_id) !== String(userId) &&
      String(profile.user_id).length > 5
    ) {
      return NextResponse.json(
        {
          error: 'This company is linked to another account.',
          code: 'ALREADY_CLAIMED',
          profileId: claimProfileId,
        },
        { status: 409 }
      );
    }

    const email = String(
      body.contact_email || profile.email || ''
    )
      .toLowerCase()
      .trim();
    const contactName = body.contact_name
      ? String(body.contact_name).slice(0, 120)
      : null;

    // Attach ownership
    const { error: memErr } = await supabase.from('business_users').insert({
      user_id: userId,
      profile_id: claimProfileId,
      role: 'owner',
      status: 'active',
      name: contactName,
      email: email || null,
      joined_at: now,
      created_at: now,
    });

    if (memErr) {
      // Maybe already member as viewer
      if (/duplicate|unique/i.test(memErr.message || '')) {
        await supabase
          .from('business_users')
          .update({
            role: 'owner',
            status: 'active',
            joined_at: now,
          })
          .eq('profile_id', claimProfileId)
          .eq('user_id', userId);
      } else {
        return NextResponse.json(
          { error: memErr.message || 'Could not attach ownership' },
          { status: 500 }
        );
      }
    }

    const patch: Record<string, unknown> = {
      user_id: userId,
      claimed_at: now,
      supplier_status: 'active',
      is_discoverable: true,
      updated_at: now,
    };
    if (contactName) patch.contact_name = contactName;
    if (email) patch.email = email;
    if (body.contact_phone) patch.contact_phone = String(body.contact_phone).slice(0, 40);
    if (body.trading_name) patch.trading_name = String(body.trading_name).slice(0, 200);

    const { error: upErr } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', claimProfileId);

    if (upErr && /column|schema/i.test(upErr.message || '')) {
      // Minimal patch
      await supabase
        .from('profiles')
        .update({ user_id: userId, updated_at: now })
        .eq('id', claimProfileId);
    }

    void supabase.from('activity_log').insert({
      profile_id: claimProfileId,
      actor_user_id: userId,
      action: 'listing.claimed',
      entity_type: 'profiles',
      entity_id: String(claimProfileId),
      summary: `Listing claimed by ${email || userId}`,
      metadata: { claimProfileId },
    });

    return NextResponse.json({
      success: true,
      claimed: true,
      profileId: claimProfileId,
      tradingName: profile.trading_name,
      message: 'Listing claimed — you are now the owner.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
