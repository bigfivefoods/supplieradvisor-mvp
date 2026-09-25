import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { ensureDefaultCoa, parseCompanyId } from '@/lib/accounting/server';
import { dayBeforeIso, fetchAccountTotals } from '@/lib/accounting/account-totals';
import {
  filterCoaAccounts,
  parseIsoDateParam,
  sliceCoaAccounts,
} from '@/lib/accounting/coa-slice';
import {
  buildCoaWorkbook,
  COA_XLSX_MIME,
  coaExportFilename,
} from '@/lib/accounting/coa-xlsx';
import {
  getCachedCoa,
  invalidateAccountingReads,
} from '@/lib/accounting/read-cache';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

async function companyDisplayName(companyId: number): Promise<string> {
  try {
    const supabase = getSupabaseServer();
    const { data: profile } = await supabase
      .from('profiles')
      .select('trading_name, legal_name')
      .eq('id', companyId)
      .maybeSingle();
    return (
      profile?.trading_name || profile?.legal_name || `Company #${companyId}`
    );
  } catch {
    return `Company #${companyId}`;
  }
}

/** GET ?companyId=&from=&to=&type=&q=&format=xlsx — list CoA, or download the period slice */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const seed = request.nextUrl.searchParams.get('seed') === '1';
    const q = request.nextUrl.searchParams.get('q');
    const type = request.nextUrl.searchParams.get('type');
    const format = request.nextUrl.searchParams.get('format');
    const fromRaw = request.nextUrl.searchParams.get('from');
    const toRaw = request.nextUrl.searchParams.get('to');
    const from = parseIsoDateParam(fromRaw);
    const to = parseIsoDateParam(toRaw);

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if ((fromRaw && !from) || (toRaw && !to)) {
      return NextResponse.json(
        { error: 'from and to must be YYYY-MM-DD' },
        { status: 400 }
      );
    }
    if ((from && !to) || (!from && to)) {
      return NextResponse.json(
        { error: 'from and to must be provided together' },
        { status: 400 }
      );
    }
    if (from && to && from > to) {
      return NextResponse.json(
        { error: 'from must be on or before to' },
        { status: 400 }
      );
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    let seeded = 0;
    let seedWarning: string | undefined;
    if (seed) {
      const r = await ensureDefaultCoa(companyId);
      seeded = r.seeded;
      seedWarning = r.warning;
      if (seeded) invalidateAccountingReads(companyId);
    }
    const { ensurePartyGlAccountsCached } = await import(
      '@/lib/accounting/party-gl-accounts'
    );
    await ensurePartyGlAccountsCached(companyId);

    const accounts = await getCachedCoa(companyId);
    const wantBalances =
      format === 'xlsx' || request.nextUrl.searchParams.get('balances') !== '0';

    if (!wantBalances) {
      return NextResponse.json({
        success: true,
        accounts: filterCoaAccounts(accounts, { type, q }).map((account) => ({
          ...account,
          balance: 0,
        })),
        seeded,
        warning: seedWarning,
      });
    }

    let totalsWarning: string | undefined;
    let sliced: ReturnType<typeof sliceCoaAccounts>;
    if (from && to) {
      const [openingTotals, periodTotals] = await Promise.all([
        fetchAccountTotals({ profileId: companyId, to: dayBeforeIso(from) }),
        fetchAccountTotals({ profileId: companyId, from, to }),
      ]);
      sliced = sliceCoaAccounts({
        accounts,
        opening: openingTotals.rows,
        period: periodTotals.rows,
      });
      totalsWarning =
        [openingTotals.warning, periodTotals.warning].filter(Boolean).join(' ') ||
        undefined;
    } else {
      const totals = await fetchAccountTotals({ profileId: companyId });
      sliced = sliceCoaAccounts({
        accounts,
        opening: [],
        period: totals.rows,
      });
      totalsWarning = totals.warning;
    }

    const view = filterCoaAccounts(sliced, { type, q });
    if (format === 'xlsx') {
      const label = request.nextUrl.searchParams.get('label');
      const bytes = new Uint8Array(
        buildCoaWorkbook({
          companyName: await companyDisplayName(companyId),
          periodLabel:
            label || (from && to ? `${from} to ${to}` : 'All posted activity'),
          from,
          to,
          typeFilter: type,
          search: q,
          warning: seedWarning || totalsWarning,
          rows: view,
        })
      );
      const filename = coaExportFilename(from, to);
      return new NextResponse(bytes, {
        status: 200,
        headers: {
          'Content-Type': COA_XLSX_MIME,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(bytes.byteLength),
          'Cache-Control': 'private, no-store',
        },
      });
    }

    return NextResponse.json({
      success: true,
      accounts: view,
      seeded,
      warning: seedWarning || totalsWarning,
      period: from && to ? { from, to, label: request.nextUrl.searchParams.get('label') } : null,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** POST — create account or seed defaults { companyId, seed: true } or account fields */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const privyUserId = body.privyUserId as string | undefined;

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    if (body.seed) {
      const r = await ensureDefaultCoa(companyId);
      invalidateAccountingReads(companyId);
      let party: { created: number; linked: number; warning?: string } | undefined;
      try {
        const { ensurePartyGlAccounts } = await import(
          '@/lib/accounting/party-gl-accounts'
        );
        party = await ensurePartyGlAccounts(companyId);
      } catch {
        party = undefined;
      }
      return NextResponse.json({ success: true, ...r, party });
    }

    if (body.ensure_party) {
      const { ensurePartyGlAccounts } = await import(
        '@/lib/accounting/party-gl-accounts'
      );
      const party = await ensurePartyGlAccounts(companyId);
      invalidateAccountingReads(companyId);
      return NextResponse.json({ success: true, ...party });
    }

    if (!body.code || !body.name || !body.account_type) {
      return NextResponse.json(
        { error: 'code, name, and account_type required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .insert({
        profile_id: companyId,
        code: String(body.code).trim(),
        name: String(body.name).trim(),
        account_type: body.account_type,
        subtype: body.subtype || null,
        parent_id: body.parent_id || null,
        is_active: body.is_active !== false,
        is_header: !!body.is_header,
        is_system: false,
        currency: body.currency || 'ZAR',
        tax_code: body.tax_code || null,
        normal_balance: body.normal_balance || null,
        description: body.description || null,
        entity_id: body.entity_id || null,
        sort_order: body.sort_order ?? 0,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    invalidateAccountingReads(companyId);
    return NextResponse.json({ success: true, account: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** PATCH — update account */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const id = Number(body.id);
    const privyUserId = body.privyUserId as string | undefined;

    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: privyUserId || legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const allowed = [
      'code',
      'name',
      'account_type',
      'subtype',
      'parent_id',
      'is_active',
      'is_header',
      'currency',
      'tax_code',
      'normal_balance',
      'description',
      'entity_id',
      'sort_order',
    ];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    invalidateAccountingReads(companyId);
    return NextResponse.json({ success: true, account: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** DELETE ?companyId=&id= — deactivate or delete non-system account */
export async function DELETE(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const id = Number(request.nextUrl.searchParams.get('id'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const hard = request.nextUrl.searchParams.get('hard') === '1';

    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: privyUserId || legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    if (hard) {
      const { error } = await supabase
        .from('chart_of_accounts')
        .delete()
        .eq('id', id)
        .eq('profile_id', companyId)
        .eq('is_system', false);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    } else {
      const { error } = await supabase
        .from('chart_of_accounts')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('profile_id', companyId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    invalidateAccountingReads(companyId);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
