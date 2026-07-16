import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  getCanonicalUserId,
  isInviteExpired,
  userIdMatchVariants,
} from '@/lib/auth/identity';
import { isCustomerInvitesEnabled, logActivity } from '@/lib/customers/access';
import { upsertSupplierConnection } from '@/lib/suppliers/access';
import { syncBooksOnAccept } from '@/lib/connections/sync';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';
import {
  assignReferrerIfEmpty,
  referredByInsertField,
} from '@/lib/billing/supply-chain-referral';

/** Stuck claiming lease — only same-user restore after this age (matches design reaper window). */
const CLAIMING_STALE_MS = 5 * 60 * 1000;

/**
 * POST /api/invites/claim
 * Claim a business/supplier invite, accept a team invite, or claim a customer
 * platform invitation after Privy auth.
 *
 * Body: {
 *   token: string
 *   kind: 'business' | 'team' | 'customer'
 *   privyUserId: string
 *   email?: string
 *   name?: string
 *   phone?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, kind = 'business', privyUserId, email, name, phone } = body;

    const userId = getCanonicalUserId(privyUserId);
    if (!token || !userId) {
      return NextResponse.json(
        { error: 'Invitation token and authenticated user are required.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const normalizedEmail = email ? String(email).toLowerCase().trim() : null;

    if (kind === 'team') {
      const { data: invite, error } = await supabase
        .from('business_users')
        .select('*')
        .eq('invite_token', token)
        .maybeSingle();

      if (error || !invite) {
        return NextResponse.json({ error: 'Invalid or already used invitation.' }, { status: 404 });
      }

      if (invite.status === 'active' && invite.user_id === userId) {
        return NextResponse.json({
          success: true,
          alreadyMember: true,
          profileId: invite.profile_id,
          message: 'You already belong to this company.',
        });
      }

      if (invite.status !== 'invited' && invite.status !== 'pending') {
        return NextResponse.json({ error: 'This invitation has already been accepted.' }, { status: 409 });
      }

      if (isInviteExpired(invite.invited_at || invite.created_at)) {
        return NextResponse.json({ error: 'This invitation has expired.' }, { status: 410 });
      }

      // Soft email check when both known
      const inviteEmail = (invite.invited_email || invite.email || '').toLowerCase();
      if (normalizedEmail && inviteEmail && normalizedEmail !== inviteEmail) {
        return NextResponse.json(
          {
            error: `Please sign in with the invited email (${inviteEmail}).`,
            expectedEmail: inviteEmail,
          },
          { status: 403 }
        );
      }

      const { error: updateError } = await supabase
        .from('business_users')
        .update({
          user_id: userId,
          status: 'active',
          name: name || invite.name || null,
          email: normalizedEmail || invite.invited_email || invite.email,
          invite_token: null,
          joined_at: now,
        })
        .eq('id', invite.id)
        .eq('invite_token', token);

      if (updateError) {
        console.error('Team claim update error:', updateError);
        return NextResponse.json({ error: 'Failed to accept invitation.', details: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        kind: 'team',
        profileId: invite.profile_id,
        role: invite.role || 'member',
        message: 'Welcome to the team!',
      });
    }

    if (kind === 'customer') {
      if (!isCustomerInvitesEnabled()) {
        return NextResponse.json(
          { error: 'Customer invites are disabled', code: 'CUSTOMER_INVITES_DISABLED' },
          { status: 503 }
        );
      }
      return await claimCustomerInvite({
        supabase,
        token,
        userId,
        normalizedEmail,
        name,
        phone,
        now,
      });
    }

    // ---- Business / supplier claim ----
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('invite_token', token)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Invalid or already used invitation.' }, { status: 404 });
    }

    if (profile.supplier_status !== 'invited' && profile.supplier_status !== 'pending') {
      // Already claimed — if this user is owner, treat as success
      const { data: existing } = await supabase
        .from('business_users')
        .select('id')
        .eq('profile_id', profile.id)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (existing) {
        return NextResponse.json({
          success: true,
          alreadyMember: true,
          profileId: profile.id,
          message: 'You already have access to this company.',
        });
      }

      return NextResponse.json({ error: 'This invitation has already been claimed.' }, { status: 409 });
    }

    if (isInviteExpired(profile.invited_at || profile.created_at)) {
      return NextResponse.json({ error: 'This invitation has expired.' }, { status: 410 });
    }

    const inviteEmail = (profile.email || '').toLowerCase();
    if (normalizedEmail && inviteEmail && normalizedEmail !== inviteEmail) {
      return NextResponse.json(
        {
          error: `Please sign in with the invited email (${inviteEmail}).`,
          expectedEmail: inviteEmail,
        },
        { status: 403 }
      );
    }

    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update({
        supplier_status: 'active',
        claimed_at: now,
        contact_name: name || profile.contact_name,
        contact_phone: phone || profile.contact_phone,
        email: normalizedEmail || profile.email,
        invite_token: null,
        user_id: userId,
        is_discoverable: profile.is_discoverable !== false,
      })
      .eq('id', profile.id)
      .eq('invite_token', token);

    if (updateProfileError) {
      console.error('Business claim profile error:', updateProfileError);
      return NextResponse.json(
        { error: 'Failed to claim business profile.', details: updateProfileError.message },
        { status: 500 }
      );
    }

    // Create or update ownership membership
    const { data: existingMembership } = await supabase
      .from('business_users')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingMembership) {
      await supabase
        .from('business_users')
        .update({
          role: 'owner',
          status: 'active',
          name: name || profile.contact_name,
          email: normalizedEmail || profile.email,
          joined_at: now,
          invite_token: null,
        })
        .eq('id', existingMembership.id);
    } else {
      const { error: membershipError } = await supabase.from('business_users').insert({
        user_id: userId,
        profile_id: profile.id,
        role: 'owner',
        status: 'active',
        name: name || profile.contact_name,
        email: normalizedEmail || profile.email,
        joined_at: now,
      });

      if (membershipError) {
        console.error('Business claim membership error:', membershipError);
        // Profile is claimed; surface soft warning
        return NextResponse.json({
          success: true,
          profileId: profile.id,
          warning: 'Profile claimed but membership link failed. Contact support if companies do not appear.',
          details: membershipError.message,
        });
      }
    }

    // SRM: if this token came from a buyer supplier invite, link book + on-chain-ready edge
    let srmLinked: { buyerProfileId: number; supplierId: number; connectionId?: number } | null =
      null;
    let inviterForReferral: number | null = null;
    try {
      const { data: srmInv } = await supabase
        .from('supplier_invitations')
        .select('id, profile_id, supplier_id, status')
        .eq('token', token)
        .maybeSingle();

      // Also match by invite that still points at this shell via supplier_invitations.token
      // (token was rotated onto profile; look up pending invites for this email / linked shell)
      let inviteRow = srmInv;
      if (!inviteRow) {
        const { data: byShell } = await supabase
          .from('srm_suppliers')
          .select('id, profile_id')
          .eq('linked_profile_id', profile.id)
          .eq('invite_status', 'invited')
          .limit(1)
          .maybeSingle();
        if (byShell) {
          inviteRow = {
            id: 0,
            profile_id: byShell.profile_id,
            supplier_id: byShell.id,
            status: 'pending',
          };
        }
      }

      if (inviteRow?.profile_id && inviteRow?.supplier_id) {
        const buyerId = Number(inviteRow.profile_id);
        inviterForReferral = buyerId;
        const srmId = Number(inviteRow.supplier_id);
        const conn = await upsertSupplierConnection({
          buyerProfileId: buyerId,
          supplierProfileId: Number(profile.id),
          notes: 'Supplier claimed platform invite',
          metadata: { source: 'supplier_invite_claim', token_claimed: true },
        });
        if (conn.ok) {
          await syncBooksOnAccept({
            requesterId: buyerId,
            requesteeId: Number(profile.id),
            connectionId: conn.connectionId,
            connectionType: 'supplier',
            userId,
          });
        }
        await supabase
          .from('srm_suppliers')
          .update({
            linked_profile_id: profile.id,
            connection_id: conn.ok ? conn.connectionId : null,
            invite_status: 'accepted',
            invite_accepted_at: now,
            invite_token: null,
            status: 'active',
            updated_at: now,
          })
          .eq('id', srmId);
        if (inviteRow.id) {
          await supabase
            .from('supplier_invitations')
            .update({
              status: 'accepted',
              accepted_at: now,
              target_profile_id: profile.id,
              updated_at: now,
            })
            .eq('id', inviteRow.id);
        }
        srmLinked = {
          buyerProfileId: buyerId,
          supplierId: srmId,
          connectionId: conn.ok ? conn.connectionId : undefined,
        };
        await logActivity({
          profile_id: buyerId,
          actor_user_id: userId,
          action: 'supplier.invite_accepted',
          entity_type: 'srm_suppliers',
          entity_id: String(srmId),
          summary: `Supplier claimed invite and connected: ${profile.trading_name || profile.id}`,
          metadata: srmLinked,
        });
      }
    } catch (srmErr) {
      console.error('SRM link after business claim soft-fail:', srmErr);
    }

    // Accept pending network edges from invite-business (or any pending requestee=this profile)
    let networkAccepted: number | null = null;
    try {
      const { data: pendingEdges } = await supabase
        .from('business_connections')
        .select('id, requester_profile_id, requestee_profile_id, connection_type, status')
        .eq('requestee_profile_id', profile.id)
        .eq('status', 'pending')
        .limit(20);

      for (const edge of pendingEdges || []) {
        const { error: acceptErr } = await supabase
          .from('business_connections')
          .update({
            status: 'accepted',
            responded_at: now,
            updated_at: now,
            metadata: {
              accepted_via: 'business_invite_claim',
              accepted_at: now,
            },
          })
          .eq('id', edge.id);
        if (acceptErr) {
          console.warn('accept pending edge soft-fail:', acceptErr.message);
          continue;
        }
        networkAccepted = Number(edge.id);
        if (!inviterForReferral && edge.requester_profile_id) {
          inviterForReferral = Number(edge.requester_profile_id);
        }
        await syncBooksOnAccept({
          requesterId: Number(edge.requester_profile_id),
          requesteeId: Number(edge.requestee_profile_id),
          connectionId: Number(edge.id),
          connectionType: String(edge.connection_type || 'partner'),
          userId,
        });
      }
    } catch (netErr) {
      console.error('Network accept after business claim soft-fail:', netErr);
    }

    // Supply-chain referral: inviter becomes L1 if not already set (link or invite)
    if (inviterForReferral) {
      try {
        await assignReferrerIfEmpty(Number(profile.id), inviterForReferral, {
          source: 'business_invite_claim',
        });
      } catch (refErr) {
        console.warn('assignReferrerIfEmpty soft-fail:', refErr);
      }
    }

    return NextResponse.json({
      success: true,
      kind: 'business',
      profileId: profile.id,
      role: 'owner',
      message: 'Business profile claimed successfully!',
      srm: srmLinked,
      networkConnectionId: networkAccepted,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Claim failed';
    console.error('Invite claim error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type AdminClient = ReturnType<typeof getSupabaseAdmin>;

async function restoreInvitationPending(
  supabase: AdminClient,
  invitationId: number
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('customer_invitations')
    .update({ status: 'pending', user_id: null, updated_at: now })
    .eq('id', invitationId)
    .eq('status', 'claiming');
  if (error) {
    console.error('Failed to restore customer invitation to pending:', error);
  }
}

async function claimCustomerInvite(opts: {
  supabase: AdminClient;
  token: string;
  userId: string;
  normalizedEmail: string | null;
  name?: string;
  phone?: string;
  now: string;
}): Promise<NextResponse> {
  const { supabase, token, userId, normalizedEmail, name, phone, now } = opts;

  const { data: invitePreview, error: loadErr } = await supabase
    .from('customer_invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (loadErr) {
    console.error('Customer claim load error:', loadErr);
    return NextResponse.json({ error: 'Failed to load invitation.' }, { status: 500 });
  }
  if (!invitePreview) {
    return NextResponse.json({ error: 'Invalid or already used invitation.' }, { status: 404 });
  }

  // Idempotent: already accepted by this user
  if (invitePreview.status === 'accepted') {
    const variants = userIdMatchVariants(userId);
    const claimedByThisUser =
      invitePreview.user_id &&
      variants.includes(String(invitePreview.user_id));

    if (claimedByThisUser) {
      const { data: customer } = await supabase
        .from('customers')
        .select('linked_profile_id')
        .eq('id', invitePreview.customer_id)
        .maybeSingle();
      const buyerProfileId =
        customer?.linked_profile_id || invitePreview.target_profile_id || null;
      return NextResponse.json({
        success: true,
        alreadyMember: true,
        kind: 'customer',
        buyerProfileId,
        profileId: buyerProfileId,
        message: 'You already accepted this invitation.',
      });
    }

    return NextResponse.json(
      { error: 'This invitation has already been accepted.' },
      { status: 409 }
    );
  }

  if (invitePreview.status === 'declined' || invitePreview.status === 'revoked') {
    return NextResponse.json(
      { error: `This invitation was ${invitePreview.status}.` },
      { status: 409 }
    );
  }

  if (
    invitePreview.status === 'expired' ||
    isInviteExpired(invitePreview.created_at, invitePreview.expires_at)
  ) {
    return NextResponse.json({ error: 'This invitation has expired.' }, { status: 410 });
  }

  // Hard email rule for kind=customer
  const inviteEmail = String(invitePreview.email || '')
    .toLowerCase()
    .trim();
  if (!normalizedEmail) {
    return NextResponse.json(
      {
        error: 'Sign in with the invited email.',
        expectedEmail: inviteEmail || undefined,
      },
      { status: 403 }
    );
  }
  if (!inviteEmail || normalizedEmail !== inviteEmail) {
    return NextResponse.json(
      {
        error: `Please sign in with the invited email (${inviteEmail || 'unknown'}).`,
        expectedEmail: inviteEmail || undefined,
      },
      { status: 403 }
    );
  }

  // Same-user claiming recovery: finalize if CRM linked; else restore only when lease is stale
  if (invitePreview.status === 'claiming') {
    const variants = userIdMatchVariants(userId);
    const sameUser =
      invitePreview.user_id && variants.includes(String(invitePreview.user_id));
    if (!sameUser) {
      return NextResponse.json(
        { error: 'This invitation is already being claimed. Please try again shortly.' },
        { status: 409 }
      );
    }

    const { data: linkedCustomer } = await supabase
      .from('customers')
      .select('linked_profile_id, connection_id')
      .eq('id', invitePreview.customer_id)
      .maybeSingle();

    if (linkedCustomer?.linked_profile_id) {
      const { data: finalized } = await supabase
        .from('customer_invitations')
        .update({
          status: 'accepted',
          accepted_at: now,
          token: null,
          user_id: userId,
          updated_at: now,
        })
        .eq('id', invitePreview.id)
        .eq('status', 'claiming')
        .select('id')
        .maybeSingle();

      if (finalized) {
        await logActivity({
          profile_id: Number(invitePreview.profile_id),
          actor_user_id: userId,
          action: 'customer.invite.accepted',
          entity_type: 'customer',
          entity_id: String(invitePreview.customer_id),
          summary: `Customer accepted platform invitation (buyer profile #${linkedCustomer.linked_profile_id})`,
          metadata: {
            invitation_id: invitePreview.id,
            buyer_profile_id: linkedCustomer.linked_profile_id,
            connection_id: linkedCustomer.connection_id,
            email: inviteEmail,
            recovered_from_claiming: true,
          },
        });
      }

      return NextResponse.json({
        success: true,
        kind: 'customer',
        buyerProfileId: linkedCustomer.linked_profile_id,
        profileId: linkedCustomer.linked_profile_id,
        connectionId: linkedCustomer.connection_id,
        message: 'Invitation accepted. Your company is now connected.',
      });
    }

    // Do NOT restore fresh claiming (double-submit race). Only reclaim after staleness.
    const claimingStartedAt = invitePreview.updated_at
      ? new Date(invitePreview.updated_at).getTime()
      : 0;
    const claimingAgeMs = Date.now() - claimingStartedAt;
    if (!claimingStartedAt || claimingAgeMs < CLAIMING_STALE_MS) {
      return NextResponse.json(
        {
          error:
            'This invitation is already being claimed. Please try again shortly.',
        },
        { status: 409 }
      );
    }

    // Stale claiming + same user + CRM not linked → restore pending for full retry
    await restoreInvitationPending(supabase, Number(invitePreview.id));
  } else if (invitePreview.status !== 'pending') {
    return NextResponse.json(
      { error: 'This invitation is no longer available.' },
      { status: 409 }
    );
  }

  // Atomic lock: pending → claiming (unexpired only)
  const { data: locked, error: lockErr } = await supabase
    .from('customer_invitations')
    .update({
      status: 'claiming',
      user_id: userId,
      updated_at: now,
    })
    .eq('id', invitePreview.id)
    .eq('token', token)
    .eq('status', 'pending')
    .gt('expires_at', now)
    .select('*')
    .maybeSingle();

  if (lockErr) {
    console.error('Customer claim lock error:', lockErr);
    return NextResponse.json(
      { error: 'Failed to claim invitation.', details: lockErr.message },
      { status: 500 }
    );
  }
  if (!locked) {
    return NextResponse.json(
      { error: 'Invitation already used, expired, or in-flight.' },
      { status: 409 }
    );
  }

  const invitationId = Number(locked.id);
  const sellerProfileId = Number(locked.profile_id);
  const customerId = Number(locked.customer_id);
  let createdProfileId: number | null = null;
  let buyerProfileId: number | null = null;

  try {
    // Load CRM customer for create-on-claim payloads
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select(
        'id, profile_id, trading_name, legal_name, email, contact_name, phone, website, industry, city, country, region, linked_profile_id, connection_id, invite_status'
      )
      .eq('id', customerId)
      .eq('profile_id', sellerProfileId)
      .maybeSingle();

    if (custErr) {
      console.error('Customer claim CRM load error:', custErr);
      await restoreInvitationPending(supabase, invitationId);
      return NextResponse.json(
        { error: 'Failed to load customer record.', details: custErr.message },
        { status: 500 }
      );
    }
    if (!customer) {
      await restoreInvitationPending(supabase, invitationId);
      return NextResponse.json(
        { error: 'Customer record not found for this invitation.' },
        { status: 404 }
      );
    }

    // Already connected: do not overwrite linked buyer (defense-in-depth)
    if (customer.linked_profile_id) {
      const existingLinked = Number(customer.linked_profile_id);
      const variants = userIdMatchVariants(userId);
      const { data: linkMembership } = await supabase
        .from('business_users')
        .select('id')
        .eq('profile_id', existingLinked)
        .eq('status', 'active')
        .in('user_id', variants)
        .limit(1);

      // Finalize invitation so token is not left pending/claiming against a live link
      await supabase
        .from('customer_invitations')
        .update({
          status: 'accepted',
          accepted_at: now,
          token: null,
          user_id: userId,
          updated_at: now,
        })
        .eq('id', invitationId)
        .in('status', ['claiming', 'pending']);

      if (linkMembership && linkMembership.length > 0) {
        // Idempotent success when claimer belongs to the already-linked buyer company
        return NextResponse.json({
          success: true,
          alreadyMember: true,
          kind: 'customer',
          buyerProfileId: existingLinked,
          profileId: existingLinked,
          connectionId: customer.connection_id,
          message: 'Customer is already connected.',
        });
      }

      return NextResponse.json(
        {
          error:
            'This customer is already connected to a company profile. Contact the seller if you need help.',
          linked_profile_id: existingLinked,
        },
        { status: 409 }
      );
    }

    // Resolve buyer profile: target membership OR claim-time membership match OR create-on-claim
    if (locked.target_profile_id) {
      const targetId = Number(locked.target_profile_id);
      const variants = userIdMatchVariants(userId);
      const { data: membership, error: memErr } = await supabase
        .from('business_users')
        .select('id, user_id, profile_id, status')
        .eq('profile_id', targetId)
        .eq('status', 'active')
        .in('user_id', variants)
        .limit(1);

      if (memErr) {
        console.error('Customer claim membership check error:', memErr);
        await restoreInvitationPending(supabase, invitationId);
        return NextResponse.json(
          { error: 'Failed to verify company membership.' },
          { status: 500 }
        );
      }
      if (!membership || membership.length === 0) {
        await restoreInvitationPending(supabase, invitationId);
        return NextResponse.json(
          {
            error:
              'You must be an active member of the invited company to accept this invitation.',
          },
          { status: 403 }
        );
      }
      buyerProfileId = targetId;
    } else {
      // Claim-time resolve: prefer an existing active membership whose profile email matches
      const membershipMatch = await resolveBuyerProfileFromMembership(
        supabase,
        userId,
        inviteEmail
      );
      if (membershipMatch.ok === false) {
        await restoreInvitationPending(supabase, invitationId);
        return NextResponse.json(
          { error: membershipMatch.error },
          { status: membershipMatch.status }
        );
      }

      if (membershipMatch.profileId) {
        buyerProfileId = membershipMatch.profileId;
        if (membershipMatch.warning) {
          console.warn(
            'Customer claim multi-match membership preference:',
            membershipMatch.warning,
            { invitationId, buyerProfileId, userId }
          );
        }
      } else {
        // Create-on-claim (no matching membership profile for invite email)
        if (membershipMatch.logCreateWarning) {
          console.warn(
            'Customer claim: no matching membership for invite email; creating new buyer profile',
            { invitationId, inviteEmail, userId }
          );
        }

        const tradingName =
          customer.trading_name || locked.customer_name || 'Customer';
        const legalName = customer.legal_name || tradingName;
        const contactName =
          (name ? String(name).trim() : null) ||
          customer.contact_name ||
          locked.full_name ||
          null;
        const contactPhone =
          (phone ? String(phone).trim() : null) || customer.phone || null;

        const { data: newProfile, error: profileInsertErr } = await supabase
          .from('profiles')
          .insert({
            trading_name: tradingName,
            legal_name: legalName,
            email: inviteEmail,
            contact_name: contactName,
            contact_phone: contactPhone,
            website: customer.website || null,
            industry: customer.industry || null,
            city: customer.city || null,
            country: customer.country || 'South Africa',
            region: customer.region || null,
            relationship_type: 'customer',
            supplier_status: 'active',
            user_id: userId,
            claimed_at: now,
            created_at: now,
            onboarding_complete: false,
            // Inviting seller is L1 referrer for the new buyer company
            ...referredByInsertField(sellerProfileId),
            metadata: {
              source: 'customer_invite',
              invitation_id: invitationId,
              seller_profile_id: sellerProfileId,
            },
          })
          .select('id')
          .single();

        if (profileInsertErr || !newProfile) {
          console.error('Customer claim profile insert error:', profileInsertErr);
          await restoreInvitationPending(supabase, invitationId);
          return NextResponse.json(
            {
              error: 'Failed to create buyer company profile.',
              details: profileInsertErr?.message,
            },
            { status: 500 }
          );
        }

        createdProfileId = Number(newProfile.id);
        buyerProfileId = createdProfileId;

        const { error: ownerErr } = await supabase.from('business_users').insert({
          user_id: userId,
          profile_id: createdProfileId,
          role: 'owner',
          status: 'active',
          name: contactName,
          email: inviteEmail,
          joined_at: now,
          created_at: now,
        });

        if (ownerErr) {
          console.error('Customer claim owner membership error:', ownerErr);
          // Compensate: delete orphan profile if we created it
          await supabase.from('profiles').delete().eq('id', createdProfileId);
          createdProfileId = null;
          await restoreInvitationPending(supabase, invitationId);
          return NextResponse.json(
            {
              error: 'Failed to create company ownership.',
              details: ownerErr.message,
            },
            { status: 500 }
          );
        }
      }
    }

    if (!buyerProfileId) {
      await restoreInvitationPending(supabase, invitationId);
      return NextResponse.json(
        { error: 'Could not resolve buyer company profile.' },
        { status: 500 }
      );
    }

    // First-touch referral: inviting seller becomes L1 if buyer has no referrer yet
    try {
      await assignReferrerIfEmpty(buyerProfileId, sellerProfileId, {
        source: 'customer_invite_claim',
      });
    } catch (refErr) {
      console.warn('customer claim assignReferrerIfEmpty soft-fail:', refErr);
    }

    // UPSERT business_connections on (requester, requestee) — retype to customer/accepted
    const { data: existingConn, error: connLoadErr } = await supabase
      .from('business_connections')
      .select('id, connection_type, status, metadata')
      .eq('requester_profile_id', sellerProfileId)
      .eq('requestee_profile_id', buyerProfileId)
      .maybeSingle();

    if (connLoadErr) {
      console.error('Customer claim BC load error:', connLoadErr);
      await compensateClaimFailure(supabase, {
        invitationId,
        createdProfileId,
        userId,
      });
      return NextResponse.json(
        { error: 'Failed to load connection.', details: connLoadErr.message },
        { status: 500 }
      );
    }

    let connectionId: number;
    const baseMeta: Record<string, unknown> = {
      customer_id: customerId,
      invitation_id: invitationId,
      suspended: false,
    };

    if (existingConn) {
      const priorMeta =
        existingConn.metadata &&
        typeof existingConn.metadata === 'object' &&
        !Array.isArray(existingConn.metadata)
          ? (existingConn.metadata as Record<string, unknown>)
          : {};
      const priorType = existingConn.connection_type;
      const retyped = priorType && priorType !== 'customer';
      const metadata = {
        ...priorMeta,
        ...baseMeta,
        ...(retyped ? { prior_connection_type: priorType } : {}),
      };

      const { data: updatedConn, error: connUpdErr } = await supabase
        .from('business_connections')
        .update({
          connection_type: 'customer',
          status: 'accepted',
          responded_at: now,
          metadata,
          updated_at: now,
        })
        .eq('id', existingConn.id)
        .select('id')
        .single();

      if (connUpdErr || !updatedConn) {
        console.error('Customer claim BC update error:', connUpdErr);
        await compensateClaimFailure(supabase, {
          invitationId,
          createdProfileId,
          userId,
        });
        return NextResponse.json(
          {
            error: 'Failed to update business connection.',
            details: connUpdErr?.message,
          },
          { status: 500 }
        );
      }
      connectionId = Number(updatedConn.id);

      if (retyped) {
        await logActivity({
          profile_id: sellerProfileId,
          actor_user_id: userId,
          action: 'customer.connection.retyped',
          entity_type: 'business_connection',
          entity_id: String(connectionId),
          summary: `Retyped connection from ${priorType} to customer on invite claim`,
          metadata: {
            prior_connection_type: priorType,
            customer_id: customerId,
            invitation_id: invitationId,
            buyer_profile_id: buyerProfileId,
          },
        });
      }
    } else {
      const { data: insertedConn, error: connInsErr } = await supabase
        .from('business_connections')
        .insert({
          requester_profile_id: sellerProfileId,
          requestee_profile_id: buyerProfileId,
          status: 'accepted',
          connection_type: 'customer',
          responded_at: now,
          metadata: baseMeta,
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single();

      if (connInsErr || !insertedConn) {
        console.error('Customer claim BC insert error:', connInsErr);
        await compensateClaimFailure(supabase, {
          invitationId,
          createdProfileId,
          userId,
        });
        return NextResponse.json(
          {
            error: 'Failed to create business connection.',
            details: connInsErr?.message,
          },
          { status: 500 }
        );
      }
      connectionId = Number(insertedConn.id);
    }

    // Update customers: linked_profile_id, connection_id, invite_status=accepted, clear token
    // Require a row was written — never finalize invite without CRM link
    const { data: crmUpdated, error: crmErr } = await supabase
      .from('customers')
      .update({
        linked_profile_id: buyerProfileId,
        connection_id: connectionId,
        invite_status: 'accepted',
        invite_token: null,
        invite_accepted_at: now,
        updated_at: now,
      })
      .eq('id', customerId)
      .eq('profile_id', sellerProfileId)
      .is('linked_profile_id', null)
      .select('id')
      .maybeSingle();

    if (crmErr) {
      console.error('Customer claim CRM update error:', crmErr);
      await compensateClaimFailure(supabase, {
        invitationId,
        createdProfileId,
        userId,
        connectionId,
      });
      return NextResponse.json(
        {
          error: 'Failed to link customer CRM row.',
          details: crmErr.message,
        },
        { status: 500 }
      );
    }
    if (!crmUpdated) {
      // Race: another claim linked, or row missing — do not accept invitation
      console.error('Customer claim CRM update matched 0 rows', {
        customerId,
        sellerProfileId,
        buyerProfileId,
      });
      await compensateClaimFailure(supabase, {
        invitationId,
        createdProfileId,
        userId,
        connectionId,
      });
      return NextResponse.json(
        {
          error:
            'Customer could not be linked (already connected or missing). Try again or contact support.',
        },
        { status: 409 }
      );
    }

    // Final claiming → accepted, clear invitation token
    const { data: accepted, error: acceptErr } = await supabase
      .from('customer_invitations')
      .update({
        status: 'accepted',
        accepted_at: now,
        token: null,
        user_id: userId,
        updated_at: now,
      })
      .eq('id', invitationId)
      .eq('status', 'claiming')
      .select('id')
      .maybeSingle();

    if (acceptErr) {
      console.error('Customer claim final accept error:', acceptErr);
      // CRM already linked — leave as-is for retry; surface error
      return NextResponse.json(
        {
          error: 'Failed to finalize invitation acceptance.',
          details: acceptErr.message,
          buyerProfileId,
          profileId: buyerProfileId,
        },
        { status: 500 }
      );
    }
    if (!accepted) {
      // Rare race: treat as 409
      return NextResponse.json(
        { error: 'Invitation claim conflicted. Please try again.' },
        { status: 409 }
      );
    }

    await logActivity({
      profile_id: sellerProfileId,
      actor_user_id: userId,
      action: 'customer.invite.accepted',
      entity_type: 'customer',
      entity_id: String(customerId),
      summary: `Customer accepted platform invitation (buyer profile #${buyerProfileId})`,
      metadata: {
        invitation_id: invitationId,
        buyer_profile_id: buyerProfileId,
        connection_id: connectionId,
        email: inviteEmail,
        created_profile: Boolean(createdProfileId),
      },
    });

    return NextResponse.json({
      success: true,
      kind: 'customer',
      buyerProfileId,
      profileId: buyerProfileId,
      connectionId,
      role: createdProfileId ? 'owner' : 'member',
      message: 'Invitation accepted. Your company is now connected.',
    });
  } catch (err: unknown) {
    console.error('Customer claim unexpected error:', err);
    await compensateClaimFailure(supabase, {
      invitationId,
      createdProfileId,
      userId,
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Claim failed' },
      { status: 500 }
    );
  }
}

/**
 * When target_profile_id is null: prefer an active membership on a profile whose
 * email matches the invitation (case-insensitive). Sole match → use it.
 * Multiple matches → pick lowest profile id (deterministic) and log warning.
 * None → create-on-claim path.
 */
