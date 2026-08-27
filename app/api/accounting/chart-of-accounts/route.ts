import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { ensureDefaultCoa, parseCompanyId } from '@/lib/accounting/server';
import { fetchAccountTotals } from '@/lib/accounting/account-totals';
import {
  getCachedCoa,
  invalidateAccountingReads,
} from '@/lib/accounting/read-cache';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/** GET ?companyId=&seed=1&q= — list CoA; optional seed of defaults when empty */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const seed = request.nextUrl.searchParams.get('seed') === '1';
    const q = request.nextUrl.searchParams.get('q');
    const type = request.nextUrl.searchParams.get('type');

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    let seeded = 0;
    let seedWarning: string | undefined;
    if (seed) {
      const r = await ensureDefaultCoa(companyId);
      seeded = r.seeded;
      seedWarning = r.warning;
      const { ensurePartyGlAccountsSafe } = await import(
        '@/lib/accounting/party-gl-accounts'
      );
      await ensurePartyGlAccountsSafe(companyId);
      if (seeded) invalidateAccountingReads(companyId);
    }

    let accounts = await getCachedCoa(companyId);
    if (type && type !== 'all') {
      accounts = accounts.filter((a) => a.account_type === type);
    }
    if (q) {
      const n = q.toLowerCase();
      accounts = accounts.filter(
        (a) =>
          a.code?.toLowerCase().includes(n) ||
          a.name?.toLowerCase().includes(n) ||
          a.account_type?.toLowerCase().includes(n)
      );
    }

    const wantBalances =
      request.nextUrl.searchParams.get('balances') !== '0';
    const bal: Record<number, number> = {};
    if (wantBalances) {
      const totals = await fetchAccountTotals({ profileId: companyId });
      for (const row of totals.rows) {
        bal[row.account_id] = row.debit - row.credit;
      }
    }

    const enriched = accounts.map((a) => {
      const raw = bal[a.id] || 0;
      // Present normal balance: liabilities/equity/revenue show credit-positive
      const normal = a.normal_balance || (['liability', 'equity', 'revenue'].includes(a.account_type) ? 'credit' : 'debit');
      const balance = normal === 'credit' ? -raw : raw;
      return { ...a, balance };
    });

    return NextResponse.json({
      success: true,
      accounts: enriched,
      seeded,
      warning: seedWarning,
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
