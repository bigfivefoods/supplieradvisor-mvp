import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  requireCompanyRoles,
  legacyPrivyFrom,
  ROLES_FINANCE_CRITICAL,
} from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/customers/access';
import {
  approveReferralEarnings,
  ensureReferralCode,
  ensureReferralProgramRoot,
  getReferralSummary,
  isReferralProgramRoot,
  markReferralPaid,
  referralRatesSummary,
  referralSuggestedCopy,
  requestReferralPayout,
  voidReferralEarnings,
} from '@/lib/billing/supply-chain-referral';

/**
 * GET ?companyId= — referral summary + earnings + payout history for this company
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    if (isReferralProgramRoot(companyId)) {
      await ensureReferralProgramRoot();
    }
    const summary = await getReferralSummary(companyId);
    const code = await ensureReferralCode(companyId);

    return NextResponse.json({
      success: true,
      companyId,
      code,
      invitePath: code
        ? `/onboarding?ref=${encodeURIComponent(code)}`
        : `/onboarding?ref=${companyId}`,
      // isProgramRoot / programRoot* come from summary (...summary below)
      workflow: [
        {
          status: 'pending',
          label: 'Pending',
          meaning: 'Earned when a referral pays — short hold for review',
        },
        {
          status: 'approved',
          label: 'Approved',
          meaning: 'Cleared for payout request',
        },
        {
          status: 'payout_requested',
          label: 'Payout requested',
          meaning: 'You asked SupplierAdvisor to pay this amount',
        },
        {
          status: 'paid',
          label: 'Paid',
          meaning: 'Settled to your company (see paid ref)',
        },
        {
          status: 'void',
          label: 'Void',
          meaning: 'Cancelled (fraud, refund, or error)',
        },
      ],
      ...summary,
      ratesSummary: summary.ratesSummary || referralRatesSummary(),
      suggestedCopy: summary.suggestedCopy || referralSuggestedCopy(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * POST — payout workflow actions
 * Body: {
 *   companyId, privyUserId,
 *   action: 'request_payout' | 'approve' | 'mark_paid' | 'void',
 *   earningIds?: number[],
 *   payoutId?: number,
 *   paidRef?: string,
 *   notes?: string,
 *   reason?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const action = String(body.action || '').toLowerCase().trim();
    const earningIds = Array.isArray(body.earningIds)
      ? body.earningIds.map(Number).filter((n: number) => Number.isFinite(n))
      : null;

    // request_payout: any company member with access
    // approve / mark_paid / void: owner/admin/finance
    if (action === 'request_payout') {
      const gate = await requireCompanyAccess(request, companyId, {
        legacyPrivyUserId: body.privyUserId || legacyPrivyFrom(request),
      });
      if (!gate.ok) return gate.response;

      const result = await requestReferralPayout({
        earnerProfileId: companyId,
        userId: gate.userId,
        earningIds,
        notes: body.notes ? String(body.notes) : null,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error },
          { status: result.status }
        );
      }

      void logActivity({
        profile_id: companyId,
        actor_user_id: gate.userId,
        action: 'referral.payout_requested',
        entity_type: 'supply_chain_referral_payout',
        entity_id: String(result.payoutId || ''),
        summary: `Requested referral payout of R${result.amountZar} (${result.count} items)`,
        metadata: {
          amountZar: result.amountZar,
          count: result.count,
          payoutId: result.payoutId,
        },
      });

      const summary = await getReferralSummary(companyId);
      return NextResponse.json({
        success: true,
        action,
        ...result,
        summary,
      });
    }

    if (
      action === 'approve' ||
      action === 'mark_paid' ||
      action === 'void'
    ) {
      const gate = await requireCompanyRoles(
        request,
        companyId,
        ROLES_FINANCE_CRITICAL,
        { legacyPrivyUserId: body.privyUserId || legacyPrivyFrom(request) }
      );
      if (!gate.ok) return gate.response;

      if (action === 'approve') {
        const result = await approveReferralEarnings({
          earnerProfileId: companyId,
          actorUserId: gate.userId,
          earningIds,
        });
        if (!result.ok) {
          return NextResponse.json(
            { error: result.error },
            { status: result.status }
          );
        }
        void logActivity({
          profile_id: companyId,
          actor_user_id: gate.userId,
          action: 'referral.approved',
          entity_type: 'supply_chain_referral_earnings',
          summary: `Approved ${result.count} referral earning(s)`,
        });
        return NextResponse.json({
          success: true,
          action,
          ...result,
          summary: await getReferralSummary(companyId),
        });
      }

      if (action === 'mark_paid') {
        const result = await markReferralPaid({
          earnerProfileId: companyId,
          actorUserId: gate.userId,
          earningIds,
          payoutId: body.payoutId != null ? Number(body.payoutId) : null,
          paidRef: body.paidRef ? String(body.paidRef) : null,
          notes: body.notes ? String(body.notes) : null,
        });
        if (!result.ok) {
          return NextResponse.json(
            { error: result.error },
            { status: result.status }
          );
        }
        void logActivity({
          profile_id: companyId,
          actor_user_id: gate.userId,
          action: 'referral.paid',
          entity_type: 'supply_chain_referral_earnings',
          summary: `Marked R${result.amountZar} referral earnings paid (${result.count} items)`,
          metadata: {
            amountZar: result.amountZar,
            paidRef: body.paidRef || null,
          },
        });
        return NextResponse.json({
          success: true,
          action,
          ...result,
          summary: await getReferralSummary(companyId),
        });
      }

      // void
      if (!earningIds?.length) {
        return NextResponse.json(
          { error: 'earningIds required to void' },
          { status: 400 }
        );
      }
      const result = await voidReferralEarnings({
        earnerProfileId: companyId,
        actorUserId: gate.userId,
        earningIds,
        reason: body.reason ? String(body.reason) : null,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error },
          { status: result.status }
        );
      }
      void logActivity({
        profile_id: companyId,
        actor_user_id: gate.userId,
        action: 'referral.voided',
        entity_type: 'supply_chain_referral_earnings',
        summary: `Voided ${result.count} referral earning(s)`,
      });
      return NextResponse.json({
        success: true,
        action,
        ...result,
        summary: await getReferralSummary(companyId),
      });
    }

    return NextResponse.json(
      {
        error:
          'Unknown action. Use request_payout | approve | mark_paid | void',
      },
      { status: 400 }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
