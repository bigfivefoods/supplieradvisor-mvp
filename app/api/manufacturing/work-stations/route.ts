import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const workCenterId = Number(request.nextUrl.searchParams.get('workCenterId') || 0);
    const businessUnitId = Number(
      request.nextUrl.searchParams.get('businessUnitId') || 0
    );
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    let q = supabase
      .from('manufacturing_work_stations')
      .select('*')
      .eq('profile_id', companyId)
      .order('code');
    if (workCenterId > 0) q = q.eq('work_center_id', workCenterId);
    if (businessUnitId > 0) q = q.eq('business_unit_id', businessUnitId);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({
        success: true,
        workStations: [],
        warning: error.message,
        hint: 'Run supabase/migrations/20260720_manufacturing_cost_structure.sql',
      });
    }
    return NextResponse.json({ success: true, workStations: data || [] });
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
      work_center_id: body.work_center_id ? Number(body.work_center_id) : null,
      business_unit_id: body.business_unit_id ? Number(body.business_unit_id) : null,
      station_type: body.station_type || 'station',
      capacity_hours_per_day: Number(body.capacity_hours_per_day ?? 8),
      cost_per_hour: Number(body.cost_per_hour ?? 0),
      status: body.status || 'active',
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('manufacturing_work_stations')
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
    return NextResponse.json({ success: true, workStation: data });
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

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of [
      'code',
      'name',
      'description',
      'work_center_id',
      'business_unit_id',
      'station_type',
      'capacity_hours_per_day',
      'cost_per_hour',
      'status',
    ]) {
      if (body[key] !== undefined) {
        if (key === 'code') updates[key] = String(body[key]).trim().toUpperCase();
        else if (key === 'work_center_id' || key === 'business_unit_id') {
          updates[key] = body[key] ? Number(body[key]) : null;
        } else updates[key] = body[key];
      }
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('manufacturing_work_stations')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, workStation: data });
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
      .from('manufacturing_work_stations')
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
