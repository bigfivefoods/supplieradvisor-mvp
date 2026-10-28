import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { assertCanManageTeam } from '@/lib/business/access';
import { normalizeTeamRole } from '@/lib/business/permissions';
import { isListedTeamMember } from '@/lib/business/types';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  getSalesContractorAgreementHtml,
  SALES_CONTRACTOR_CONTRACT_VERSION,
} from '@/lib/sales-contractor/agreement';
import { buildSalesAgreementPdf } from '@/lib/sales-contractor/agreement-pdf';
import { mapAgreementRow, updateSalesAgreementRow } from '@/lib/sales-contractor/access';
import {
  agreementPartyLabel,
  pickStoredAgreement,
  proofsForContractors,
  type AgreementStoreRow,
} from '@/lib/sales-contractor/company-records';
import { liveCommissionTiers, resolveProgramSettings } from '@/lib/sales-program';
import { buildTeamInviteLink } from '@/lib/invites/email';
import { auditLog } from '@/lib/audit/log';
import { logActivity } from '@/lib/customers/access';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import {
  agreementFilenameParty,
  agreementResendDecision,
  contractorContractingParty,
  withResendMetadata,
} from '@/lib/sales-contractor/party';
import { deliverSalesContractorAgreementEmail } from '@/lib/sales-contractor/send-agreement';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const AGREEMENT_SELECT =
  'id, profile_id, business_user_id, user_id, contractor_email, contractor_name, status, contract_version, commission_tiers, max_commission_pct, min_commission_pct, currency, signed_at, signature_name, signature_email, accepted_ip, terms_summary, subscription_status, subscription_starts_at, subscription_ends_at, subscription_paystack_ref, subscription_amount_zar, metadata, created_at, updated_at';

function missingTable(message: string): boolean {
  return /relation|does not exist|schema cache/i.test(message);
}

function fileSlug(value: string, fallback: string): string {
  const slug = value
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return slug || fallback;
}

