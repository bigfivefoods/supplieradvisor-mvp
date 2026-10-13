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
  customer_id?: number | null;
  opportunity_id?: number | null;
};

/** Tabs on the sales diary. `all` is the open horizon; the others are one slice. */
export type DiaryLens = 'all' | 'task' | 'next' | 'close' | 'overdue' | 'done' | 'apple';

export const DIARY_LENSES: { id: DiaryLens; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'task', label: 'Task' },
  { id: 'next', label: 'Next step' },
  { id: 'close', label: 'Expected close' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'apple', label: 'Apple' },
  { id: 'done', label: 'Done' },
];

/** An appointment copied from one of the connected user's other Apple calendars. */
export type AppleDiaryItem = {
  id: number;
  title: string;
  date: string;
  start: string;
  end: string;
  calendarName: string;
  status: CrmTaskStatus;
};

export type DiaryTableRow = {
  key: string;
  lens: Exclude<DiaryLens, 'all'>;
  date: string;
  time: string;
  title: string;
  detail: string;
  customerId: number | null;
  opportunityId: number | null;
  taskId: number | null;
  status: CrmTaskStatus;
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
        customer_id: deal.customer_id,
        opportunity_id: deal.id,
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
        customer_id: deal.customer_id,
        opportunity_id: deal.id,
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

export function appleScheduleEvent(item: AppleDiaryItem): DiaryEvent {
  const start = item.start || '09:00';
  return {
    id: `apple-${item.id}`,
    date: item.date,
    start_time: start,
    end_time: item.end && item.end > start ? item.end : addMinutes(start, 30),
    title: item.title,
    subtitle: item.calendarName ? `Apple · ${item.calendarName}` : 'Apple',
    status: item.status,
    tone: 'sky',
    meta: 'apple',
  };
}

export function lensForDiaryEvent(
  event: { meta?: string; status?: string; date: string },
  today: string
): DiaryLens {
  if (event.meta === 'apple') return 'apple';
  if (event.meta === 'next') return 'next';
  if (event.meta === 'close') return 'close';
  if (event.status === 'done') return 'done';
  if (event.date < today) return 'overdue';
  return 'task';
}

/** `all` is everything still open. The other lenses are one tab each. */
export function eventsForLens(events: DiaryEvent[], lens: DiaryLens, today: string): DiaryEvent[] {
  if (lens === 'all') {
    return events.filter((event) => lensForDiaryEvent(event, today) !== 'done');
  }
  return events.filter((event) => lensForDiaryEvent(event, today) === lens);
}

function kindLabel(kind: string) {
  return CRM_TASK_KINDS.find((k) => k.value === kind)?.label || 'Task';
}

export function diaryTableRows(
  tasks: CrmTask[],
  horizon: DiaryEvent[],
  today: string,
  apple: AppleDiaryItem[] = []
): DiaryTableRow[] {
  const rows: DiaryTableRow[] = tasks.map((task) => {
    const lens = lensForDiaryEvent(
      { meta: 'task', status: task.status, date: task.due_on },
      today
    ) as DiaryTableRow['lens'];
    return {
      key: `task-${task.id}`,
      lens,
      date: task.due_on,
      time: task.due_time || '',
      title: task.title,
      detail: [kindLabel(task.kind), task.assignee_name].filter(Boolean).join(' · '),
      customerId: task.customer_id,
      opportunityId: task.opportunity_id,
      taskId: task.id,
      status: task.status,
    };
  });
  for (const event of horizon) {
    if (event.meta !== 'next' && event.meta !== 'close') continue;
    const dealId = event.opportunity_id ?? Number(event.id.split('-')[1]);
    rows.push({
      key: event.id,
      lens: event.meta,
      date: event.date,
      time: event.start_time || '',
      title: event.title,
      detail: event.subtitle || '',
      customerId: event.customer_id ?? null,
      opportunityId: Number.isFinite(dealId) && dealId > 0 ? dealId : null,
      taskId: null,
      status: 'open',
    });
  }
  for (const item of apple) {
    const event = appleScheduleEvent(item);
    rows.push({
      key: event.id,
      lens: 'apple',
      date: item.date,
      time: item.start || '',
      title: item.title,
      detail: event.subtitle || 'Apple',
      customerId: null,
      opportunityId: null,
      taskId: null,
      status: item.status,
    });
  }
  return rows;
}

export function rowsForLens(rows: DiaryTableRow[], lens: DiaryLens): DiaryTableRow[] {
  const list = lens === 'all' ? rows.filter((row) => row.lens !== 'done') : rows.filter((row) => row.lens === lens);
  const byDate = (a: DiaryTableRow, b: DiaryTableRow) =>
    a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.title.localeCompare(b.title);
  if (lens === 'done') {
    return [...list].sort(
      (a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || a.title.localeCompare(b.title)
    );
  }
  return [...list].sort(byDate);
}
