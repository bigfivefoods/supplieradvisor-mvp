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

    // action: depreciate — post one period of depreciation
    if (body.action === 'depreciate') {
      const id = Number(body.id);
      if (!Number.isFinite(id)) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
      }
      const supabase = getSupabaseServer();
      const { data: asset, error } = await supabase
        .from('fixed_assets')
        .select('*')
        .eq('id', id)
        .eq('profile_id', companyId)
        .maybeSingle();
      if (error || !asset) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }
      const monthly = monthlyDepreciation(asset);
      const periods = Math.max(1, Number(body.periods || 1));
      const amount = round2(monthly * periods);
      const newAccum = round2(Number(asset.accumulated_depreciation || 0) + amount);
      const cost = Number(asset.purchase_cost || 0);
      const residual = Number(asset.residual_value || 0);
      const maxDep = Math.max(0, cost - residual);
      const clampedAccum = Math.min(newAccum, maxDep);
      const book = round2(cost - clampedAccum);
      const status = book <= 0.005 ? 'fully_depreciated' : asset.status;

      const { data: updated, error: upErr } = await supabase
        .from('fixed_assets')
        .update({
          accumulated_depreciation: clampedAccum,
          book_value: book,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
      return NextResponse.json({
        success: true,
        asset: updated,
        depreciation_amount: round2(clampedAccum - Number(asset.accumulated_depreciation || 0)),
      });
    }

    const cost = round2(Number(body.purchase_cost || 0));
    const accum = round2(Number(body.accumulated_depreciation || 0));
    const book = round2(cost - accum);

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('fixed_assets')
      .insert({
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
        depreciation_rate: body.depreciation_rate != null ? Number(body.depreciation_rate) : null,
        accumulated_depreciation: accum,
        book_value: book,
        status: body.status || 'active',
        location: body.location || null,
        serial_number: body.serial_number || null,
        notes: body.notes || null,
        gl_asset_account_id: body.gl_asset_account_id || null,
        gl_depr_account_id: body.gl_depr_account_id || null,
        gl_expense_account_id: body.gl_expense_account_id || null,
        metadata: body.metadata || {},
      })
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
