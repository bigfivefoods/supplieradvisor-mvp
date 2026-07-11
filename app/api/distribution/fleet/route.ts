import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const supabase = getSupabaseServer();
    const [vRes, dRes] = await Promise.all([
      supabase
        .from('distribution_vehicles')
        .select('*')
        .eq('profile_id', companyId)
        .order('code'),
      supabase
        .from('distribution_drivers')
        .select('*')
        .eq('profile_id', companyId)
        .order('full_name'),
    ]);

    const warning = vRes.error?.message || dRes.error?.message || undefined;

    return NextResponse.json({
      success: true,
      warning,
      vehicles: vRes.data || [],
      drivers: dRes.data || [],
    });
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
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const supabase = getSupabaseServer();
    const kind = body.kind || 'vehicle';

    if (kind === 'driver') {
      if (!body.full_name || !body.code) {
        return NextResponse.json({ error: 'code and full_name required' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('distribution_drivers')
        .insert({
          profile_id: companyId,
          code: String(body.code).trim().toUpperCase(),
          full_name: String(body.full_name).trim(),
          phone: body.phone || null,
          email: body.email || null,
          license_number: body.license_number || null,
          license_class: body.license_class || null,
          status: body.status || 'available',
          vehicle_id: body.vehicle_id ? Number(body.vehicle_id) : null,
          notes: body.notes || null,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, driver: data });
    }

    if (!body.code) {
      return NextResponse.json({ error: 'code required' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('distribution_vehicles')
      .insert({
        profile_id: companyId,
        code: String(body.code).trim().toUpperCase(),
        name: body.name || null,
        vehicle_type: body.vehicle_type || 'van',
        plate_number: body.plate_number || null,
        make_model: body.make_model || null,
        capacity_kg: body.capacity_kg != null ? Number(body.capacity_kg) : null,
        capacity_cbm: body.capacity_cbm != null ? Number(body.capacity_cbm) : null,
        status: body.status || 'available',
        notes: body.notes || null,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, vehicle: data });
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
    const kind = body.kind || 'vehicle';
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const table =
      kind === 'driver' ? 'distribution_drivers' : 'distribution_vehicles';
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const keys =
      kind === 'driver'
        ? [
            'code',
            'full_name',
            'phone',
            'email',
            'license_number',
            'license_class',
            'status',
            'vehicle_id',
            'notes',
          ]
        : [
            'code',
            'name',
            'vehicle_type',
            'plate_number',
            'make_model',
            'capacity_kg',
            'capacity_cbm',
            'status',
            'current_driver_id',
            'notes',
          ];
    for (const key of keys) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    const { data, error } = await supabase
      .from(table)
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({
      success: true,
      [kind === 'driver' ? 'driver' : 'vehicle']: data,
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
    const kind = request.nextUrl.searchParams.get('kind') || 'vehicle';
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const table =
      kind === 'driver' ? 'distribution_drivers' : 'distribution_vehicles';
    const { error } = await supabase
      .from(table)
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
