import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { loadCommercialDocument } from '@/lib/customers/load-commercial-doc';

/**
 * GET ?companyId=&type=invoice|quote|order&id=
 * Pre-send quality checklist (bank, logo, VAT, reg) without sending email.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const id = Number(sp.get('id'));
    const type = String(sp.get('type') || 'invoice').toLowerCase() as
      | 'quote'
      | 'order'
      | 'invoice';

    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'companyId, type, id required' },
        { status: 400 }
      );
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const loaded = await loadCommercialDocument({ companyId, type, id });
    if (!loaded.ok) {
      return NextResponse.json(
        { error: loaded.error },
        { status: loaded.status }
      );
    }

    const blockers: string[] = [];
    if (type === 'invoice' && !loaded.bankDetailsIncluded) {
      blockers.push(
        loaded.bankWarning ||
          'Bank details missing — EFT instructions will not appear on the invoice.'
      );
    }

    return NextResponse.json({
      success: true,
      type,
      id,
      toEmail: loaded.toEmail,
      bankDetailsIncluded: loaded.bankDetailsIncluded,
      bankVerified: loaded.bankVerified,
      cipcVerified: loaded.cipcVerified,
      bankWarning: loaded.bankWarning,
      hasLogo: loaded.hasLogo,
      hasVat: loaded.hasVat,
      hasRegistration: loaded.hasRegistration,
      softWarnings: loaded.softWarnings,
      blockers,
      ready: blockers.length === 0,
      checklist: [
        {
          key: 'bank',
          label: 'Bank details for EFT',
          ok: loaded.bankDetailsIncluded,
          required: type === 'invoice',
        },
        {
          key: 'logo',
          label: 'Company logo',
          ok: loaded.hasLogo,
          required: false,
        },
        {
          key: 'vat',
          label: 'VAT number',
          ok: loaded.hasVat,
          required: false,
        },
        {
          key: 'registration',
          label: 'Company registration',
          ok: loaded.hasRegistration,
          required: false,
        },
        {
          key: 'cipc',
          label: 'CIPC verified',
          ok: loaded.cipcVerified,
          required: false,
        },
        {
          key: 'bank_avs',
          label: 'Bank AVS verified',
          ok: loaded.bankVerified,
          required: false,
        },
      ],
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
