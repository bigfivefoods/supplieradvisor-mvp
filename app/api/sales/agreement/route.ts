import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  assertSalesPortalAccess,
  getOrCreateAgreement,
  isAgreementSigned,
  mapAgreementRow,
  updateSalesAgreementRow,
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
import {
  cleanAgreementText,
  CONTRACTOR_COMPANY_NAME_MAX,
  CONTRACTOR_REGISTRATION_MAX,
  contractorContractingParty,
  withContractorEntityMetadata,
} from '@/lib/sales-contractor/party';

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
    const format = String(
      request.nextUrl.searchParams.get('format') || ''
    ).toLowerCase();
    const ctx = await assertSalesPortalAccess(_gate.userId, companyId);
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
    const companyParam = request.nextUrl.searchParams.get('contractorCompanyName');
    const registrationParam = request.nextUrl.searchParams.get(
      'contractorRegistrationNumber'
    );
    const contractorCompanyName =
      !reallySigned && companyParam !== null
        ? cleanAgreementText(companyParam, CONTRACTOR_COMPANY_NAME_MAX) || null
        : agr.agreement.contractor_company_name || null;
    const contractorRegistrationNumber =
      !reallySigned && registrationParam !== null
        ? cleanAgreementText(registrationParam, CONTRACTOR_REGISTRATION_MAX) || null
        : agr.agreement.contractor_registration_number || null;
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
      contractorCompanyName,
      contractorRegistrationNumber,
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
      contractorCompanyName,
      contractorRegistrationNumber,
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
      downloadUrl: `/api/sales/agreement?companyId=${companyId}&format=download`,
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
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;
    const ctx = await assertSalesPortalAccess(gate.userId, companyId);
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const draftOnly = body.intent === 'draft';
    const entityCompany = cleanAgreementText(
      body.contractorCompanyName,
      CONTRACTOR_COMPANY_NAME_MAX
    );
    const entityRegistration = cleanAgreementText(
      body.contractorRegistrationNumber,
      CONTRACTOR_REGISTRATION_MAX
    );
    const entity = {
      company: entityCompany || null,
      registration: entityRegistration || null,
    };

    if (!draftOnly && !body.accepted) {
      return NextResponse.json(
        { error: 'You must accept the agreement to continue.' },
        { status: 400 }
      );
    }

    const signatureName = String(body.signatureName || '').trim();
    if (!draftOnly && signatureName.length < 2) {
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
      if (draftOnly) {
        return NextResponse.json(
          { error: 'This agreement is already signed.' },
          { status: 409 }
        );
      }
      return NextResponse.json({
        success: true,
        alreadySigned: true,
        agreement: agr.agreement,
      });
    }

    const supabase = getSupabaseServer();
    const { data: existingRow } = await supabase
      .from('sales_contractor_agreements')
      .select('metadata')
      .eq('id', agr.agreement.id)
      .maybeSingle();
    const entityMetadata = withContractorEntityMetadata(existingRow?.metadata, entity);

    if (draftOnly) {
      const now = new Date().toISOString();
      const saved = await updateSalesAgreementRow(agr.agreement.id, {
        contractor_company_name: entity.company,
        contractor_registration_number: entity.registration,
        metadata: entityMetadata,
        updated_at: now,
      });
      if (saved.error) {
        return NextResponse.json({ error: saved.error.message }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        draft: true,
        agreement: mapAgreementRow(saved.data || {}),
      });
    }

    const program = await resolveProgramSettings(companyId);
    const tiers = program.commission_tiers;
    const snapshot = programSnapshotForAgreement(program);
    const now = new Date().toISOString();
    const saved = await updateSalesAgreementRow(agr.agreement.id, {
      status: 'signed',
      signed_at: now,
      signature_name: signatureName,
      signature_email: ctx.email || null,
      user_id: ctx.userId,
      contractor_name: signatureName,
      contractor_company_name: entity.company,
      contractor_registration_number: entity.registration,
      contract_version: program.contract_version || SALES_CONTRACTOR_CONTRACT_VERSION,
      commission_tiers: tiers,
      max_commission_pct: program.max_commission_pct,
      min_commission_pct: program.min_commission_pct,
      currency: program.currency || 'ZAR',
      terms_summary: tiersSummaryText(tiers),
      updated_at: now,
      metadata: {
        ...entityMetadata,
        signed_via: 'sales_portal',
        program_snapshot: snapshot,
        user_agent:
          typeof body.userAgent === 'string' ? body.userAgent.slice(0, 300) : null,
        contract_resent_at: agr.agreement.contract_resent_at || null,
        contract_resend_count: agr.agreement.contract_resend_count || 0,
      },
    });

    if (saved.error || !saved.data) {
      return NextResponse.json(
        { error: saved.error?.message || 'Could not save the agreement' },
        { status: 500 }
      );
    }
    const data = saved.data;

    void logActivity({
      profile_id: companyId,
      actor_user_id: ctx.userId,
      action: 'sales_contractor.agreement_signed',
      entity_type: 'sales_contractor_agreement',
      entity_id: String(agr.agreement.id),
      summary: `${contractorContractingParty({
        personName: signatureName,
        companyName: entity.company,
        registrationNumber: entity.registration,
      })} signed Independent Sales Contractor Agreement`,
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
