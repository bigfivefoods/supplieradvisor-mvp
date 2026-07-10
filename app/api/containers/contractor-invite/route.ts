import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getResend, getResendFrom } from '@/lib/resend';
import { buildContractorInviteLink } from '@/lib/invites/email';
import {
  CONTRACTOR_CONTRACT_VERSION,
  contractorInviteEmailHtml,
} from '@/lib/contracts/independent-contractor-agreement';

/**
 * POST — invite a contractor to operate a specific container.
 * Body: { companyId, containerId, email, full_name?, contractor_id?, companyName?, invitedBy? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const containerId = Number(body.containerId);
    const email = String(body.email || '').toLowerCase().trim();
    const fullName = body.full_name ? String(body.full_name).trim() : null;

    if (!Number.isFinite(companyId) || !Number.isFinite(containerId) || !email) {
      return NextResponse.json(
        { error: 'companyId, containerId, and email are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    const { data: container, error: cErr } = await supabase
      .from('containers')
      .select('id, name, container_code, profile_id')
      .eq('id', containerId)
      .maybeSingle();

    if (cErr || !container) {
      return NextResponse.json({ error: 'Container not found' }, { status: 404 });
    }

    // Ensure contractor row exists
    let contractorId = body.contractor_id ? Number(body.contractor_id) : null;
    if (!contractorId) {
      const { data: existing } = await supabase
        .from('container_contractors')
        .select('id')
        .eq('profile_id', companyId)
        .eq('email', email)
        .maybeSingle();

      if (existing) {
        contractorId = existing.id;
        await supabase
          .from('container_contractors')
          .update({
            full_name: fullName || undefined,
            portal_status: 'invited',
            updated_at: new Date().toISOString(),
          })
          .eq('id', contractorId);
      } else {
        const { data: created, error: createErr } = await supabase
          .from('container_contractors')
          .insert({
            profile_id: companyId,
            full_name: fullName || email.split('@')[0],
            email,
            status: 'active',
            training_status: 'pending',
            portal_status: 'invited',
            invited_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (createErr || !created) {
          return NextResponse.json(
            { error: createErr?.message || 'Failed to create contractor' },
            { status: 500 }
          );
        }
        contractorId = created.id;
      }
    }

    const token = randomUUID();
    const companyName = body.companyName || 'Your company';
    const containerName = container.name || container.container_code || `Container #${containerId}`;

    // Revoke prior pending invites for same container+email
    await supabase
      .from('contractor_invites')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('container_id', containerId)
      .eq('email', email)
      .eq('status', 'pending');

    const { data: invite, error: invErr } = await supabase
      .from('contractor_invites')
      .insert({
        token,
        profile_id: companyId,
        container_id: containerId,
        contractor_id: contractorId,
        email,
        full_name: fullName,
        status: 'pending',
        contract_version: CONTRACTOR_CONTRACT_VERSION,
        invited_by: body.invitedBy || null,
        company_name: companyName,
        container_name: containerName,
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('*')
      .single();

    if (invErr) {
      return NextResponse.json(
        {
          error: invErr.message,
          hint: 'Run supabase/migrations/20260709_contractor_portal.sql in the SQL Editor',
        },
        { status: 500 }
      );
    }

    // Link container to contractor
    await supabase
      .from('containers')
      .update({
        contractor_id: contractorId,
        assigned_contractor: fullName || email,
        updated_at: new Date().toISOString(),
      })
      .eq('id', containerId);

    await supabase
      .from('container_contractors')
      .update({
        invite_token: token,
        invited_at: new Date().toISOString(),
        portal_status: 'invited',
        email,
      })
      .eq('id', contractorId);

    const inviteLink = buildContractorInviteLink(token);

    try {
      const resend = getResend();
      await resend.emails.send({
        from: getResendFrom(),
        to: email,
        subject: `Operate ${containerName} — Independent contractor invitation`,
        html: contractorInviteEmailHtml({
          contractorName: fullName,
          companyName,
          containerName,
          inviteLink,
        }),
      });
    } catch (emailErr: unknown) {
      const msg = emailErr instanceof Error ? emailErr.message : 'Email failed';
      return NextResponse.json({
        success: true,
        warning: `Invite created but email failed: ${msg}`,
        inviteLink,
        invite,
        contractorId,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation sent',
      inviteLink,
      invite,
      contractorId,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Invite failed' },
      { status: 500 }
    );
  }
}

/** GET ?token= — validate invite (public) */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) return NextResponse.json({ valid: false, error: 'Missing token' }, { status: 400 });

    const supabase = getSupabaseServer();
    const { data: invite, error } = await supabase
      .from('contractor_invites')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (error || !invite) {
      return NextResponse.json({ valid: false, error: 'Invalid invitation link' });
    }
    if (invite.status === 'accepted') {
      return NextResponse.json({
        valid: false,
        error: 'This invitation has already been accepted. Please sign in to your operator portal.',
        alreadyAccepted: true,
      });
    }
    if (invite.status !== 'pending') {
      return NextResponse.json({ valid: false, error: 'This invitation is no longer valid.' });
    }
    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ valid: false, error: 'This invitation has expired.' });
    }

    const { data: container } = await supabase
      .from('containers')
      .select('id, name, container_code, city, country, address, photo_url')
      .eq('id', invite.container_id)
      .maybeSingle();

    return NextResponse.json({
      valid: true,
      invite: {
        email: invite.email,
        full_name: invite.full_name,
        company_name: invite.company_name,
        container_name: invite.container_name,
        container_id: invite.container_id,
        contract_version: invite.contract_version,
        expires_at: invite.expires_at,
      },
      container,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { valid: false, error: e instanceof Error ? e.message : 'Validation failed' },
      { status: 500 }
    );
  }
}
