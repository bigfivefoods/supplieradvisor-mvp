import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { dateOrNull, kindOrTask, statusOrOpen, timeOrNull, type CrmTask } from '@/lib/sales/crm-tasks';
import { asCrmTask as asTask, CRM_TASK_COLUMNS as TASK_COLUMNS, loadCompanyDiary } from '@/lib/sales/diary-load';
import { diaryFeedLinks } from '@/lib/sales/diary-feed';

export const dynamic = 'force-dynamic';

const HINT = 'Run RUN_THIS_FOR_CRM_TASKS.sql';

function numId(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function loadAppleMirror(companyId: number, userId: string) {
  const hit = await getSupabaseServer()
    .from('crm_calendar_mirror')
    .select('id, title, notes, starts_on, start_time, end_time, status, calendar_name')
    .eq('profile_id', companyId)
    .eq('user_id', userId)
    .order('starts_on', { ascending: true })
    .limit(800);
  if (hit.error) return [];
  return (hit.data || []).map((row) => ({
    id: Number(row.id),
    title: String(row.title || ''),
    date: String(row.starts_on || '').slice(0, 10),
    start: row.start_time ? String(row.start_time).slice(0, 5) : '',
    end: row.end_time ? String(row.end_time).slice(0, 5) : '',
    calendarName: String(row.calendar_name || 'Calendar'),
    status: String(row.status || '') === 'done' ? 'done' : 'open',
    notes: row.notes ? String(row.notes) : '',
  }));
}

async function gate(request: NextRequest, companyId: number) {
  return requireCompanyAccess(request, companyId, {
    legacyPrivyUserId: legacyPrivyFrom(request),
  });
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const access = await gate(request, companyId);
    if (!access.ok) return access.response;

    const status = request.nextUrl.searchParams.get('status') || 'all';
    const loaded = await loadCompanyDiary(companyId);
    if (!loaded.ok) {
      return NextResponse.json(
        { error: loaded.error, hint: loaded.hint },
        { status: loaded.missingTable ? 503 : 500 }
      );
    }

    const tasks =
      status === 'open' || status === 'done'
        ? loaded.tasks.filter((task) => task.status === status)
        : loaded.tasks;

    const apple = await loadAppleMirror(companyId, access.userId);

    return NextResponse.json({
      tasks,
      horizon: loaded.horizon,
      apple,
      feed: diaryFeedLinks(companyId),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

type LinkResult =
  | { ok: false; error: string }
  | { ok: true; customer: number | null; opportunity: number | null };

async function linkedIds(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  customerId: number | null,
  opportunityId: number | null
): Promise<LinkResult> {
  let customer = customerId;
  let opportunity = opportunityId;
  if (opportunity) {
    const hit = await supabase
      .from('opportunities')
      .select('id, customer_id, profile_id')
      .eq('id', opportunity)
      .eq('profile_id', companyId)
      .maybeSingle();
    if (!hit.data) return { ok: false, error: 'That deal is not on this company' };
    const onDeal = numId(hit.data.customer_id);
    if (!customer && onDeal) customer = onDeal;
  }
  if (customer) {
    const hit = await supabase
      .from('customers')
      .select('id')
      .eq('id', customer)
      .eq('profile_id', companyId)
      .maybeSingle();
    if (!hit.data) return { ok: false, error: 'That customer is not on this company' };
  }
  return { ok: true, customer, opportunity };
}

async function logActivity(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  task: CrmTask,
  subject: string,
  createdBy: string | null
) {
  const entityType = task.opportunity_id
    ? 'opportunity'
    : task.customer_id
      ? 'customer'
      : 'task';
  const entityId = task.opportunity_id || task.customer_id || task.id;
  const { error } = await supabase.from('crm_activities').insert({
    profile_id: companyId,
    entity_type: entityType,
    entity_id: entityId,
    activity_type: 'task',
    subject,
    body: task.notes,
    activity_at: new Date().toISOString(),
    created_by: createdBy,
  });
  return error?.message || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const access = await gate(request, companyId);
    if (!access.ok) return access.response;

    const title = String(body.title || '').trim();
    const dueOn = dateOrNull(body.due_on);
    if (title.length < 2) {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 });
    }
    if (!dueOn) {
      return NextResponse.json({ error: 'Due date is required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const linked = await linkedIds(
      supabase,
      companyId,
      numId(body.customer_id),
      numId(body.opportunity_id)
    );
    if (!linked.ok) {
      return NextResponse.json({ error: linked.error }, { status: 400 });
    }

    const now = new Date().toISOString();
    const row = {
      profile_id: companyId,
      customer_id: linked.customer,
      opportunity_id: linked.opportunity,
      title: title.slice(0, 200),
      notes: String(body.notes || '').trim() || null,
      kind: kindOrTask(body.kind),
      status: 'open',
      due_on: dueOn,
      due_time: timeOrNull(body.due_time),
      assignee_user_id: String(body.assignee_user_id || '').trim() || null,
      assignee_name: String(body.assignee_name || '').trim() || null,
      created_by: String(body.privyUserId || '').trim() || null,
      updated_at: now,
    };

    const inserted = await supabase.from('crm_tasks').insert(row).select(TASK_COLUMNS).single();
    if (inserted.error || !inserted.data) {
      const missing = /crm_tasks|does not exist|schema cache/i.test(inserted.error?.message || '');
      return NextResponse.json(
        { error: inserted.error?.message || 'Could not save the task', hint: missing ? HINT : undefined },
        { status: missing ? 503 : 500 }
      );
    }
    const task = asTask(inserted.data as Record<string, unknown>);
    const activityWarning = await logActivity(
      supabase,
      companyId,
      task,
      `Task · ${task.title}`,
      row.created_by
    );
    return NextResponse.json({ task, activityWarning });
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
    const id = numId(body.id);
    if (!Number.isFinite(companyId) || companyId <= 0 || !id) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const access = await gate(request, companyId);
    if (!access.ok) return access.response;

    const supabase = getSupabaseServer();
    const existing = await supabase
      .from('crm_tasks')
      .select(TASK_COLUMNS)
      .eq('id', id)
      .eq('profile_id', companyId)
      .maybeSingle();
    if (!existing.data) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.title != null) {
      const title = String(body.title).trim();
      if (title.length < 2) {
        return NextResponse.json({ error: 'Task title is required' }, { status: 400 });
      }
      updates.title = title.slice(0, 200);
    }
    if (body.notes != null) updates.notes = String(body.notes).trim() || null;
    if (body.kind != null) updates.kind = kindOrTask(body.kind);
    if (body.due_on != null) {
      const due = dateOrNull(body.due_on);
      if (!due) return NextResponse.json({ error: 'Due date is required' }, { status: 400 });
      updates.due_on = due;
    }
    if (body.due_time != null) updates.due_time = timeOrNull(body.due_time);
    if (body.assignee_user_id != null) {
      updates.assignee_user_id = String(body.assignee_user_id).trim() || null;
    }
    if (body.assignee_name != null) {
      updates.assignee_name = String(body.assignee_name).trim() || null;
    }
    if (body.customer_id != null || body.opportunity_id != null) {
      const current = asTask(existing.data as Record<string, unknown>);
      const linked = await linkedIds(
        supabase,
        companyId,
        body.customer_id != null ? numId(body.customer_id) : current.customer_id,
        body.opportunity_id != null ? numId(body.opportunity_id) : current.opportunity_id
      );
      if (!linked.ok) {
        return NextResponse.json({ error: linked.error }, { status: 400 });
      }
      updates.customer_id = linked.customer;
      updates.opportunity_id = linked.opportunity;
    }
    if (body.status != null) {
      const status = statusOrOpen(body.status);
      updates.status = status;
      updates.completed_at = status === 'done' ? new Date().toISOString() : null;
    }

    const saved = await supabase
      .from('crm_tasks')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select(TASK_COLUMNS)
      .single();
    if (saved.error || !saved.data) {
      return NextResponse.json(
        { error: saved.error?.message || 'Could not update the task' },
        { status: 500 }
      );
    }
    const task = asTask(saved.data as Record<string, unknown>);
    let activityWarning: string | null = null;
    if (updates.status === 'done') {
      activityWarning = await logActivity(
        supabase,
        companyId,
        task,
        `Done · ${task.title}`,
        String(body.privyUserId || '').trim() || null
      );
    }
    return NextResponse.json({ task, activityWarning });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
