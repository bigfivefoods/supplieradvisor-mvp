/** Sales diary tasks. The same rows the customer pipeline reads. */

export const CRM_TASK_KINDS = [
  { value: 'call', label: 'Call' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'email', label: 'Email' },
  { value: 'follow_up', label: 'Follow up' },
  { value: 'task', label: 'Task' },
] as const;

export type CrmTaskKind = (typeof CRM_TASK_KINDS)[number]['value'];
export type CrmTaskStatus = 'open' | 'done';

export type CrmTask = {
  id: number;
  profile_id: number;
  customer_id: number | null;
  opportunity_id: number | null;
  title: string;
  notes: string | null;
  kind: CrmTaskKind;
  status: CrmTaskStatus;
  due_on: string;
  due_time: string | null;
  assignee_user_id: string | null;
  assignee_name: string | null;
  created_by: string | null;
  completed_at: string | null;
};

export type DealHorizon = {
  id: number;
  name: string;
  customer_id: number | null;
  company_name: string | null;
  stage: string | null;
  expected_close_date: string | null;
  next_step: string | null;
  next_step_date: string | null;
  owner_name: string | null;
  sales_rep_user_id: string | null;
};

export type DiaryEvent = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  title: string;
  subtitle?: string;
  person_id?: string | null;
  person_name?: string;
  status?: string;
  tone?: 'sky' | 'amber' | 'violet' | 'emerald' | 'rose';
  meta?: string;
};

const KIND_SET = new Set<string>(CRM_TASK_KINDS.map((k) => k.value));

export function kindOrTask(raw: unknown): CrmTaskKind {
  const s = String(raw || '').trim();
  return KIND_SET.has(s) ? (s as CrmTaskKind) : 'task';
}

export function statusOrOpen(raw: unknown): CrmTaskStatus {
  return String(raw || '').trim() === 'done' ? 'done' : 'open';
}

export function dateOrNull(raw: unknown): string | null {
  const s = String(raw || '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

export function timeOrNull(raw: unknown): string | null {
  const s = String(raw || '').trim();
  const m = /^(\d{2}):(\d{2})/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${m[1]}:${m[2]}`;
}

export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

export function taskScheduleEvent(task: CrmTask, today: string): DiaryEvent {
  const start = task.due_time || '09:00';
  const overdue = task.status === 'open' && task.due_on < today;
  return {
    id: `task-${task.id}`,
    date: task.due_on,
    start_time: start,
    end_time: addMinutes(start, 30),
    title: task.title,
    subtitle: task.assignee_name || undefined,
    person_id: task.assignee_user_id,
    person_name: task.assignee_name || undefined,
    status: task.status,
    tone: task.status === 'done' ? 'emerald' : overdue ? 'rose' : 'sky',
    meta: 'task',
  };
}

export function horizonScheduleEvents(deals: DealHorizon[]): DiaryEvent[] {
  const events: DiaryEvent[] = [];
  for (const deal of deals) {
    if (deal.stage === 'closed_lost') continue;
    const who = deal.company_name || deal.owner_name || undefined;
    if (deal.expected_close_date) {
      events.push({
        id: `close-${deal.id}`,
        date: deal.expected_close_date.slice(0, 10),
        start_time: '08:00',
        end_time: '08:30',
        title: `Close · ${deal.name}`,
        subtitle: who,
        person_id: deal.sales_rep_user_id,
        person_name: deal.owner_name || undefined,
        tone: 'violet',
        meta: 'close',
      });
    }
    if (deal.next_step_date) {
      events.push({
        id: `next-${deal.id}`,
        date: deal.next_step_date.slice(0, 10),
        start_time: '10:00',
        end_time: '10:30',
        title: deal.next_step ? `Next · ${deal.next_step}` : `Next · ${deal.name}`,
        subtitle: who,
        person_id: deal.sales_rep_user_id,
        person_name: deal.owner_name || undefined,
        tone: 'amber',
        meta: 'next',
      });
    }
  }
  return events;
}

export function taskListBuckets(tasks: CrmTask[], today: string) {
  const overdue: CrmTask[] = [];
  const dueToday: CrmTask[] = [];
  const upcoming: CrmTask[] = [];
  const done: CrmTask[] = [];
  for (const task of tasks) {
    if (task.status === 'done') {
      done.push(task);
      continue;
    }
    if (task.due_on < today) overdue.push(task);
    else if (task.due_on === today) dueToday.push(task);
    else upcoming.push(task);
  }
  const byDue = (a: CrmTask, b: CrmTask) =>
    a.due_on.localeCompare(b.due_on) || (a.due_time || '').localeCompare(b.due_time || '');
  overdue.sort(byDue);
  dueToday.sort(byDue);
  upcoming.sort(byDue);
  done.sort((a, b) => b.due_on.localeCompare(a.due_on));
  return { overdue, dueToday, upcoming, done };
}
