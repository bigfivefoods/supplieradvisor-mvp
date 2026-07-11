import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isInviteExpired } from '@/lib/auth/identity';
import { isCustomerInvitesEnabled } from '@/lib/customers/access';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * GET /api/invites/validate?token=...&kind=business|team|customer
 * Public — returns safe invite metadata for claim UI.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    const kind = (request.nextUrl.searchParams.get('kind') || 'business') as
      | 'business'
      | 'team'
      | 'customer';

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Missing invitation token' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (kind === 'customer') {
      if (!isCustomerInvitesEnabled()) {
        return NextResponse.json(
          {
            valid: false,
            error: 'Customer invites are disabled',
            code: 'CUSTOMER_INVITES_DISABLED',
          },
          { status: 503 }
        );
      }

      const { data, error } = await supabase
        .from('customer_invitations')
        .select(
          'id, email, full_name, status, company_name, customer_name, target_profile_id, profile_id, customer_id, expires_at, created_at, invited_by'
        )
        .eq('token', token)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json({
          valid: false,
          error: 'This invitation is invalid or has already been used.',
        });
      }

      if (data.status !== 'pending') {
        const msg =
          data.status === 'accepted'
            ? 'This invitation has already been accepted.'
            : data.status === 'declined'
              ? 'This invitation was declined.'
              : data.status === 'revoked'
                ? 'This invitation was revoked.'
                : data.status === 'expired'
                  ? 'This invitation has expired. Ask the sender to resend it.'
                  : data.status === 'claiming'
                    ? 'This invitation is being claimed. Please try again in a moment.'
                    : 'This invitation is no longer available.';
        return NextResponse.json({ valid: false, error: msg });
      }

      if (isInviteExpired(data.created_at, data.expires_at)) {
        return NextResponse.json({
          valid: false,
          error: 'This invitation has expired. Ask the sender to resend it.',
        });
      }

      // Prefer live seller trading name when available
      let sellerName = data.company_name || 'Your supplier';
      if (data.profile_id) {
        const { data: seller } = await supabase
          .from('profiles')
          .select('trading_name, legal_name')
          .eq('id', data.profile_id)
          .maybeSingle();
        sellerName = seller?.trading_name || seller?.legal_name || sellerName;
      }

      return NextResponse.json({
        valid: true,
        kind: 'customer',
        invitation: {
          email: data.email,
          fullName: data.full_name,
          contactName: data.full_name,
          customerName: data.customer_name,
          sellerName,
          companyName: sellerName,
          targetProfileId: data.target_profile_id ?? null,
          customerId: data.customer_id,
          sellerProfileId: data.profile_id,
          invitedBy: data.invited_by,
        },
      });
    }

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
