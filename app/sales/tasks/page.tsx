'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CalendarDays, Check, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CRM_TASK_KINDS,
  taskListBuckets,
  taskScheduleEvent,
  type CrmTask,
  type CrmTaskKind,
  type DiaryEvent,
} from '@/lib/sales/crm-tasks';
import {
  PracticeScheduleCalendar,
  type ScheduleEvent,
} from '@/components/schedule/PracticeScheduleCalendar';

type CustomerOpt = { id: number; trading_name: string };
type DealOpt = { id: number; name: string; customer_id: number | null; company_name: string | null };
type Member = { user_id: string; name: string };

const inputCls =
  'input min-h-11 w-full !px-3 !py-2.5 !text-sm font-medium normal-case tracking-normal';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function kindLabel(kind: string) {
  return CRM_TASK_KINDS.find((k) => k.value === kind)?.label || 'Task';
}

export default function SalesTasksPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#00b4d8]" />
        </div>
      }
    >
      <TasksInner />
    </Suspense>
  );
}

function TasksInner() {
  const companyId = getSelectedCompanyId();
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const search = useSearchParams();
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [horizon, setHorizon] = useState<DiaryEvent[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [deals, setDeals] = useState<DealOpt[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [showDone, setShowDone] = useState(false);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    kind: 'follow_up' as CrmTaskKind,
    due_on: search.get('due') || todayIso(),
    due_time: '',
    customer_id: search.get('customer') || '',
    opportunity_id: search.get('opportunity') || '',
    assignee_user_id: '',
    notes: '',
  });

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) qs.set('privyUserId', privyUserId);
      const [taskRes, custRes, oppRes, teamRes] = await Promise.all([
        fetch(`/api/sales/tasks?${qs}`),
        fetch(`/api/customers?companyId=${companyId}&limit=200`),
        fetch(`/api/customers/opportunities?${qs}`),
        fetch(`/api/sales/team-members?companyId=${companyId}`),
      ]);
      const taskData = await taskRes.json();
      if (!taskRes.ok) throw new Error(taskData.error || 'Could not load the diary');
      setTasks(taskData.tasks || []);
      setHorizon(taskData.horizon || []);
      if (custRes.ok) {
        const custData = await custRes.json();
        setCustomers(
          ((custData.customers || []) as CustomerOpt[]).map((c) => ({
            id: c.id,
            trading_name: c.trading_name || `Customer ${c.id}`,
          }))
        );
      }
      if (oppRes.ok) {
        const oppData = await oppRes.json();
        setDeals(
          ((oppData.opportunities || []) as DealOpt[]).map((o) => ({
            id: o.id,
            name: o.name,
            customer_id: o.customer_id ?? null,
            company_name: o.company_name ?? null,
          }))
        );
      }
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setMembers((teamData.members || []) as Member[]);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not load the diary');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (search.get('opportunity') || search.get('customer')) setFormOpen(true);
  }, [search]);

  const today = todayIso();
  const buckets = useMemo(() => taskListBuckets(tasks, today), [tasks, today]);
  const events = useMemo<ScheduleEvent[]>(() => {
    const mine = tasks.map((task) => taskScheduleEvent(task, today));
    return [...mine, ...horizon];
  }, [tasks, horizon, today]);

  const dealChoices = form.customer_id
    ? deals.filter((d) => !d.customer_id || String(d.customer_id) === form.customer_id)
    : deals;

  const save = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      const member = members.find((m) => m.user_id === form.assignee_user_id);
      const res = await fetch('/api/sales/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          title: form.title,
          kind: form.kind,
          due_on: form.due_on,
          due_time: form.due_time || null,
          customer_id: form.customer_id ? Number(form.customer_id) : null,
          opportunity_id: form.opportunity_id ? Number(form.opportunity_id) : null,
          assignee_user_id: form.assignee_user_id || null,
          assignee_name: member?.name || null,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save the task');
      toast.success('Saved to the diary');
      setForm((f) => ({ ...f, title: '', notes: '', due_time: '' }));
      setFormOpen(false);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not save the task');
    } finally {
      setSaving(false);
    }
  };

  const markDone = async (task: CrmTask) => {
    if (!companyId) return;
    const res = await fetch('/api/sales/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        privyUserId,
        id: task.id,
        status: task.status === 'done' ? 'open' : 'done',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || 'Could not update the task');
      return;
    }
    setTasks((prev) => prev.map((row) => (row.id === task.id ? data.task : row)));
  };

  const onSelectEvent = (event: ScheduleEvent) => {
    if (event.meta === 'task' && event.id.startsWith('task-')) {
      const id = Number(event.id.slice(5));
      setFocusId(id);
      setView('list');
      return;
    }
    toast.message(event.title, {
      description: event.subtitle || 'This date comes from the pipeline deal.',
    });
  };

  if (!companyId) {
    return (
      <p className="rounded-3xl border border-neutral-200 bg-white p-8 text-sm text-neutral-600">
        Select a company to open the diary.
      </p>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Sales diary
          </p>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Tasks <span className="text-[#00b4d8]">on the horizon</span>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Follow-ups save on the company. Close dates and next steps from the pipeline sit on the same calendar.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary min-h-11"
          onClick={() => setFormOpen((v) => !v)}
        >
          <Plus className="h-4 w-4" /> New task
        </button>
      </header>

      {formOpen ? (
        <form
          className="grid gap-3 rounded-3xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 sm:p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="block text-xs font-semibold text-neutral-600 sm:col-span-2">
            What needs doing
            <input
              className={`${inputCls} mt-1`}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Call to confirm the quote"
            />
          </label>
          <label className="block text-xs font-semibold text-neutral-600">
            Kind
            <select
              className={`${inputCls} mt-1`}
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as CrmTaskKind }))}
            >
              {CRM_TASK_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-neutral-600">
            Owner
            <select
              className={`${inputCls} mt-1`}
              value={form.assignee_user_id}
              onChange={(e) => setForm((f) => ({ ...f, assignee_user_id: e.target.value }))}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-neutral-600">
            Due date
            <input
              type="date"
              className={`${inputCls} mt-1`}
              value={form.due_on}
              onChange={(e) => setForm((f) => ({ ...f, due_on: e.target.value }))}
            />
          </label>
          <label className="block text-xs font-semibold text-neutral-600">
            Time
            <input
              type="time"
              className={`${inputCls} mt-1`}
              value={form.due_time}
              onChange={(e) => setForm((f) => ({ ...f, due_time: e.target.value }))}
            />
          </label>
          <label className="block text-xs font-semibold text-neutral-600">
            Customer book
            <select
              className={`${inputCls} mt-1`}
              value={form.customer_id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  customer_id: e.target.value,
                  opportunity_id:
                    f.opportunity_id &&
                    deals.some(
                      (d) =>
                        String(d.id) === f.opportunity_id &&
                        d.customer_id &&
                        String(d.customer_id) !== e.target.value
                    )
                      ? ''
                      : f.opportunity_id,
                }))
              }
            >
              <option value="">No customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.trading_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-neutral-600">
            Pipeline deal
            <select
              className={`${inputCls} mt-1`}
              value={form.opportunity_id}
              onChange={(e) => {
                const deal = deals.find((d) => String(d.id) === e.target.value);
                setForm((f) => ({
                  ...f,
                  opportunity_id: e.target.value,
                  customer_id:
                    deal?.customer_id && !f.customer_id ? String(deal.customer_id) : f.customer_id,
                }));
              }}
            >
              <option value="">No deal</option>
              {dealChoices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.company_name ? ` · ${d.company_name}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-neutral-600 sm:col-span-2">
            Note
            <textarea
              className={`${inputCls} mt-1 min-h-[5.5rem]`}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary min-h-11 w-full sm:w-auto" disabled={saving}>
              {saving ? 'Saving…' : 'Save task'}
            </button>
          </div>
        </form>
      ) : null}

      <div className="flex gap-2 lg:hidden">
        <button
          type="button"
          className={view === 'list' ? 'btn-primary min-h-11 flex-1' : 'btn-secondary min-h-11 flex-1'}
          onClick={() => setView('list')}
        >
          List
        </button>
        <button
          type="button"
          className={view === 'calendar' ? 'btn-primary min-h-11 flex-1' : 'btn-secondary min-h-11 flex-1'}
          onClick={() => setView('calendar')}
        >
          <CalendarDays className="h-4 w-4" /> Calendar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
          <section className={view === 'calendar' ? 'hidden lg:block' : ''}>
            <TaskGroup title="Overdue" tasks={buckets.overdue} tone="rose" focusId={focusId} onToggle={markDone} />
            <TaskGroup title="Today" tasks={buckets.dueToday} tone="sky" focusId={focusId} onToggle={markDone} />
            <TaskGroup title="Coming up" tasks={buckets.upcoming} tone="slate" focusId={focusId} onToggle={markDone} />
            <button
              type="button"
              className="mb-2 min-h-11 text-sm font-semibold text-[#0077b6]"
              onClick={() => setShowDone((v) => !v)}
            >
              {showDone ? 'Hide done' : `Done (${buckets.done.length})`}
            </button>
            {showDone ? (
              <TaskGroup title="Done" tasks={buckets.done} tone="emerald" focusId={focusId} onToggle={markDone} />
            ) : null}
            {!tasks.length ? (
              <p className="rounded-3xl border border-dashed border-neutral-200 bg-white p-6 text-sm text-neutral-600">
                Nothing in the diary yet. Add a follow-up, or set a next step on a{' '}
                <Link href="/sales/pipeline" className="font-semibold text-[#0077b6]">
                  pipeline deal
                </Link>
                .
              </p>
            ) : null}
          </section>
          <section className={view === 'list' ? 'hidden min-w-0 lg:block' : 'min-w-0'}>
            <div className="mb-2 flex flex-wrap gap-2 text-[11px] font-semibold">
              <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-800">Task</span>
              <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-900">Next step</span>
              <span className="rounded-full bg-violet-50 px-2 py-1 text-violet-900">Expected close</span>
              <span className="rounded-full bg-rose-50 px-2 py-1 text-rose-800">Overdue</span>
            </div>
            <PracticeScheduleCalendar
              events={events}
              accent="sky"
              title="Sales diary"
              printBrand="SupplierAdvisor"
              emptyLabel="Nothing on this day"
              defaultView="month"
              onSelectDate={(date) => {
                setForm((f) => ({ ...f, due_on: date }));
                setFormOpen(true);
                setView('list');
              }}
              onSelectEvent={(event) => onSelectEvent(event)}
            />
            <p className="mt-2 text-xs text-neutral-500">
              Tap a day to add a task. Tap a task on the calendar to find it in the list, then mark it done. Close dates and next steps come from the same deals as Customers → Leads.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

function TaskGroup({
  title,
  tasks,
  tone,
  focusId,
  onToggle,
}: {
  title: string;
  tasks: CrmTask[];
  tone: 'rose' | 'sky' | 'slate' | 'emerald';
  focusId: number | null;
  onToggle: (task: CrmTask) => void;
}) {
  if (!tasks.length) return null;
  const head =
    tone === 'rose'
      ? 'text-rose-800'
      : tone === 'sky'
        ? 'text-[#0077b6]'
        : tone === 'emerald'
          ? 'text-emerald-800'
          : 'text-slate-700';
  return (
    <div className="mb-4">
      <h2 className={`mb-2 text-xs font-bold uppercase tracking-wide ${head}`}>{title}</h2>
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li
            key={task.id}
            className={`rounded-2xl border bg-white px-3 py-3 ${
              focusId === task.id ? 'border-[#00b4d8] ring-2 ring-[#00b4d8]/30' : 'border-neutral-200'
            }`}
          >
            <div className="flex items-start gap-2">
              <button
                type="button"
                aria-label={task.status === 'done' ? 'Reopen task' : 'Mark done'}
                onClick={() => onToggle(task)}
                className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-200 text-neutral-500"
              >
                <Check className={`h-4 w-4 ${task.status === 'done' ? 'text-emerald-600' : ''}`} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{task.title}</p>
                <p className="text-xs text-neutral-500">
                  {kindLabel(task.kind)} · {task.due_on}
                  {task.due_time ? ` · ${task.due_time}` : ''}
                  {task.assignee_name ? ` · ${task.assignee_name}` : ''}
                </p>
                <div className="mt-1 flex flex-wrap gap-3">
                  {task.customer_id ? (
                    <Link
                      href={`/dashboard/customers/profiles?id=${task.customer_id}`}
                      className="text-xs font-semibold text-[#0077b6]"
                    >
                      Customer book
                    </Link>
                  ) : null}
                  {task.opportunity_id ? (
                    <Link href="/sales/pipeline" className="text-xs font-semibold text-[#0077b6]">
                      Pipeline deal
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
