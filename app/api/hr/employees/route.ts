import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import {
  defaultOnboardingChecklist,
  fullNameFromParts,
} from '@/lib/hr/types';

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

    const status = sp.get('status');
    const q = (sp.get('q') || '').trim().toLowerCase();
    const buId = Number(sp.get('businessUnitId') || 0);

    const supabase = getSupabaseServer();
    let query = supabase
      .from('employees')
      .select('*')
      .eq('profile_id', companyId)
      .order('full_name')
      .limit(500);

    if (status && status !== 'all') query = query.eq('status', status);
    if (buId > 0) query = query.eq('business_unit_id', buId);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({
        success: true,
        employees: [],
        warning: error.message,
        hint: HINT,
      });
    }

    let rows = data || [];
    if (q) {
      rows = rows.filter((r) => {
        const hay = [
          r.full_name,
          r.first_name,
          r.last_name,
          r.email,
          r.employee_number,
          r.job_title,
          r.department,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }

    const counts = {
      total: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      probation: rows.filter((r) => r.status === 'probation').length,
      on_leave: rows.filter((r) => r.status === 'on_leave').length,
      terminated: rows.filter((r) => r.status === 'terminated').length,
    };

    return NextResponse.json({ success: true, employees: rows, counts });
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
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const full_name = fullNameFromParts(body);
    if (!full_name || full_name === 'Unnamed employee') {
      return NextResponse.json(
        { error: 'full_name or first_name + last_name required' },
        { status: 400 }
      );
    }

    // Everyone should belong to a business unit (cost centre parent)
    const requireBu = body.require_business_unit !== false;
    const businessUnitId = body.business_unit_id
      ? Number(body.business_unit_id)
      : null;
    if (requireBu && (!businessUnitId || businessUnitId <= 0)) {
      return NextResponse.json(
        {
          error:
            'business_unit_id is required — allocate every person to a business unit',
          code: 'BUSINESS_UNIT_REQUIRED',
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();

    // Auto employee number if blank
    let employee_number = body.employee_number
      ? String(body.employee_number).trim()
      : '';
    if (!employee_number) {
      const { count } = await supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId);
      employee_number = `E${String((count || 0) + 1).padStart(4, '0')}`;
    }

    const payload: Record<string, unknown> = {
      profile_id: companyId,
      employee_number,
      full_name,
      first_name: body.first_name || null,
      last_name: body.last_name || null,
      preferred_name: body.preferred_name || null,
      email: body.email || null,
      work_email: body.work_email || body.email || null,
      phone: body.phone || null,
      mobile: body.mobile || null,
      id_number: body.id_number || null,
      passport_number: body.passport_number || null,
      nationality: body.nationality || null,
      date_of_birth: body.date_of_birth || null,
      gender: body.gender || null,
      address_line1: body.address_line1 || null,
      address_line2: body.address_line2 || null,
      city: body.city || null,
      province: body.province || null,
      postal_code: body.postal_code || null,
      country: body.country || 'ZA',
      emergency_contact_name: body.emergency_contact_name || null,
      emergency_contact_phone: body.emergency_contact_phone || null,
      emergency_contact_relation: body.emergency_contact_relation || null,
      job_title: body.job_title || null,
      department: body.department || null,
      employment_type: body.employment_type || 'full_time',
      status: body.status || 'active',
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      probation_end_date: body.probation_end_date || null,
      manager_id: body.manager_id ? Number(body.manager_id) : null,
      reports_to_employee_id: body.manager_id
        ? Number(body.manager_id)
        : body.reports_to_employee_id
          ? Number(body.reports_to_employee_id)
          : null,
      business_unit_id: businessUnitId,
      work_center_id: body.work_center_id
        ? Number(body.work_center_id)
        : null,
      work_station_id: body.work_station_id
        ? Number(body.work_station_id)
        : null,
      asset_id: body.asset_id ? Number(body.asset_id) : null,
      salary_basic: Number(body.salary_basic ?? 0),
      salary_currency: body.salary_currency || 'ZAR',
      pay_frequency: body.pay_frequency || 'monthly',
      hourly_rate: Number(body.hourly_rate ?? 0),
      tax_number: body.tax_number || null,
      tax_status: body.tax_status || 'standard',
      bank_name: body.bank_name || null,
      bank_account_number: body.bank_account_number || null,
      bank_branch_code: body.bank_branch_code || null,
      bank_account_type: body.bank_account_type || null,
      leave_balance_days: Number(body.leave_balance_days ?? 15),
      sick_balance_days: Number(body.sick_balance_days ?? 10),
      notes: body.notes || null,
      onboarding_status: body.onboarding_status || 'not_started',
      onboarding_checklist:
        body.onboarding_checklist || defaultOnboardingChecklist(),
      user_id: body.user_id || null,
      updated_at: now,
    };

    let { data, error } = await supabase
      .from('employees')
      .insert(payload)
      .select('*')
      .single();

    // Soft retry without new HR columns
    if (error && /column|schema cache|does not exist/i.test(error.message)) {
      const minimal = {
        profile_id: companyId,
        full_name,
        email: payload.email,
        phone: payload.phone,
        job_title: payload.job_title,
        department: payload.department,
        employment_type: payload.employment_type,
        status: payload.status,
        start_date: payload.start_date,
        manager_id: payload.manager_id,
        metadata: {
          hr: payload,
        },
        updated_at: now,
      };
      const retry = await supabase
        .from('employees')
        .insert(minimal)
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: HINT },
        { status: 400 }
      );
    }

    // Primary allocation row when cost object present
    if (
      data?.id &&
      (payload.business_unit_id ||
        payload.work_center_id ||
        payload.work_station_id ||
        payload.asset_id)
    ) {
      try {
        await supabase.from('hr_employee_allocations').insert({
          profile_id: companyId,
          employee_id: data.id,
          business_unit_id: payload.business_unit_id,
          work_center_id: payload.work_center_id,
          work_station_id: payload.work_station_id,
          asset_id: payload.asset_id,
          allocation_pct: 100,
          is_primary: true,
          role_label: payload.job_title,
          updated_at: now,
        });
      } catch {
        /* soft */
      }
    }

    return NextResponse.json({ success: true, employee: data }, { status: 201 });
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

    const allowed = [
      'employee_number',
      'full_name',
      'first_name',
      'last_name',
      'preferred_name',
      'email',
      'work_email',
      'phone',
      'mobile',
      'id_number',
      'passport_number',
      'nationality',
      'date_of_birth',
      'gender',
      'address_line1',
      'address_line2',
      'city',
      'province',
      'postal_code',
      'country',
      'emergency_contact_name',
      'emergency_contact_phone',
      'emergency_contact_relation',
      'job_title',
      'department',
      'employment_type',
      'status',
      'start_date',
      'end_date',
      'probation_end_date',
      'manager_id',
      'reports_to_employee_id',
      'business_unit_id',
      'work_center_id',
      'work_station_id',
      'asset_id',
      'position_level',
      'headcount_type',
      'fte',
      'disciplinary_status',
      'salary_basic',
      'salary_currency',
      'pay_frequency',
      'hourly_rate',
      'tax_number',
      'tax_status',
      'bank_name',
      'bank_account_number',
      'bank_branch_code',
      'bank_account_type',
      'leave_balance_days',
      'sick_balance_days',
      'notes',
      'onboarding_status',
      'onboarding_checklist',
      'user_id',
      'photo_url',
    ];

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    if (body.first_name !== undefined || body.last_name !== undefined) {
      if (!body.full_name) {
        patch.full_name = fullNameFromParts({
          full_name: body.full_name,
          first_name: body.first_name ?? patch.first_name,
          last_name: body.last_name ?? patch.last_name,
        });
      }
    }
    if (body.manager_id !== undefined && body.reports_to_employee_id === undefined) {
      patch.reports_to_employee_id = body.manager_id
        ? Number(body.manager_id)
        : null;
    }
    // Keep BU required when status is active workforce
    if (
      body.business_unit_id === null ||
      body.business_unit_id === '' ||
      body.business_unit_id === 0
    ) {
      const st = String(body.status || '').toLowerCase();
      if (!st || ['active', 'probation', 'on_leave'].includes(st)) {
        return NextResponse.json(
          {
            error:
              'business_unit_id is required for active employees — allocate to a business unit',
            code: 'BUSINESS_UNIT_REQUIRED',
          },
          { status: 400 }
        );
      }
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('employees')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, employee: data });
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
    // Soft terminate rather than hard delete
    const { data, error } = await supabase
      .from('employees')
      .update({
        status: 'terminated',
        end_date: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, employee: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
