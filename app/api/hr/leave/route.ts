import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';

const HINT = 'Run supabase/migrations/20260723_hr_people_module.sql';

const DEFAULT_TYPES = [
  { code: 'ANNUAL', name: 'Annual leave', paid: true, annual_allowance_days: 15 },
  { code: 'SICK', name: 'Sick leave', paid: true, annual_allowance_days: 10 },
  { code: 'FAMILY', name: 'Family responsibility', paid: true, annual_allowance_days: 3 },
  { code: 'UNPAID', name: 'Unpaid leave', paid: false, annual_allowance_days: 0 },
];

async function ensureLeaveTypes(companyId: number) {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('hr_leave_types')
    .select('id')
    .eq('profile_id', companyId)
    .limit(1);
  if (data && data.length > 0) return;
  await supabase.from('hr_leave_types').insert(
    DEFAULT_TYPES.map((t) => ({
      profile_id: companyId,
      ...t,
      requires_approval: true,
      status: 'active',
    }))
  );
}

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

    const supabase = getSupabaseServer();
    try {
      await ensureLeaveTypes(companyId);
    } catch {
      /* soft */
    }

    const employeeId = Number(sp.get('employeeId') || 0);
    const status = sp.get('status');

    const { data: types } = await supabase
      .from('hr_leave_types')
      .select('*')
      .eq('profile_id', companyId)
      .order('code');

    let q = supabase
      .from('hr_leave_requests')
      .select('*')
      .eq('profile_id', companyId)
      .order('start_date', { ascending: false })
      .limit(300);
    if (employeeId > 0) q = q.eq('employee_id', employeeId);
    if (status && status !== 'all') q = q.eq('status', status);

    const { data: requests, error } = await q;
    if (error) {
      return NextResponse.json({
        success: true,
        types: types || [],
        requests: [],
        warning: error.message,
        hint: HINT,
      });
    }

    return NextResponse.json({
      success: true,
      types: types || [],
      requests: requests || [],
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

    // Seed types only
    if (body.action === 'seed_types') {
      if (!Number.isFinite(companyId)) {
        return NextResponse.json({ error: 'companyId required' }, { status: 400 });
      }
      const gate = await requireCompanyAccess(request, companyId, {
        legacyPrivyUserId: legacyPrivyFrom(request, body),
      });
      if (!gate.ok) return gate.response;
      await ensureLeaveTypes(companyId);
      return NextResponse.json({ success: true });
    }

    const employeeId = Number(body.employee_id);
    if (!Number.isFinite(companyId) || !Number.isFinite(employeeId)) {
      return NextResponse.json(
        { error: 'companyId and employee_id required' },
        { status: 400 }
      );
    }
    if (!body.start_date || !body.end_date) {
      return NextResponse.json(
        { error: 'start_date and end_date required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const start = new Date(String(body.start_date));
    const end = new Date(String(body.end_date));
    let days = Number(body.days);
    if (!Number.isFinite(days) || days <= 0) {
      days =
        Math.max(
          1,
          Math.round(
            (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1
          )
        ) || 1;
    }

    const supabase = getSupabaseServer();
    const payload = {
      profile_id: companyId,
      employee_id: employeeId,
      leave_type_id: body.leave_type_id ? Number(body.leave_type_id) : null,
      leave_type_code: body.leave_type_code || null,
      start_date: String(body.start_date).slice(0, 10),
      end_date: String(body.end_date).slice(0, 10),
      days,
      reason: body.reason || null,
      status: 'pending',
      notes: body.notes || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('hr_leave_requests')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: HINT },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true, request: data }, { status: 201 });
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
      return NextResponse.json(
        { error: 'companyId and id required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const status = body.status ? String(body.status).toLowerCase() : null;
    const supabase = getSupabaseServer();

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (status) {
      if (!['pending', 'approved', 'rejected', 'cancelled'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      patch.status = status;
      if (status === 'approved' || status === 'rejected') {
        patch.approved_by = gate.userId || body.approved_by || null;
        patch.approved_at = new Date().toISOString();
      }
    }
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.reason !== undefined) patch.reason = body.reason;

    const { data: prev } = await supabase
      .from('hr_leave_requests')
      .select('*')
      .eq('id', id)
      .eq('profile_id', companyId)
      .maybeSingle();

    const { data, error } = await supabase
      .from('hr_leave_requests')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Deduct leave balance on first approve
    if (
      status === 'approved' &&
      prev &&
      String(prev.status) !== 'approved' &&
      prev.employee_id
    ) {
      const days = Number(prev.days || data.days || 0);
      const code = String(prev.leave_type_code || data.leave_type_code || '')
        .toUpperCase();
      const { data: emp } = await supabase
        .from('employees')
        .select('id, leave_balance_days, sick_balance_days')
        .eq('id', prev.employee_id)
        .eq('profile_id', companyId)
        .maybeSingle();
      if (emp && days > 0) {
        if (code === 'SICK') {
          await supabase
            .from('employees')
            .update({
              sick_balance_days: Math.max(
                0,
                Number(emp.sick_balance_days || 0) - days
              ),
              updated_at: new Date().toISOString(),
            })
            .eq('id', emp.id);
        } else if (code !== 'UNPAID') {
          await supabase
            .from('employees')
            .update({
              leave_balance_days: Math.max(
                0,
                Number(emp.leave_balance_days || 0) - days
              ),
              updated_at: new Date().toISOString(),
            })
            .eq('id', emp.id);
        }
      }
    }

    return NextResponse.json({ success: true, request: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
