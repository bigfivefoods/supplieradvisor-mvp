import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const from = sp.get('from') || null;
    const to = sp.get('to') || null;
    const businessUnitId = Number(sp.get('businessUnitId') || 0);
    const workCenterId = Number(sp.get('workCenterId') || 0);
    const workStationId = Number(sp.get('workStationId') || 0);
    const assetId = Number(sp.get('assetId') || 0);

    const supabase = getSupabaseServer();
    let q = supabase
      .from('manufacturing_cost_entries')
      .select('*')
      .eq('profile_id', companyId)
      .order('entry_date', { ascending: false })
      .limit(200);
    if (from) q = q.gte('entry_date', from);
    if (to) q = q.lte('entry_date', to);
    if (businessUnitId > 0) q = q.eq('business_unit_id', businessUnitId);
    if (workCenterId > 0) q = q.eq('work_center_id', workCenterId);
    if (workStationId > 0) q = q.eq('work_station_id', workStationId);
    if (assetId > 0) q = q.eq('asset_id', assetId);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({
        success: true,
        entries: [],
        warning: error.message,
        hint: 'Run supabase/migrations/20260720_manufacturing_cost_structure.sql',
      });
    }
    return NextResponse.json({ success: true, entries: data || [] });
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
    const amount = Number(body.amount);
    if (!Number.isFinite(companyId) || !Number.isFinite(amount)) {
      return NextResponse.json(
        { error: 'companyId and amount required' },
        { status: 400 }
      );
    }
    const hasObject =
      body.business_unit_id ||
      body.work_center_id ||
      body.work_station_id ||
      body.asset_id;
    if (!hasObject) {
      return NextResponse.json(
        {
          error:
            'Allocate to at least one of: business_unit_id, work_center_id, work_station_id, asset_id',
        },
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
      entry_date: body.entry_date || new Date().toISOString().slice(0, 10),
      amount,
      currency: body.currency || 'ZAR',
      category: body.category || 'operating',
      description: body.description || null,
      reference: body.reference || null,
      business_unit_id: body.business_unit_id
        ? Number(body.business_unit_id)
        : null,
      work_center_id: body.work_center_id ? Number(body.work_center_id) : null,
      work_station_id: body.work_station_id
        ? Number(body.work_station_id)
        : null,
      asset_id: body.asset_id ? Number(body.asset_id) : null,
      production_order_id: body.production_order_id
        ? Number(body.production_order_id)
        : null,
      is_recurring: Boolean(body.is_recurring),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('manufacturing_cost_entries')
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

    // Post double-entry to Chart of Accounts (soft if COA not seeded)
    let gl: {
      ok: boolean;
      journalId?: number;
      entryNumber?: string;
      error?: string;
    } | null = null;
    try {
      const { postManufacturingCostEntryToGl } = await import(
        '@/lib/manufacturing/post-cost-to-gl'
      );
      gl = await postManufacturingCostEntryToGl({
        companyId,
        costEntryId: Number(data.id),
        createdBy: gate.userId || null,
      });
      if (gl.ok && gl.journalId) {
        const { data: refreshed } = await supabase
          .from('manufacturing_cost_entries')
          .select('*')
          .eq('id', data.id)
          .maybeSingle();
        return NextResponse.json({
          success: true,
          entry: refreshed || data,
          journal: {
            id: gl.journalId,
            entryNumber: gl.entryNumber,
          },
        });
      }
    } catch (e: unknown) {
      gl = {
        ok: false,
        error: e instanceof Error ? e.message : 'GL post failed',
      };
    }

    return NextResponse.json({
      success: true,
      entry: data,
      journal: gl?.ok
        ? { id: gl.journalId, entryNumber: gl.entryNumber }
        : null,
      journalWarning: gl && !gl.ok ? gl.error : undefined,
    });
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
      .from('manufacturing_cost_entries')
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
