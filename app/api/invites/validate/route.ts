import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isInviteExpired } from '@/lib/auth/identity';

/**
 * GET /api/invites/validate?token=...&kind=business|team
 * Public — returns safe invite metadata for claim UI.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    const kind = (request.nextUrl.searchParams.get('kind') || 'business') as 'business' | 'team';

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Missing invitation token' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (kind === 'team') {
      const { data, error } = await supabase
        .from('business_users')
        .select('id, name, invited_email, email, role, status, invite_token, created_at, profile_id, invited_at')
        .eq('invite_token', token)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json({ valid: false, error: 'This invitation is invalid or has already been used.' });
      }

      if (data.status !== 'invited' && data.status !== 'pending') {
        return NextResponse.json({ valid: false, error: 'This invitation has already been accepted.' });
      }

      if (isInviteExpired(data.invited_at || data.created_at)) {
        return NextResponse.json({ valid: false, error: 'This invitation has expired. Ask your admin to resend it.' });
      }

      let companyName = 'the company';
      if (data.profile_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('trading_name, legal_name')
          .eq('id', data.profile_id)
          .maybeSingle();
        companyName = profile?.trading_name || profile?.legal_name || companyName;
      }

      return NextResponse.json({
        valid: true,
        kind: 'team',
        invitation: {
          email: data.invited_email || data.email,
          name: data.name,
          role: data.role || 'member',
          companyName,
          profileId: data.profile_id,
        },
      });
    }

    // business / supplier org invite
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, email, contact_name, contact_phone, supplier_status, invite_token, invited_at, created_at, relationship_type, invited_by'
      )
      .eq('invite_token', token)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ valid: false, error: 'This invitation is invalid or has already been used.' });
    }

    if (data.supplier_status !== 'invited' && data.supplier_status !== 'pending') {
      return NextResponse.json({ valid: false, error: 'This invitation has already been claimed.' });
    }

    if (isInviteExpired(data.invited_at || data.created_at)) {
      return NextResponse.json({ valid: false, error: 'This invitation has expired. Ask the sender to resend it.' });
    }

    return NextResponse.json({
      valid: true,
      kind: 'business',
      invitation: {
        profileId: data.id,
        tradingName: data.trading_name,
        legalName: data.legal_name,
        email: data.email,
        contactName: data.contact_name,
        contactPhone: data.contact_phone,
        relationshipType: data.relationship_type,
        invitedBy: data.invited_by,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Validation failed';
    console.error('Invite validate error:', err);
    return NextResponse.json({ valid: false, error: message }, { status: 500 });
  }
}
