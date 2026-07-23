import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId, round2 } from '@/lib/accounting/server';
import { computeBookValue, monthlyDepreciation } from '@/lib/accounting/types';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('fixed_assets')
      .select('*')
      .eq('profile_id', companyId)
      .order('name');

    if (error) {
      return NextResponse.json({
        success: true,
        assets: [],
        warning: error.message,
        hint: 'Run supabase/migrations/20260710_accounting_module.sql',
      });
    }

    const assets = (data || []).map((a) => ({
      ...a,
      book_value:
        a.book_value != null ? Number(a.book_value) : computeBookValue(a),
      monthly_depreciation: monthlyDepreciation(a),
    }));

    return NextResponse.json({ success: true, assets });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const privyUserId = body.privyUserId as string | undefined;

    if (!Number.isFinite(companyId) || !body.name) {
      return NextResponse.json({ error: 'companyId and name required' }, { status: 400 });
    }
    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: privyUserId || legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    // action: depreciate — post one period of depreciation (+ GL)
    if (body.action === 'depreciate') {
      const id = Number(body.id);
      if (!Number.isFinite(id)) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
      }
      const { postFixedAssetDepreciation } = await import(
        '@/lib/accounting/balance-sheet-allocate'
      );
      const result = await postFixedAssetDepreciation({
        companyId,
        fixedAssetId: id,
        periods: body.periods != null ? Number(body.periods) : 1,
        createdBy: _gate.userId || privyUserId || null,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error || 'Depreciation failed' },
          { status: 400 }
        );
      }
      return NextResponse.json({
        success: true,
        asset: result.asset,
        depreciation_amount: result.amount ?? 0,
        journal: result.journalId
          ? { id: result.journalId, entryNumber: result.entryNumber }
          : null,
        journalWarning: result.journalId
          ? undefined
          : result.error || 'Register updated; seed COA to post depreciation GL',
      });
    }

    // action: capitalize — post asset to balance sheet (Dr PPE · Cr AP)
    if (body.action === 'capitalize' || body.action === 'post_to_bs') {
      const id = Number(body.id);
      if (!Number.isFinite(id)) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
      }
      const { capitalizeFixedAsset } = await import(
        '@/lib/accounting/balance-sheet-allocate'
      );
      const result = await capitalizeFixedAsset({
        companyId,
        fixedAssetId: id,
        createdBy: _gate.userId || privyUserId || null,
        creditSide:
          body.creditSide === 'bank' || body.creditSide === 'equity'
            ? body.creditSide
            : 'ap',
        force: body.force === true,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error || 'Capitalisation failed' },
          { status: 400 }
        );
      }
      const supabase = getSupabaseServer();
      const { data: asset } = await supabase
        .from('fixed_assets')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      return NextResponse.json({
        success: true,
        asset,
        journal: result.journalId
          ? { id: result.journalId, entryNumber: result.entryNumber }
          : null,
        skipped: result.skipped,
      });
    }

    // action: capitalize_all — batch put register assets onto BS
    if (body.action === 'capitalize_all' || body.action === 'ensure_bs') {
      const { ensureAllAssetsOnBalanceSheet } = await import(
        '@/lib/accounting/balance-sheet-allocate'
      );
      const result = await ensureAllAssetsOnBalanceSheet({
        companyId,
        createdBy: _gate.userId || privyUserId || null,
        creditSide:
          body.creditSide === 'bank' || body.creditSide === 'equity'
            ? body.creditSide
            : 'ap',
      });
      return NextResponse.json({ success: true, ...result });
    }

    const cost = round2(Number(body.purchase_cost || 0));
    const accum = round2(Number(body.accumulated_depreciation || 0));
    const book = round2(cost - accum);

    const supabase = getSupabaseServer();
    const payload: Record<string, unknown> = {
      profile_id: companyId,
      entity_id: body.entity_id || null,
      asset_code: body.asset_code || null,
      name: body.name,
      category: body.category || 'equipment',
      purchase_date: body.purchase_date || null,
      purchase_cost: cost,
      residual_value: round2(Number(body.residual_value || 0)),
      useful_life_months: Number(body.useful_life_months || 60),
      depreciation_method: body.depreciation_method || 'straight_line',
      depreciation_rate:
        body.depreciation_rate != null ? Number(body.depreciation_rate) : null,
      accumulated_depreciation: accum,
      book_value: book,
      status: body.status || 'active',
      location: body.location || null,
      serial_number: body.serial_number || null,
      notes: body.notes || null,
      gl_asset_account_id: body.gl_asset_account_id || null,
      gl_depr_account_id: body.gl_depr_account_id || null,
      gl_expense_account_id: body.gl_expense_account_id || null,
      business_unit_id: body.business_unit_id
        ? Number(body.business_unit_id)
        : null,
      work_center_id: body.work_center_id ? Number(body.work_center_id) : null,
      work_station_id: body.work_station_id
        ? Number(body.work_station_id)
        : null,
      manufacturing_asset_id: body.manufacturing_asset_id
        ? Number(body.manufacturing_asset_id)
        : null,
      metadata: body.metadata || {},
    };

    let { data, error } = await supabase
      .from('fixed_assets')
      .insert(payload)
      .select('*')
      .single();

    if (error && /column|schema cache|does not exist/i.test(error.message)) {
      const {
        business_unit_id: _b,
        work_center_id: _w,
        work_station_id: _s,
        manufacturing_asset_id: _m,
        ...minimal
      } = payload;
      const retry = await supabase
        .from('fixed_assets')
        .insert(minimal)
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Default: capitalise onto balance sheet (Dr PPE · Cr AP)
    let capitalisation: {
      ok: boolean;
      journalId?: number;
      entryNumber?: string;
      skipped?: boolean;
      error?: string;
    } | null = null;
    if (body.capitalize !== false && data?.id && cost > 0) {
      try {
        const { capitalizeFixedAsset } = await import(
          '@/lib/accounting/balance-sheet-allocate'
        );
        capitalisation = await capitalizeFixedAsset({
          companyId,
          fixedAssetId: Number(data.id),
          createdBy: _gate.userId || privyUserId || null,
          creditSide:
            body.creditSide === 'bank' || body.creditSide === 'equity'
              ? body.creditSide
              : 'ap',
        });
        if (capitalisation.ok && capitalisation.journalId) {
          const { data: refreshed } = await supabase
            .from('fixed_assets')
            .select('*')
            .eq('id', data.id)
            .maybeSingle();
          if (refreshed) data = refreshed;
        }
      } catch (e: unknown) {
        capitalisation = {
          ok: false,
          error: e instanceof Error ? e.message : 'Capitalise failed',
        };
      }
    }

    return NextResponse.json({
      success: true,
      asset: data,
      journal: capitalisation?.journalId
        ? { id: capitalisation.journalId, entryNumber: capitalisation.entryNumber }
        : null,
      journalWarning:
        capitalisation && !capitalisation.ok
          ? capitalisation.error
          : capitalisation?.skipped
            ? undefined
            : undefined,
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
    const id = Number(body.id);
    const privyUserId = body.privyUserId as string | undefined;

    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: privyUserId || legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const allowed = [
      'asset_code',
      'name',
      'category',
      'purchase_date',
      'purchase_cost',
      'residual_value',
      'useful_life_months',
      'depreciation_method',
      'depreciation_rate',
      'accumulated_depreciation',
      'status',
      'disposal_date',
      'disposal_proceeds',
      'location',
      'serial_number',
      'notes',
      'entity_id',
      'business_unit_id',
      'work_center_id',
      'work_station_id',
      'gl_asset_account_id',
      'gl_depr_account_id',
      'gl_expense_account_id',
    ];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    if (body.purchase_cost != null || body.accumulated_depreciation != null) {
      const cost = Number(body.purchase_cost ?? 0);
      const accum = Number(body.accumulated_depreciation ?? 0);
      if (body.purchase_cost != null && body.accumulated_depreciation != null) {
        patch.book_value = round2(cost - accum);
      }
    }
    if (body.status === 'disposed' && !body.disposal_date) {
      patch.disposal_date = new Date().toISOString().slice(0, 10);
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('fixed_assets')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, asset: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
