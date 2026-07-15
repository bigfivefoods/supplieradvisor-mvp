import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  assertSalesPortalAccess,
  getOrCreateAgreement,
  isAgreementSigned,
  mapAgreementRow,
} from '@/lib/sales-contractor/access';
import {
  buildSalesAgreementDownloadDocument,
  getSalesContractorAgreementHtml,
  SALES_CONTRACTOR_CONTRACT_VERSION,
} from '@/lib/sales-contractor/agreement';
import { buildSalesAgreementPdf } from '@/lib/sales-contractor/agreement-pdf';
import { tiersSummaryText } from '@/lib/sales-contractor/commission';
import { logActivity } from '@/lib/customers/access';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import {
  liveCommissionTiers,
  programSnapshotForAgreement,
  resolveProgramSettings,
} from '@/lib/sales-program';

/**
 * GET ?companyId=&privyUserId=
 * Optional: format=download|pdf — PDF attachment
 *           format=html — full HTML document for print preview
 * Returns agreement status + HTML body for signing.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const format = String(
      request.nextUrl.searchParams.get('format') || ''
    ).toLowerCase();
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

    const contractorName =
      agr.agreement.signature_name ||
      agr.agreement.contractor_name ||
      ctx.name ||
      'Sales Contractor';
    const program = await resolveProgramSettings(companyId);
    const reallySigned = isAgreementSigned(agr.agreement);
    // Live company sales program for pending; freeze only after real e-sign
    const tiers = liveCommissionTiers(program, agr.agreement);
    const contractVersion = reallySigned
      ? agr.agreement.contract_version || program.contract_version
      : program.contract_version;
    const bodyHtml = getSalesContractorAgreementHtml({
      contractorName,
      companyName: ctx.companyName,
      tiers,
      program: {
        ...program,
        commission_tiers: tiers,
      },
    });

    // Portal access for managers (exempt) vs actual e-signature
    const signed =
      ctx.subscriptionExempt || reallySigned;

    const agreementMeta = {
      companyName: ctx.companyName,
      contractorName,
      contractVersion:
        contractVersion || SALES_CONTRACTOR_CONTRACT_VERSION,
      status: (reallySigned ? 'signed' : 'pending') as 'signed' | 'pending',
      signedAt: agr.agreement.signed_at,
      signatureName: agr.agreement.signature_name,
      signatureEmail: agr.agreement.signature_email || ctx.email || null,
      agreementId: agr.agreement.id,
    };

    const safeCo = ctx.companyName
      .replace(/[^\w\-]+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40);
    const verSlug = String(contractVersion || SALES_CONTRACTOR_CONTRACT_VERSION)
      .replace(/[^\w.\-]+/g, '-')
      .slice(0, 48);

    // PDF download (default download path)
    if (format === 'download' || format === 'pdf') {
      const pdf = await buildSalesAgreementPdf({
        bodyHtml,
        meta: agreementMeta,
      });
      const filename = reallySigned
        ? `sales-contractor-agreement-signed-${safeCo}-v${verSlug}.pdf`
        : `sales-contractor-agreement-draft-${safeCo}-v${verSlug}.pdf`;
      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
          'Content-Length': String(pdf.length),
        },
      });
    }

    // HTML document for browser print preview
    if (format === 'html') {
      const doc = buildSalesAgreementDownloadDocument({
        bodyHtml,
        meta: agreementMeta,
      });
      const filename = reallySigned
        ? `sales-contractor-agreement-signed-${safeCo}-v${verSlug}.html`
        : `sales-contractor-agreement-draft-${safeCo}-v${verSlug}.html`;
      return new NextResponse(doc, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const subActive =
      ctx.subscriptionExempt || Boolean(agr.agreement.subscription?.isActive);

    return NextResponse.json({
      success: true,
      companyName: ctx.companyName,
      program: {
        program_name: program.program_name,
        program_summary: program.program_summary,
        contract_version: program.contract_version,
        contract_title: program.contract_title,
        commission_tiers: tiers,
        sales_criteria: program.sales_criteria,
        email_domain: program.email_domain,
        example_units: program.example_units,
        example_unit_price: program.example_unit_price,
        example_label: program.example_label,
        personal_sales_only: true,
        using_defaults: program.using_defaults,
      },
      isSalesContractor: ctx.isSalesContractor,
      subscriptionExempt: ctx.subscriptionExempt,
      // Owner / finance / admin: free full access (not the same as e-signed)
      signed,
      agreementSigned: reallySigned,
      subscriptionActive: subActive,
      subscription: agr.agreement.subscription || null,
      // Overlay live program tiers on pending agreements for the client UI
      agreement: reallySigned
        ? agr.agreement
        : {
            ...agr.agreement,
            commission_tiers: tiers,
            contract_version: contractVersion,
            max_commission_pct: program.max_commission_pct,
            min_commission_pct: program.min_commission_pct,
          },
      contractVersion: contractVersion || SALES_CONTRACTOR_CONTRACT_VERSION,
      html: bodyHtml,
      downloadUrl: `/api/sales/agreement?companyId=${companyId}&privyUserId=${encodeURIComponent(privyUserId || '')}&format=download`,
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

    const program = await resolveProgramSettings(companyId);
    const tiers = program.commission_tiers;
    const snapshot = programSnapshotForAgreement(program);
    const supabase = getSupabaseServer();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('sales_contractor_agreements')
      .update({
        status: 'signed',
        signed_at: now,
        signature_name: signatureName,
        signature_email: ctx.email || null,
        user_id: ctx.userId,
        contractor_name: signatureName,
        contract_version: program.contract_version || SALES_CONTRACTOR_CONTRACT_VERSION,
        commission_tiers: tiers,
        max_commission_pct: program.max_commission_pct,
        min_commission_pct: program.min_commission_pct,
        currency: program.currency || 'ZAR',
        terms_summary: tiersSummaryText(tiers),
        updated_at: now,
        metadata: {
          signed_via: 'sales_portal',
          program_snapshot: snapshot,
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
      metadata: {
        version: program.contract_version || SALES_CONTRACTOR_CONTRACT_VERSION,
      },
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
