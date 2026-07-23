import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';

const HINT = 'Run supabase/migrations/20260723_hr_people_module.sql';

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

    const employeeId = Number(sp.get('employeeId') || 0);
    const supabase = getSupabaseServer();
    let q = supabase
      .from('hr_employee_allocations')
      .select('*')
      .eq('profile_id', companyId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);
    if (employeeId > 0) q = q.eq('employee_id', employeeId);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({
        success: true,
        allocations: [],
        warning: error.message,
        hint: HINT,
      });
    }
    return NextResponse.json({ success: true, allocations: data || [] });
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
    const employeeId = Number(body.employee_id);
    if (!Number.isFinite(companyId) || !Number.isFinite(employeeId)) {
      return NextResponse.json(
        { error: 'companyId and employee_id required' },
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

    const pct = Number(body.allocation_pct ?? 100);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      return NextResponse.json(
        { error: 'allocation_pct must be between 0 and 100' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const isPrimary = Boolean(body.is_primary);
    if (isPrimary) {
      await supabase
        .from('hr_employee_allocations')
        .update({ is_primary: false, updated_at: new Date().toISOString() })
        .eq('profile_id', companyId)
        .eq('employee_id', employeeId);
    }

    const payload = {
      profile_id: companyId,
      employee_id: employeeId,
      business_unit_id: body.business_unit_id
        ? Number(body.business_unit_id)
        : null,
      work_center_id: body.work_center_id
        ? Number(body.work_center_id)
        : null,
      work_station_id: body.work_station_id
        ? Number(body.work_station_id)
        : null,
      asset_id: body.asset_id ? Number(body.asset_id) : null,
      allocation_pct: pct,
      role_label: body.role_label || null,
      effective_from: body.effective_from || new Date().toISOString().slice(0, 10),
      effective_to: body.effective_to || null,
      is_primary: isPrimary,
      notes: body.notes || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('hr_employee_allocations')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: HINT },
        { status: 400 }
      );
    }

    // Sync primary placement onto employee master
    if (isPrimary || body.sync_employee !== false) {
      await supabase
        .from('employees')
        .update({
          business_unit_id: payload.business_unit_id,
          work_center_id: payload.work_center_id,
          work_station_id: payload.work_station_id,
          asset_id: payload.asset_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', employeeId)
        .eq('profile_id', companyId);
    }

    return NextResponse.json({ success: true, allocation: data }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const id = Number(sp.get('id'));
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'companyId and id required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from('hr_employee_allocations')
      .delete()
      .eq('id', id)
      .eq('profile_id', companyId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