async function resolveBuyerProfileFromMembership(
  supabase: AdminClient,
  userId: string,
  inviteEmail: string
): Promise<
  | {
      ok: true;
      profileId: number | null;
      warning?: string;
      logCreateWarning?: boolean;
    }
  | { ok: false; error: string; status: number }
> {
  const variants = userIdMatchVariants(userId);
  const { data: memberships, error: memErr } = await supabase
    .from('business_users')
    .select('id, profile_id, status, user_id')
    .eq('status', 'active')
    .in('user_id', variants)
    .limit(50);

  if (memErr) {
    console.error('resolveBuyerProfileFromMembership membership query:', memErr);
    return { ok: false, error: 'Failed to resolve company membership.', status: 500 };
  }

  if (!memberships || memberships.length === 0) {
    return { ok: true, profileId: null, logCreateWarning: true };
  }

  const profileIds = Array.from(
    new Set(
      memberships
        .map((m) => Number(m.profile_id))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );
  if (profileIds.length === 0) {
    return { ok: true, profileId: null, logCreateWarning: true };
  }

  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, email')
    .in('id', profileIds);

  if (profErr) {
    console.error('resolveBuyerProfileFromMembership profiles query:', profErr);
    return { ok: false, error: 'Failed to resolve company profiles.', status: 500 };
  }

  const matching = (profiles || [])
    .filter(
      (p) =>
        String(p.email || '')
          .toLowerCase()
          .trim() === inviteEmail
    )
    .map((p) => Number(p.id))
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => a - b);

  if (matching.length === 0) {
    return { ok: true, profileId: null, logCreateWarning: true };
  }
  if (matching.length === 1) {
    return { ok: true, profileId: matching[0] };
  }

  // Multiple member profiles share invite email — deterministic pick (lowest id)
  return {
    ok: true,
    profileId: matching[0],
    warning: `Multiple active member profiles match invite email; using profile ${matching[0]} of [${matching.join(', ')}]`,
  };
}

