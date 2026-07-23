import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';

const HINT = 'Run supabase/migrations/20260723_hr_people_module.sql';

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

    const { data: employees, error } = await supabase
      .from('employees')
      .select(
        'id, status, employment_type, business_unit_id, work_center_id, salary_basic, leave_balance_days, onboarding_status, full_name, job_title, start_date, manager_id, disciplinary_status, last_performance_rating, last_performance_score'
      )
      .eq('profile_id', companyId)
      .limit(1000);

    if (error) {
      return NextResponse.json({
        success: true,
        migration_required: true,
        warning: error.message,
        hint: HINT,
        counts: {
          total: 0,
          active: 0,
          onLeave: 0,
          probation: 0,
          terminated: 0,
          allocated: 0,
          unallocated: 0,
          onboardingOpen: 0,
        },
      });
    }

    const rows = employees || [];
    const active = rows.filter((r) =>
      ['active', 'probation', 'on_leave'].includes(String(r.status))
    );
    const allocated = active.filter(
      (r) => r.business_unit_id || r.work_center_id
    ).length;

    let leavePending = 0;
    let payrollDraft = 0;
    let lastPayrollNet = 0;
    let disciplinaryOpen = 0;
    try {
      const { count } = await supabase
        .from('hr_leave_requests')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId)
        .eq('status', 'pending');
      leavePending = count || 0;
    } catch {
      /* soft */
    }
    try {
      const { count } = await supabase
        .from('hr_disciplinary_cases')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId)
        .not('status', 'in', '("closed","withdrawn")');
      disciplinaryOpen = count || 0;
    } catch {
      /* soft */
    }
    try {
      const { data: runs } = await supabase
        .from('hr_payroll_runs')
        .select('id, status, total_net')
        .eq('profile_id', companyId)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false })
        .limit(3);
      payrollDraft = (runs || []).filter((r) =>
        ['draft', 'calculated'].includes(String(r.status))
      ).length;
      const paid = (runs || []).find((r) => r.status === 'paid');
      lastPayrollNet = Number(paid?.total_net || 0);
    } catch {
      /* soft */
    }

    const monthlyWageBill = active.reduce(
      (s, r) => s + Number(r.salary_basic || 0),
      0
    );

    const recent = rows
      .slice()
      .sort((a, b) => String(b.start_date || '').localeCompare(String(a.start_date || '')))
      .slice(0, 6)
      .map((r) => ({
        id: r.id,
        full_name: r.full_name,
        job_title: r.job_title,
        status: r.status,
        start_date: r.start_date,
      }));

    return NextResponse.json({
      success: true,
      counts: {
        total: rows.length,
        active: rows.filter((r) => r.status === 'active').length,
        onLeave: rows.filter((r) => r.status === 'on_leave').length,
        probation: rows.filter((r) => r.status === 'probation').length,
        terminated: rows.filter((r) => r.status === 'terminated').length,
        allocated,
        unallocated: Math.max(0, active.length - allocated),
        onboardingOpen: rows.filter(
          (r) =>
            r.onboarding_status &&
            r.onboarding_status !== 'complete' &&
            r.status !== 'terminated'
        ).length,
        leavePending,
        payrollOpen: payrollDraft,
        disciplinaryOpen,
        withManager: active.filter((r) => r.manager_id).length,
        withoutManager: active.filter((r) => !r.manager_id).length,
      },
      monthlyWageBill: Math.round(monthlyWageBill * 100) / 100,
      lastPayrollNet,
      recent,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
