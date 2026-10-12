/** Company-scoped sales diary read. Callers must already know the company id is allowed. */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  horizonScheduleEvents,
  kindOrTask,
  statusOrOpen,
  timeOrNull,
  type CrmTask,
  type DealHorizon,
  type DiaryEvent,
} from '@/lib/sales/crm-tasks';

export const CRM_TASK_COLUMNS =
  'id, profile_id, customer_id, opportunity_id, title, notes, kind, status, due_on, due_time, assignee_user_id, assignee_name, created_by, completed_at';

const HINT = 'Run RUN_THIS_FOR_CRM_TASKS.sql';

function numId(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function asCrmTask(row: Record<string, unknown>): CrmTask {
  return {
    id: Number(row.id),
    profile_id: Number(row.profile_id),
    customer_id: numId(row.customer_id),
    opportunity_id: numId(row.opportunity_id),
    title: String(row.title || ''),
    notes: row.notes ? String(row.notes) : null,
    kind: kindOrTask(row.kind),
    status: statusOrOpen(row.status),
    due_on: String(row.due_on || '').slice(0, 10),
    due_time: timeOrNull(row.due_time),
    assignee_user_id: row.assignee_user_id ? String(row.assignee_user_id) : null,
    assignee_name: row.assignee_name ? String(row.assignee_name) : null,
    created_by: row.created_by ? String(row.created_by) : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
  };
}

export type DiaryLoad =
  | { ok: true; tasks: CrmTask[]; horizon: DiaryEvent[]; tradingName: string }
  | { ok: false; missingTable: boolean; error: string; hint?: string };

export async function loadCompanyDiary(companyId: number): Promise<DiaryLoad> {
  const supabase = getSupabaseServer();
  const [tasksHit, dealsHit, profileHit] = await Promise.all([
    supabase
      .from('crm_tasks')
      .select(CRM_TASK_COLUMNS)
      .eq('profile_id', companyId)
      .order('due_on', { ascending: true })
      .limit(500),
    supabase
      .from('opportunities')
      .select(
        'id, name, customer_id, company_name, stage, expected_close_date, next_step, next_step_date, owner_name, sales_rep_user_id'
      )
      .eq('profile_id', companyId)
      .order('updated_at', { ascending: false })
      .limit(500),
    supabase.from('profiles').select('id, trading_name').eq('id', companyId).maybeSingle(),
  ]);

  if (tasksHit.error) {
    const missing = /crm_tasks|does not exist|schema cache/i.test(tasksHit.error.message);
    return {
      ok: false,
      missingTable: missing,
      error: tasksHit.error.message,
      hint: missing ? HINT : undefined,
    };
  }

  const tasks = (tasksHit.data || []).map((row) => asCrmTask(row as Record<string, unknown>));
  const deals: DealHorizon[] = (dealsHit.data || []).map((row) => ({
    id: Number(row.id),
    name: String(row.name || 'Deal'),
    customer_id: numId(row.customer_id),
    company_name: row.company_name ? String(row.company_name) : null,
    stage: row.stage ? String(row.stage) : null,
    expected_close_date: row.expected_close_date ? String(row.expected_close_date).slice(0, 10) : null,
    next_step: row.next_step ? String(row.next_step) : null,
    next_step_date: row.next_step_date ? String(row.next_step_date).slice(0, 10) : null,
    owner_name: row.owner_name ? String(row.owner_name) : null,
    sales_rep_user_id: row.sales_rep_user_id ? String(row.sales_rep_user_id) : null,
  }));
  const tradingName = profileHit.data?.trading_name
    ? String(profileHit.data.trading_name)
    : 'Sales diary';

  return {
    ok: true,
    tasks,
    horizon: horizonScheduleEvents(deals),
    tradingName,
  };
}
