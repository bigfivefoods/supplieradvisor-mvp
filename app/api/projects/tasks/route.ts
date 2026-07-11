import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';

export const KANBAN_COLUMNS = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
] as const;

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const projectId = Number(sp.get('projectId'));
    const privyUserId = sp.get('privyUserId');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertCompanyMember(privyUserId, companyId);
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();
    let q = supabase
      .from('pm_tasks')
      .select('*')
      .eq('profile_id', companyId)
      .order('sort_order', { ascending: true });
    if (Number.isFinite(projectId) && projectId > 0) q = q.eq('project_id', projectId);

    const { data, error } = await q.limit(500);
    if (error) {
      return NextResponse.json({
        success: true,
        tasks: [],
        columns: KANBAN_COLUMNS,
        warning: error.message,
      });
    }

    const tasks = data || [];
    const byColumn: Record<string, typeof tasks> = {};
    for (const col of KANBAN_COLUMNS) byColumn[col.key] = [];
    for (const t of tasks) {
      const k = String(t.column_key || 'backlog');
      if (!byColumn[k]) byColumn[k] = [];
      byColumn[k].push(t);
    }

    return NextResponse.json({
      success: true,
      tasks,
      board: byColumn,
      columns: KANBAN_COLUMNS,
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
    const projectId = Number(body.project_id);
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    if (!Number.isFinite(projectId) || !String(body.title || '').trim()) {
      return NextResponse.json({ error: 'project_id and title required' }, { status: 400 });
    }

    const col = String(body.column_key || 'backlog');
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('pm_tasks')
      .insert({
        profile_id: companyId,
        project_id: projectId,
        title: String(body.title).trim(),
        description: body.description || null,
        status: body.status || col,
        column_key: col,
        assignee: body.assignee || null,
        priority: body.priority || 'medium',
        estimate_hours: body.estimate_hours != null ? Number(body.estimate_hours) : null,
        due_date: body.due_date || null,
        sort_order: Number(body.sort_order) || 0,
        created_by: mem.userId,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, task: data }, { status: 201 });
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
      'title',
      'description',
      'status',
      'column_key',
      'assignee',
      'priority',
      'estimate_hours',
      'due_date',
      'sort_order',
      'labels',
    ]) {
      if (body[k] !== undefined) updates[k] = body[k];
    }
    if (body.column_key) updates.status = body.column_key;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('pm_tasks')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, task: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
