import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getCanonicalUserId, userIdMatchVariants } from '@/lib/auth/identity';
import { requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * GET ?token= — preview invite (public-ish, minimal fields)
 * POST { token, privyUserId, email? } — accept invite & link user
 */
export async function GET(request: NextRequest) {
  try {
    const token = String(request.nextUrl.searchParams.get('token') || '').trim();
    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('container_resellers')
      .select(
        'id, full_name, email, portal_status, verification_status, primary_container_id, profile_id'
      )
      .eq('invite_token', token)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Invite not found or expired' },
        { status: 404 }
      );
    }

    const { data: company } = await supabase
      .from('profiles')
      .select('trading_name, legal_name')
      .eq('id', data.profile_id)
      .maybeSingle();

    let containerName = null;
    if (data.primary_container_id) {
      const { data: c } = await supabase
        .from('containers')
        .select('name, container_code')
        .eq('id', data.primary_container_id)
        .maybeSingle();
      containerName = c?.name || c?.container_code || null;
    }

    return NextResponse.json({
      success: true,
      invite: {
        reseller_id: data.id,
        full_name: data.full_name,
        email: data.email,
        portal_status: data.portal_status,
        verification_status: data.verification_status,
        company_name:
          company?.trading_name || company?.legal_name || 'Container network',
        container_name: containerName,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = String(body.token || '').trim();
    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }

    const auth = await requireVerifiedUser(request, {
      legacyPrivyUserId: body.privyUserId,
    });
    if (!auth.ok) return auth.response;

    const userId = getCanonicalUserId(auth.userId || body.privyUserId);
    const email = body.email ? String(body.email).toLowerCase().trim() : null;

    const supabase = getSupabaseServer();
    const { data: reseller, error } = await supabase
      .from('container_resellers')
      .select('*')
      .eq('invite_token', token)
      .maybeSingle();

    if (error || !reseller) {
      return NextResponse.json(
        { error: 'Invite not found or expired' },
        { status: 404 }
      );
    }

    if (String(reseller.portal_status) === 'suspended') {
      return NextResponse.json(
        { error: 'This reseller account is suspended' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const { data: updated, error: upErr } = await supabase
      .from('container_resellers')
      .update({
        user_id: userId,
        email: email || reseller.email,
        portal_status: 'active',
        contract_accepted_at: now,
        updated_at: now,
      })
      .eq('id', reseller.id)
      .select('*')
      .single();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      reseller: updated,
      message: 'Welcome — open your reseller portal to sell stock.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
