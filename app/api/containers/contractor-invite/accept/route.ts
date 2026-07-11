import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { CONTRACTOR_CONTRACT_VERSION } from '@/lib/contracts/independent-contractor-agreement';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * POST — accept contractor invite after Privy login + contract agreement
 * Body: { token, privyUserId, email?, full_name?, contractAccepted: true }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = body.token;
    const userId = getCanonicalUserId(body.privyUserId);
    const email = body.email ? String(body.email).toLowerCase().trim() : null;

    if (!token || !userId) {
      return NextResponse.json({ error: 'token and authenticated user are required' }, { status: 400 });
    }
    if (!body.contractAccepted) {
      return NextResponse.json(
        { error: 'You must accept the Independent Contractor Agreement to continue.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { data: invite, error } = await supabase
      .from('contractor_invites')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (error || !invite) {
      return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 });
    }
    if (invite.status === 'accepted' && invite.user_id === userId) {
      return NextResponse.json({
        success: true,
        alreadyAccepted: true,
        contractorId: invite.contractor_id,
        containerId: invite.container_id,
      });
    }
    if (invite.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation is no longer pending' }, { status: 409 });
    }
    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Invitation expired' }, { status: 410 });
    }

    if (email && invite.email && email !== String(invite.email).toLowerCase()) {
      return NextResponse.json(
        {
          error: `Please sign in with the invited email (${invite.email}). You are signed in as ${email}.`,
          expectedEmail: invite.email,
        },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const fullName = body.full_name || invite.full_name;

    // Update invite
    const { error: invUpd } = await supabase
      .from('contractor_invites')
      .update({
        status: 'accepted',
        user_id: userId,
        contract_accepted_at: now,
        contract_version: CONTRACTOR_CONTRACT_VERSION,
        accepted_at: now,
        full_name: fullName,
        updated_at: now,
      })
      .eq('id', invite.id)
      .eq('token', token);

    if (invUpd) {
      return NextResponse.json({ error: invUpd.message }, { status: 500 });
    }

    // Activate contractor portal identity
    if (invite.contractor_id) {
      const { error: cErr } = await supabase
        .from('container_contractors')
        .update({
          user_id: userId,
          email: invite.email,
          full_name: fullName || undefined,
          portal_status: 'active',
          contract_accepted_at: now,
          contract_version: CONTRACTOR_CONTRACT_VERSION,
          invite_token: null,
          status: 'active',
          updated_at: now,
        })
        .eq('id', invite.contractor_id);
      if (cErr) {
        console.error('contractor activate error:', cErr);
        return NextResponse.json(
          {
            error: 'Invitation accepted but could not activate portal access',
            details: cErr.message,
          },
          { status: 500 }
        );
      }
    }

    // Ensure container assignment
    if (invite.container_id) {
      const { error: contErr } = await supabase
        .from('containers')
        .update({
          contractor_id: invite.contractor_id,
          assigned_contractor: fullName || invite.email,
          updated_at: now,
        })
        .eq('id', invite.container_id);
      if (contErr) {
        console.warn('container assignment warning:', contErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Contract accepted. Welcome to your operator portal.',
      contractorId: invite.contractor_id,
      containerId: invite.container_id,
      contractVersion: CONTRACTOR_CONTRACT_VERSION,
      redirectTo: '/contractor',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Accept failed' },
      { status: 500 }
    );
  }
}
