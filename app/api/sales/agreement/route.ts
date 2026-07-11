import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  assertSalesPortalAccess,
  getOrCreateAgreement,
  isAgreementSigned,
  mapAgreementRow,
} from '@/lib/sales-contractor/access';
import {
  getSalesContractorAgreementHtml,
  SALES_CONTRACTOR_CONTRACT_VERSION,
} from '@/lib/sales-contractor/agreement';
import {
  DEFAULT_COMMISSION_TIERS,
  tiersSummaryText,
} from '@/lib/sales-contractor/commission';
import { logActivity } from '@/lib/customers/access';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * GET ?companyId=&privyUserId=
 * Returns agreement status + HTML body for signing.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const ctx = await assertSalesPortalAccess(privyUserId, companyId);
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const agr = await getOrCreateAgreement({
      companyId,
      memberId: ctx.memberId,
      userId: ctx.userId,
      name: ctx.name,
      email: ctx.email,
    });
    if (!agr.ok) {
      return NextResponse.json({ error: agr.error }, { status: agr.status });
    }

    const html = getSalesContractorAgreementHtml({
      contractorName: agr.agreement.contractor_name || ctx.name || 'Sales Contractor',
      companyName: ctx.companyName,
      tiers: agr.agreement.commission_tiers,
    });

    const subActive =
      ctx.subscriptionExempt || Boolean(agr.agreement.subscription?.isActive);

    return NextResponse.json({
      success: true,
      companyName: ctx.companyName,
      isSalesContractor: ctx.isSalesContractor,
      subscriptionExempt: ctx.subscriptionExempt,
      // Owner / finance / admin: free full access
      signed: ctx.subscriptionExempt || isAgreementSigned(agr.agreement),
      subscriptionActive: subActive,
      subscription: agr.agreement.subscription || null,
      agreement: agr.agreement,
      contractVersion: SALES_CONTRACTOR_CONTRACT_VERSION,
      html,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * POST — sign agreement
 * Body: { companyId, privyUserId, signatureName, accepted: true }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const ctx = await assertSalesPortalAccess(body.privyUserId, companyId);
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    if (!body.accepted) {
      return NextResponse.json(
        { error: 'You must accept the agreement to continue.' },
        { status: 400 }
      );
    }

    const signatureName = String(body.signatureName || '').trim();
    if (signatureName.length < 2) {
      return NextResponse.json(
        { error: 'Please type your full legal name as signature.' },
        { status: 400 }
      );
    }

    const agr = await getOrCreateAgreement({
      companyId,
      memberId: ctx.memberId,
      userId: ctx.userId,
      name: ctx.name,
      email: ctx.email,
    });
    if (!agr.ok) {
      return NextResponse.json({ error: agr.error }, { status: agr.status });
    }

    if (isAgreementSigned(agr.agreement)) {
      return NextResponse.json({
        success: true,
        alreadySigned: true,
        agreement: agr.agreement,
      });
    }

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();
    const tiers = DEFAULT_COMMISSION_TIERS;
    const { data, error } = await supabase
      .from('sales_contractor_agreements')
      .update({
        status: 'signed',
        signed_at: now,
        signature_name: signatureName,
        signature_email: ctx.email || null,
        user_id: ctx.userId,
        contractor_name: signatureName,
        contract_version: SALES_CONTRACTOR_CONTRACT_VERSION,
        commission_tiers: tiers,
        terms_summary: tiersSummaryText(tiers),
        updated_at: now,
        metadata: {
          signed_via: 'sales_portal',
          user_agent:
            typeof body.userAgent === 'string' ? body.userAgent.slice(0, 300) : null,
        },
      })
      .eq('id', agr.agreement.id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    void logActivity({
      profile_id: companyId,
      actor_user_id: ctx.userId,
      action: 'sales_contractor.agreement_signed',
      entity_type: 'sales_contractor_agreement',
      entity_id: String(agr.agreement.id),
      summary: `${signatureName} signed Independent Sales Contractor Agreement`,
      metadata: { version: SALES_CONTRACTOR_CONTRACT_VERSION },
    });

    return NextResponse.json({
      success: true,
      agreement: mapAgreementRow(data as Record<string, unknown>),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
