import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  requireCompanyRoles,
  legacyPrivyFrom,
  ROLES_FINANCE_CRITICAL,
} from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/customers/access';
import {
  getOrCreateSalesProgramSettings,
  resolveProgramSettings,
  updateSalesProgramSettings,
  type SalesProgramPatch,
} from '@/lib/sales-program';
import { calculateCommission } from '@/lib/sales-contractor/commission';

/**
 * GET ?companyId=&privyUserId=
 * Company sales program (legal, commission, criteria). Falls back to platform defaults.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const _gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!_gate.ok) return _gate.response;

    const ensure = request.nextUrl.searchParams.get('ensure') === '1';
    let settings;
    if (ensure) {
      const created = await getOrCreateSalesProgramSettings(companyId);
      if (!created.ok) {
        return NextResponse.json(
          { error: created.error },
          { status: created.status }
        );
      }
      settings = created.settings;
    } else {
      settings = await resolveProgramSettings(companyId);
    }

    // Live commission samples for admin UI
    const sampleAmounts = [50_000, 250_000, 720_000, 1_440_000, 2_500_000];
    const samples = sampleAmounts.map((amount) => {
      const r = calculateCommission(amount, {
        tiers: settings.commission_tiers,
        currency: settings.currency,
      });
      return {
        amount,
        commission: r.commissionAmount,
        effectiveRatePct: r.effectiveRatePct,
      };
    });

    return NextResponse.json({
      success: true,
      settings,
      samples,
      canEdit: true,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH — owner/admin/finance update company sales program.
 * Body: { companyId, privyUserId, ...SalesProgramPatch fields }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const gate = await requireCompanyRoles(
      request,
      companyId,
      ROLES_FINANCE_CRITICAL,
      { legacyPrivyUserId: body.privyUserId || legacyPrivyFrom(request) }
    );
    if (!gate.ok) return gate.response;

    const patch: SalesProgramPatch = {};
    const keys: (keyof SalesProgramPatch)[] = [
      'program_name',
      'program_summary',
      'is_enabled',
      'contract_title',
      'contract_version',
      'legal_body_html',
      'legal_addendum_html',
      'email_domain',
      'require_re_sign_on_change',
      'commission_tiers',
      'min_commission_pct',
      'max_commission_pct',
      'currency',
      'example_units',
      'example_unit_price',
      'example_label',
      'sales_criteria',
      'reseller_criteria',
      'eligibility_notes',
      'program_info_html',
      'metadata',
    ];
    for (const k of keys) {
      if (body[k] !== undefined) {
        (patch as Record<string, unknown>)[k] = body[k];
      }
    }

    const result = await updateSalesProgramSettings(companyId, patch);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    void logActivity({
      profile_id: companyId,
      actor_user_id: gate.userId,
      action: 'sales_program.settings_updated',
      entity_type: 'sales_program_settings',
      entity_id:
        result.settings.id != null ? String(result.settings.id) : undefined,
      summary: `Updated sales program (${result.settings.contract_version})`,
      metadata: {
        version: result.settings.contract_version,
        rates: result.settings.commission_tiers.map((t) => t.ratePct),
      },
    });

    return NextResponse.json({
      success: true,
      settings: result.settings,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
