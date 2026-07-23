import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import {
  bookValue,
  monthlyDepreciation,
} from '@/lib/manufacturing/cost-structure';

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

    const supabase = getSupabaseServer();
    const { data: assets, error } = await supabase
      .from('manufacturing_assets')
      .select('*')
      .eq('profile_id', companyId)
      .order('code');

    if (error) {
      return NextResponse.json({
        success: true,
        assets: [],
        warning: error.message,
        hint: 'Run supabase/migrations/20260720_manufacturing_cost_structure.sql',
      });
    }

    const ids = (assets || []).map((a) => Number(a.id));
    let allocations: Array<Record<string, unknown>> = [];
    if (ids.length) {
      const { data: alloc } = await supabase
        .from('manufacturing_asset_allocations')
        .select('*')
        .eq('profile_id', companyId)
        .in('asset_id', ids)
        .order('effective_from', { ascending: false });
      allocations = (alloc || []) as Array<Record<string, unknown>>;
    }

    const enriched = (assets || []).map((a) => {
      const dep = monthlyDepreciation({
        purchaseCost: Number(a.purchase_cost || 0),
        residualValue: Number(a.residual_value || 0),
        usefulLifeMonths: Number(a.useful_life_months || 60),
        method: a.depreciation_method,
      });
      const bv = bookValue({
        purchaseCost: Number(a.purchase_cost || 0),
        residualValue: Number(a.residual_value || 0),
        usefulLifeMonths: Number(a.useful_life_months || 60),
        purchaseDate: a.purchase_date ? String(a.purchase_date) : null,
        method: a.depreciation_method,
      });
      const mine = allocations.filter((x) => Number(x.asset_id) === Number(a.id));
      return {
        ...a,
        monthly_depreciation: dep,
        book_value: bv,
        monthly_total_cost: dep + Number(a.monthly_running_cost || 0),
        allocations: mine,
      };
    });

    return NextResponse.json({ success: true, assets: enriched });
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
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || !body.code || !body.name) {
      return NextResponse.json(
        { error: 'companyId, code, name required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const payload = {
      profile_id: companyId,
      code: String(body.code).trim().toUpperCase(),
      name: String(body.name).trim(),
      description: body.description || null,
      asset_type: body.asset_type || 'equipment',
      serial_number: body.serial_number || null,
      manufacturer: body.manufacturer || null,
      model: body.model || null,
      purchase_date: body.purchase_date || null,
      purchase_cost: Number(body.purchase_cost ?? 0),
      residual_value: Number(body.residual_value ?? 0),
      useful_life_months: Number(body.useful_life_months ?? 60),
      depreciation_method: body.depreciation_method || 'straight_line',
      currency: body.currency || 'ZAR',
      monthly_running_cost: Number(body.monthly_running_cost ?? 0),
      status: body.status || 'active',
      updated_at: new Date().toISOString(),
    };
    const { data: asset, error } = await supabase
      .from('manufacturing_assets')
      .insert(payload)
      .select('*')
      .single();
    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          hint: 'Run supabase/migrations/20260720_manufacturing_cost_structure.sql',
        },
        { status: 400 }
      );
    }

    // Optional initial allocation
    if (
      body.business_unit_id ||
      body.work_center_id ||
      body.work_station_id
    ) {
      await supabase.from('manufacturing_asset_allocations').insert({
        profile_id: companyId,
        asset_id: asset.id,
        business_unit_id: body.business_unit_id
          ? Number(body.business_unit_id)
          : null,
        work_center_id: body.work_center_id ? Number(body.work_center_id) : null,
        work_station_id: body.work_station_id
          ? Number(body.work_station_id)
          : null,
        allocation_pct: Number(body.allocation_pct ?? 100),
        effective_from: body.effective_from || new Date().toISOString().slice(0, 10),
        notes: body.allocation_notes || 'Initial placement',
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, asset });
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
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();

    // Allocate asset without full asset update
    if (body.action === 'allocate') {
      const { data, error } = await supabase
        .from('manufacturing_asset_allocations')
        .insert({
          profile_id: companyId,
          asset_id: id,
          business_unit_id: body.business_unit_id
            ? Number(body.business_unit_id)
            : null,
          work_center_id: body.work_center_id
            ? Number(body.work_center_id)
            : null,
          work_station_id: body.work_station_id
            ? Number(body.work_station_id)
            : null,
          allocation_pct: Number(body.allocation_pct ?? 100),
          effective_from:
            body.effective_from || new Date().toISOString().slice(0, 10),
          effective_to: body.effective_to || null,
          notes: body.notes || null,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, allocation: data });
    }

    if (body.action === 'end_allocation') {
      const allocId = Number(body.allocationId);
      if (!Number.isFinite(allocId)) {
        return NextResponse.json({ error: 'allocationId required' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('manufacturing_asset_allocations')
        .update({
          effective_to:
            body.effective_to || new Date().toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        })
        .eq('id', allocId)
        .eq('profile_id', companyId)
        .eq('asset_id', id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, allocation: data });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of [
      'code',
      'name',
      'description',
      'asset_type',
      'serial_number',
      'manufacturer',
      'model',
      'purchase_date',
      'purchase_cost',
      'residual_value',
      'useful_life_months',
      'depreciation_method',
      'currency',
      'monthly_running_cost',
      'status',
    ]) {
      if (body[key] !== undefined) {
        updates[key] =
          key === 'code' ? String(body[key]).trim().toUpperCase() : body[key];
      }
    }
    const { data, error } = await supabase
      .from('manufacturing_assets')
      .update(updates)
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

export async function DELETE(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from('manufacturing_assets')
      .delete()
      .eq('id', id)
      .eq('profile_id', companyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