async function compensateClaimFailure(
  supabase: AdminClient,
  opts: {
    invitationId: number;
    createdProfileId: number | null;
    userId: string;
    connectionId?: number;
  }
): Promise<void> {
  await restoreInvitationPending(supabase, opts.invitationId);

  // Prefer deleting orphan profile created in this request (no other memberships)
  if (opts.createdProfileId) {
    try {
      await supabase
        .from('business_users')
        .delete()
        .eq('profile_id', opts.createdProfileId)
        .eq('user_id', opts.userId);

      const { count } = await supabase
        .from('business_users')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', opts.createdProfileId);

      if ((count ?? 0) === 0) {
        await supabase.from('profiles').delete().eq('id', opts.createdProfileId);
      } else {
        // Merge claim_orphaned into existing metadata (do not drop invitation_id etc.)
        const { data: orphanProfile } = await supabase
          .from('profiles')
          .select('metadata')
          .eq('id', opts.createdProfileId)
          .maybeSingle();
        const priorMeta =
          orphanProfile?.metadata &&
          typeof orphanProfile.metadata === 'object' &&
          !Array.isArray(orphanProfile.metadata)
            ? (orphanProfile.metadata as Record<string, unknown>)
            : {};
        await supabase
          .from('profiles')
          .update({
            metadata: {
              ...priorMeta,
              claim_orphaned: true,
              source: priorMeta.source || 'customer_invite',
            },
          })
          .eq('id', opts.createdProfileId);
      }
    } catch (e) {
      console.error('Claim compensate profile cleanup failed:', e);
    }
  }

  // Do not delete BC on compensate if it may have pre-existed — only if we just inserted
  // and CRM link failed after insert. Leaving an accepted customer edge without CRM link
  // is recoverable on retry (UPSERT). Optional delete of just-created edge:
  if (opts.connectionId && opts.createdProfileId) {
    try {
      await supabase
        .from('business_connections')
        .delete()
        .eq('id', opts.connectionId)
        .eq('requestee_profile_id', opts.createdProfileId);
    } catch (e) {
      console.error('Claim compensate BC cleanup failed:', e);
    }
  }
}
