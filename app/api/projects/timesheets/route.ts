import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const privyUserId = sp.get('privyUserId');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertCompanyMember(privyUserId, companyId);
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('pm_timesheets')
      .select('*')
      .eq('profile_id', companyId)
      .order('work_date', { ascending: false })
      .limit(300);
    if (error) {
      return NextResponse.json({
        success: true,
        entries: [],
        total_hours: 0,
        warning: error.message,
      });
    }
    const entries = data || [];
    const total = entries.reduce((s, e) => s + Number(e.hours || 0), 0);
    return NextResponse.json({
      success: true,
      entries,
      total_hours: Math.round(total * 100) / 100,
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
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    const hours = Number(body.hours);
    if (!body.work_date || !Number.isFinite(hours) || hours <= 0) {
      return NextResponse.json({ error: 'work_date and hours required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('pm_timesheets')
      .insert({
        profile_id: companyId,
        project_id: body.project_id != null ? Number(body.project_id) : null,
        task_id: body.task_id != null ? Number(body.task_id) : null,
        user_name: body.user_name || null,
        work_date: body.work_date,
        hours,
        notes: body.notes || null,
        billable: body.billable !== false,
        created_by: mem.userId,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, entry: data }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
