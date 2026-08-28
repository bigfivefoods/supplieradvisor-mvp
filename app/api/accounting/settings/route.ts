import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { getOrCreateSettings, parseCompanyId } from '@/lib/accounting/server';
import {
  getCachedCoa,
  getCachedSettings,
  invalidateAccountingReads,
} from '@/lib/accounting/read-cache';
import {
  eligibleApParent,
  eligibleArParent,
  mergePartyLedgerMetadata,
  parsePartyLedgerStored,
  partyLedgerValidationError,
  resolvePartyLedgerParents,
  storedFromPatch,
} from '@/lib/accounting/party-ledger-settings';
import {
  requireCompanyAccess,
  requireCompanyRoles,
  ROLES_FINANCE_CRITICAL,
  legacyPrivyFrom,
  requireVerifiedUser,
} from '@/lib/auth/api-auth';

export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const settings = await getCachedSettings(companyId);
    const coa = await getCachedCoa(companyId);
    const stored = parsePartyLedgerStored(settings?.metadata);
    const party_ledger = {
      ...stored,
      parents: resolvePartyLedgerParents(stored, coa),
    };

    const supabase = getSupabaseServer();
    const { data: periods } = await supabase
      .from('accounting_periods')
      .select('*')
      .eq('profile_id', companyId)
      .order('start_date', { ascending: false })
      .limit(24);

    return NextResponse.json({
      success: true,
      settings,
      party_ledger,
      ar_parents: coa.filter((a) => eligibleArParent(a)),
      ap_parents: coa.filter((a) => eligibleApParent(a)),
      periods: periods || [],
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const privyUserId = body.privyUserId as string | undefined;

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const acc = await assertAccountingAccess(_gate.userId, companyId, 'write');
    if (!acc.ok) {
      return NextResponse.json({ error: acc.error }, { status: acc.status });
    }

    if (body.fiscal_year_start_month != null) {
      return NextResponse.json(
        {
          error:
            'Financial year is set in Company → Settings. Only the owner or finance lead can change it.',
        },
        { status: 400 }
      );
    }

    const current = await getOrCreateSettings(companyId);

    const allowed = [
      'base_currency',
      'default_tax_rate',
      'invoice_prefix_ar',
      'invoice_prefix_ap',
      'journal_prefix',
      'next_ar_number',
      'next_ap_number',
      'next_journal_number',
      'lock_date',
      'require_balanced_journals',
      'metadata',
    ];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }

    if (body.party_ledger !== undefined) {
      const coa = await getCachedCoa(companyId);
      const raw =
        body.party_ledger && typeof body.party_ledger === 'object'
          ? (body.party_ledger as Record<string, unknown>)
          : {};
      const stored = storedFromPatch(raw, coa);
      const invalid = partyLedgerValidationError(stored, coa);
      if (invalid) {
        return NextResponse.json({ error: invalid }, { status: 400 });
      }
      const prevMeta =
        patch.metadata !== undefined ? patch.metadata : current.metadata;
      patch.metadata = mergePartyLedgerMetadata(prevMeta, stored);
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('accounting_settings')
      .update(patch)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    invalidateAccountingReads(companyId);
    return NextResponse.json({ success: true, settings: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** POST — create accounting period or year-end close */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const privyUserId = body.privyUserId as string | undefined;

    if (body.action === 'year_end_close') {
      if (!Number.isFinite(companyId)) {
        return NextResponse.json({ error: 'companyId required' }, { status: 400 });
      }
      const gate = await requireCompanyRoles(
        request,
        companyId,
        ROLES_FINANCE_CRITICAL,
        { legacyPrivyUserId: privyUserId || legacyPrivyFrom(request, body) }
      );
      if (!gate.ok) return gate.response;
      const { closeFiscalYear } = await import('@/lib/accounting/year-end-close');
      const result = await closeFiscalYear({
        profileId: companyId,
        fyStartYear: body.fyStartYear != null ? Number(body.fyStartYear) : undefined,
        createdBy: gate.userId || privyUserId || null,
        lockPeriods: body.lockPeriods !== false,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, close: result });
    }

    if (!Number.isFinite(companyId) || !body.name || !body.start_date || !body.end_date) {
      return NextResponse.json(
        { error: 'companyId, name, start_date, end_date required' },
        { status: 400 }
      );
    }
    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: privyUserId || legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('accounting_periods')
      .insert({
        profile_id: companyId,
        entity_id: body.entity_id || null,
        name: body.name,
        start_date: body.start_date,
        end_date: body.end_date,
        status: body.status || 'open',
        fiscal_year: body.fiscal_year || new Date(body.start_date).getFullYear(),
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, period: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
