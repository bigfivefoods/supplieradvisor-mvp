import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

const PROJECT_STATUSES = [
  'planning',
  'active',
  'on_hold',
  'completed',
  'cancelled',
] as const;

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const privyUserId = sp.get('privyUserId');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('pm_projects')
      .select('*')
      .eq('profile_id', companyId)
      .order('updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({
        success: true,
        projects: [],
        warning: error.message,
        migration: '20260711_haccp_esg_pm_suite.sql',
      });
    }

    const projects = data || [];
    const ids = projects.map((p) => p.id);
    let taskCounts: Record<number, { total: number; done: number }> = {};
    let milestoneCounts: Record<number, { total: number; done: number }> = {};
    if (ids.length) {
      const [{ data: tasks }, { data: miles }] = await Promise.all([
        supabase.from('pm_tasks').select('id, project_id, status, column_key').in('project_id', ids),
        supabase.from('pm_milestones').select('id, project_id, done').in('project_id', ids),
      ]);
      for (const t of tasks || []) {
        const c = taskCounts[t.project_id] || { total: 0, done: 0 };
        c.total += 1;
        if (t.column_key === 'done' || t.status === 'done') c.done += 1;
        taskCounts[t.project_id] = c;
      }
      for (const m of miles || []) {
        const c = milestoneCounts[m.project_id] || { total: 0, done: 0 };
        c.total += 1;
        if (m.done) c.done += 1;
        milestoneCounts[m.project_id] = c;
      }
    }

    return NextResponse.json({
      success: true,
      projects: projects.map((p) => ({
        ...p,
        task_stats: taskCounts[p.id] || { total: 0, done: 0 },
        milestone_stats: milestoneCounts[p.id] || { total: 0, done: 0 },
      })),
      summary: {
        total: projects.length,
        active: projects.filter((p) => p.status === 'active').length,
        completed: projects.filter((p) => p.status === 'completed').length,
        on_hold: projects.filter((p) => p.status === 'on_hold').length,
      },
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
    if (!String(body.name || '').trim()) {
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('pm_projects')
      .insert({
        profile_id: companyId,
        name: String(body.name).trim(),
        description: body.description || null,
        status: PROJECT_STATUSES.includes(body.status) ? body.status : 'planning',
        priority: body.priority || 'medium',
        owner_name: body.owner_name || null,
        budget: body.budget != null ? Number(body.budget) : null,
        currency: body.currency || 'ZAR',
        start_date: body.start_date || null,
        target_date: body.target_date || null,
        health: body.health || 'green',
        created_by: mem.userId,
        updated_at: now,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, migration: '20260711_haccp_esg_pm_suite.sql' },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: true, project: data }, { status: 201 });
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
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of [
      'name',
      'description',
      'status',
      'priority',
      'owner_name',
      'budget',
      'currency',
      'start_date',
      'target_date',
      'progress',
      'health',
      'tags',
      'metadata',
    ]) {
      if (body[k] !== undefined) updates[k] = body[k];
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('pm_projects')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, project: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
