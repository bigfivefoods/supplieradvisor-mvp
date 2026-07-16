import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/customers/access';
import {
  ensureReferralCode,
  ensureReferralProgramRoot,
  getReferralSummary,
  isReferralProgramRoot,
  referralRatesSummary,
  referralSuggestedCopy,
  requestReferralPayout,
  REFERRAL_HOLD_DAYS,
  REFERRAL_KYC_THRESHOLD_ZAR,
} from '@/lib/billing/supply-chain-referral';
import {
  getPayoutKycStatus,
  getReferralFraudSignals,
  requireReferralOps,
} from '@/lib/billing/referral-controls';
import {
  approveReferralEarnings,
  markReferralPaid,
  voidReferralEarnings,
} from '@/lib/billing/supply-chain-referral';
import { getSupabaseServer } from '@/lib/supabase/server-client';

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
    const kyc = await getPayoutKycStatus(companyId);

    return NextResponse.json({
      success: true,
      companyId,
      code,
      invitePath: code
        ? `/onboarding?ref=${encodeURIComponent(code)}`
        : `/onboarding?ref=${companyId}`,
      holdDays: REFERRAL_HOLD_DAYS,
      kycThresholdZar: REFERRAL_KYC_THRESHOLD_ZAR,
      payoutKyc: kyc,
      canSelfApprove: false,
      workflow: [
        {
          status: 'pending',
          label: 'Pending (hold)',
          meaning: `Credited on payment — held ${REFERRAL_HOLD_DAYS} days for refunds/fraud review`,
        },
        {
          status: 'approved',
          label: 'Approved',
          meaning: 'Hold elapsed (auto) or platform ops approved — you may request payout',
        },
        {
          status: 'payout_requested',
          label: 'Payout requested',
          meaning: 'You asked SupplierAdvisor to settle this amount',
        },
        {
          status: 'paid',
          label: 'Paid',
          meaning: 'Settled by platform ops (see paid ref)',
        },
        {
          status: 'void',
          label: 'Void',
          meaning: 'Cancelled (refund, fraud, or error)',
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
 * POST — company actions + platform-ops actions
 *
 * Company members:
 *   request_payout | save_payout_kyc
 *
 * Platform ops only (REFERRAL_OPS_SECRET / CRON_SECRET / root company owner):
 *   approve | mark_paid | void | fraud_snapshot
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

    // ── Company: request payout ─────────────────────────────────────
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

      return NextResponse.json({
        success: true,
        action,
        ...result,
        summary: await getReferralSummary(companyId),
      });
    }

    // ── Company: save payout KYC ────────────────────────────────────
    if (action === 'save_payout_kyc') {
      const gate = await requireCompanyAccess(request, companyId, {
        legacyPrivyUserId: body.privyUserId || legacyPrivyFrom(request),
      });
      if (!gate.ok) return gate.response;

      const supabase = getSupabaseServer();
      const updates: Record<string, unknown> = {
        referral_payout_bank_name: body.bankName
          ? String(body.bankName).slice(0, 120)
          : null,
        referral_payout_account_name: body.accountName
          ? String(body.accountName).slice(0, 120)
          : null,
        referral_payout_account_number: body.accountNumber
          ? String(body.accountNumber).replace(/\s+/g, '').slice(0, 32)
          : null,
        referral_payout_branch_code: body.branchCode
          ? String(body.branchCode).replace(/\s+/g, '').slice(0, 16)
          : null,
        referral_payout_tax_number: body.taxNumber
          ? String(body.taxNumber).slice(0, 64)
          : null,
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', companyId);

      if (error) {
        if (/column|referral_payout/i.test(error.message)) {
          return NextResponse.json(
            {
              error: error.message,
              hint: 'Run supabase/migrations/20260716_referral_watertight.sql',
            },
            { status: 503 }
          );
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action,
        payoutKyc: await getPayoutKycStatus(companyId),
      });
    }

    // ── Platform ops only ───────────────────────────────────────────
    if (
      action === 'approve' ||
      action === 'mark_paid' ||
      action === 'void' ||
      action === 'fraud_snapshot'
    ) {
      const ops = await requireReferralOps(request, {
        legacyPrivyUserId: body.privyUserId || legacyPrivyFrom(request),
      });
      if (!ops.ok) return ops.response;

      if (action === 'fraud_snapshot') {
        const signals = await getReferralFraudSignals(companyId);
        return NextResponse.json({
          success: true,
          action,
          companyId,
          signals,
        });
      }

      if (action === 'approve') {
        const result = await approveReferralEarnings({
          earnerProfileId: companyId,
          actorUserId: ops.userId,
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
          actor_user_id: ops.userId,
          action: 'referral.ops_approved',
          entity_type: 'supply_chain_referral_earnings',
          summary: `Platform ops approved ${result.count} referral earning(s)`,
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
          actorUserId: ops.userId,
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
          actor_user_id: ops.userId,
          action: 'referral.ops_paid',
          entity_type: 'supply_chain_referral_earnings',
          summary: `Platform ops marked R${result.amountZar} referral earnings paid`,
          metadata: { paidRef: body.paidRef || null },
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
        actorUserId: ops.userId,
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
        actor_user_id: ops.userId,
        action: 'referral.ops_voided',
        entity_type: 'supply_chain_referral_earnings',
        summary: `Platform ops voided ${result.count} referral earning(s)`,
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
          'Unknown action. Company: request_payout | save_payout_kyc. Platform ops: approve | mark_paid | void | fraud_snapshot',
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