/**
 * Company record of sales-contractor agreements.
 * Reads stored rows only. Does not create a pending agreement for the caller.
 *
 * GET ?companyId=                         owners/admins: proof list
 * GET ?companyId=&memberId=&format=pdf    PDF rebuilt from that member's row
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const manager = await assertCanManageTeam(gate.userId, companyId);
    if (!manager.ok) {
      return NextResponse.json({ error: manager.error }, { status: manager.status });
    }

    const format = String(request.nextUrl.searchParams.get('format') || '').toLowerCase();
    const memberIdRaw = request.nextUrl.searchParams.get('memberId');
    const memberId = memberIdRaw != null && memberIdRaw !== '' ? Number(memberIdRaw) : null;
    if (format === 'pdf' && !Number.isFinite(memberId)) {
      return NextResponse.json({ error: 'memberId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: agreementRows, error: agreementErr } = await supabase
      .from('sales_contractor_agreements')
      .select(AGREEMENT_SELECT)
      .eq('profile_id', companyId)
      .order('id', { ascending: false })
      .limit(500);

    if (agreementErr) {
      if (missingTable(agreementErr.message)) {
        return NextResponse.json(
          {
            error:
              'Sales contractor agreements are not available yet. Run supabase/migrations/20260710_sales_contractor_portal.sql',
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: agreementErr.message }, { status: 500 });
    }

    const rows = (agreementRows || []) as unknown as AgreementStoreRow[];

    if (format === 'pdf' && memberId != null) {
      const { data: member, error: memberErr } = await supabase
        .from('business_users')
        .select('id, profile_id, user_id, name, email, invited_email, role')
        .eq('profile_id', companyId)
        .eq('id', memberId)
        .maybeSingle();
      if (memberErr) {
        return NextResponse.json({ error: memberErr.message }, { status: 500 });
      }
      if (!member) {
        return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
      }

      const stored = pickStoredAgreement(
        { id: Number(member.id), user_id: member.user_id ? String(member.user_id) : null },
        rows,
        companyId
      );
      if (!stored) {
        return NextResponse.json(
          { error: 'No agreement is stored for this sales contractor yet.' },
          { status: 404 }
        );
      }

      const { data: company } = await supabase
        .from('profiles')
        .select('trading_name, legal_name')
        .eq('id', companyId)
        .maybeSingle();
      const companyName =
        company?.trading_name || company?.legal_name || 'Your company';

      const agreement = mapAgreementRow(stored as unknown as Record<string, unknown>);
      const program = await resolveProgramSettings(companyId);
      const accepted = Boolean(agreement.signed_at);
      const tiers = liveCommissionTiers(program, agreement);
      const contractVersion = accepted
        ? agreement.contract_version || program.contract_version
        : program.contract_version || SALES_CONTRACTOR_CONTRACT_VERSION;
      const contractorName =
        agreement.signature_name ||
        agreement.contractor_name ||
        (member.name ? String(member.name) : '') ||
        'Sales Contractor';
      const bodyHtml = getSalesContractorAgreementHtml({
        contractorName,
        companyName,
        tiers,
        program: {
          ...program,
          commission_tiers: tiers,
          contract_version: contractVersion,
        },
        contractorCompanyName: agreement.contractor_company_name,
        contractorRegistrationNumber: agreement.contractor_registration_number,
        signerCapacity: agreement.contractor_signer_capacity,
      });
      const pdf = await buildSalesAgreementPdf({
        bodyHtml,
        meta: {
          companyName,
          contractorName,
          contractVersion,
          status: accepted ? 'signed' : 'pending',
          signedAt: agreement.signed_at,
          signatureName: agreement.signature_name,
          signatureEmail:
            agreement.signature_email ||
            (member.email ? String(member.email) : null) ||
            (member.invited_email ? String(member.invited_email) : null),
          agreementId: agreement.id,
          contractorCompanyName: agreement.contractor_company_name,
          contractorRegistrationNumber: agreement.contractor_registration_number,
          signerCapacity: agreement.contractor_signer_capacity,
        },
      });
      const who = fileSlug(
        agreementFilenameParty(agreement.contractor_company_name, contractorName),
        'contractor'
      );
      const safeCo = fileSlug(companyName, 'company');
      const verSlug = fileSlug(String(contractVersion), 'agreement');
      const filename = accepted
        ? `sales-contractor-agreement-signed-${who}-${safeCo}-v${verSlug}.pdf`
        : `sales-contractor-agreement-draft-${who}-${safeCo}-v${verSlug}.pdf`;
      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'private, no-store',
          'Content-Length': String(pdf.length),
        },
      });
    }

    const { data: people, error: peopleErr } = await supabase
      .from('business_users')
      .select('id, user_id, role, status')
      .eq('profile_id', companyId)
      .limit(200);
    if (peopleErr) {
      return NextResponse.json({ error: peopleErr.message }, { status: 500 });
    }

    const contractors = (people || []).filter(
      (person) =>
        isListedTeamMember(person.status) &&
        normalizeTeamRole(person.role) === 'sales_contractor'
    );
    const records = proofsForContractors(
      contractors.map((person) => ({
        id: Number(person.id),
        user_id: person.user_id ? String(person.user_id) : null,
      })),
      rows,
      companyId
    );

    return NextResponse.json({
      success: true,
      storage: 'sales_contractor_agreements',
      records,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * POST { companyId, memberId }
 * Resend the unsigned agreement to the sales contractor.
 * A signed agreement is refused. Does not create an agreement row.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = Number(body.companyId);
    const memberId = Number(body.memberId);
    if (!Number.isFinite(companyId) || !Number.isFinite(memberId)) {
      return NextResponse.json(
        { error: 'companyId and memberId are required' },
        { status: 400 }
      );
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;
    const manager = await assertCanManageTeam(gate.userId, companyId);
    if (!manager.ok) {
      return NextResponse.json({ error: manager.error }, { status: manager.status });
    }

    const rl = checkRateLimit({
      key: `agreement-resend:${companyId}:${memberId}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      const limited = rateLimitResponse(rl.retryAfterSeconds);
      return NextResponse.json(limited.body, {
        status: limited.status,
        headers: limited.headers,
      });
    }

    const supabase = getSupabaseServer();
    const { data: member, error: memberErr } = await supabase
      .from('business_users')
      .select('id, profile_id, user_id, name, email, invited_email, role, status, invite_token')
      .eq('profile_id', companyId)
      .eq('id', memberId)
      .maybeSingle();
    if (memberErr) {
      return NextResponse.json({ error: memberErr.message }, { status: 500 });
    }
    if (!member || !isListedTeamMember(member.status)) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }
    if (normalizeTeamRole(member.role) !== 'sales_contractor') {
      return NextResponse.json(
        { error: 'Resend contract is only for a sales contractor.' },
        { status: 400 }
      );
    }

    const { data: agreementRows, error: agreementErr } = await supabase
      .from('sales_contractor_agreements')
      .select(AGREEMENT_SELECT)
      .eq('profile_id', companyId)
      .order('id', { ascending: false })
      .limit(500);
    if (agreementErr) {
      if (missingTable(agreementErr.message)) {
        return NextResponse.json(
          { error: 'Sales contractor agreements are not available yet.' },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: agreementErr.message }, { status: 500 });
    }

    const stored = pickStoredAgreement(
      { id: Number(member.id), user_id: member.user_id ? String(member.user_id) : null },
      (agreementRows || []) as unknown as AgreementStoreRow[],
      companyId
    );
    const agreement = stored
      ? mapAgreementRow(stored as unknown as Record<string, unknown>)
      : null;
    const email = String(member.email || member.invited_email || agreement?.contractor_email || '')
      .trim()
      .toLowerCase();
    const decision = agreementResendDecision({
      email,
      status: agreement?.status,
    });
    if (!decision.ok) {
      return NextResponse.json({ error: decision.error }, { status: decision.status });
    }

    const { data: company } = await supabase
      .from('profiles')
      .select('trading_name, legal_name')
      .eq('id', companyId)
      .maybeSingle();
    const hiringCompany =
      company?.trading_name || company?.legal_name || 'Your company';
    const personName =
      agreement?.signature_name ||
      agreement?.contractor_name ||
      (member.name ? String(member.name) : '') ||
      '';
    const status = String(member.status || '').toLowerCase();
    const token = member.invite_token ? String(member.invite_token) : '';
    const joinLink = status !== 'active' && token ? buildTeamInviteLink(token) : null;

    const sent = await deliverSalesContractorAgreementEmail({
      to: decision.email,
      personName,
      hiringCompanyName: hiringCompany,
      contractorCompanyName: agreement?.contractor_company_name,
      contractorRegistrationNumber: agreement?.contractor_registration_number,
      signerCapacity: agreement?.contractor_signer_capacity,
      invitedBy: manager.name || null,
      memberStatus: status,
      joinLink,
    });
    if (!sent.ok) {
      return NextResponse.json({ error: sent.error }, { status: sent.status });
    }

    const resentAt = new Date().toISOString();
    if (agreement && stored) {
      const saved = await updateSalesAgreementRow(agreement.id, {
        metadata: withResendMetadata(
          (stored as { metadata?: unknown }).metadata,
          resentAt
        ),
        contract_resent_at: resentAt,
        updated_at: resentAt,
      });
      if (saved.error) {
        console.error('agreement resend stamp:', saved.error.message);
      }
    }

    const party = contractorContractingParty({
      personName,
      companyName: agreement?.contractor_company_name,
      registrationNumber: agreement?.contractor_registration_number,
    });
    const summary = `Resent the sales contractor agreement to ${party || decision.email}`;
    void logActivity({
      profile_id: companyId,
      actor_user_id: gate.userId,
      action: 'sales_contractor.agreement_resent',
      entity_type: 'sales_contractor_agreement',
      entity_id: agreement ? String(agreement.id) : String(memberId),
      summary,
      metadata: {
        email: decision.email,
        resentAt,
        contractor_company_name: agreement?.contractor_company_name || null,
      },
    });
    void auditLog({
      companyId,
      actorUserId: gate.userId,
      action: 'sales_contractor.agreement_resent',
      entityType: 'sales_contractor_agreement',
      entityId: agreement ? agreement.id : memberId,
      summary,
      metadata: {
        email: decision.email,
        resentAt,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Agreement sent to ${decision.email}`,
      resentAt,
      email: decision.email,
      party: agreementPartyLabel({
        signatureName: personName,
        contractorName: personName,
        contractorCompanyName: agreement?.contractor_company_name,
        contractorRegistrationNumber: agreement?.contractor_registration_number,
      }),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
