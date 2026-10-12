'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CRM_TASK_KINDS,
  DIARY_LENSES,
  diaryTableRows,
  eventsForLens,
  lensForDiaryEvent,
  rowsForLens,
  taskScheduleEvent,
  type CrmTask,
  type CrmTaskKind,
  type DiaryEvent,
  type DiaryLens,
  type DiaryTableRow,
} from '@/lib/sales/crm-tasks';
import { salesDiaryIcs } from '@/lib/sales/diary-ics';
import { downloadIcsBrowser } from '@/lib/schedule/advisor-ics';
import { DiaryCalendarConnect, syncConnectedCalendars } from '@/components/sales/DiaryCalendarConnect';
import {
  PracticeScheduleCalendar,
  type ScheduleEvent,
} from '@/components/schedule/PracticeScheduleCalendar';

type DiaryFeed = {
  https: string;
  webcal: string;
  google: string;
  outlook: string;
};

const LENS_ON: Record<DiaryLens, string> = {
  all: 'border-slate-900 bg-slate-900 text-white',
  task: 'border-sky-300 bg-sky-50 text-sky-900',
  next: 'border-amber-300 bg-amber-50 text-amber-950',
  close: 'border-violet-300 bg-violet-50 text-violet-950',
  overdue: 'border-rose-300 bg-rose-50 text-rose-900',
  done: 'border-emerald-300 bg-emerald-50 text-emerald-900',
};

const LENS_DOT: Record<DiaryLens, string> = {
  all: 'bg-slate-400',
  task: 'bg-sky-500',
  next: 'bg-amber-500',
  close: 'bg-violet-500',
  overdue: 'bg-rose-500',
  done: 'bg-emerald-500',
};

type CustomerOpt = { id: number; trading_name: string };
type DealOpt = { id: number; name: string; customer_id: number | null; company_name: string | null };
type Member = { user_id: string; name: string };

const inputCls =
  'input min-h-11 w-full !px-3 !py-2.5 !text-sm font-medium normal-case tracking-normal';

const toolBtn =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-neutral-200 bg-white px-3 text-sm font-semibold text-slate-800 no-underline';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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
  const [lens, setLens] = useState<DiaryLens>('all');
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [feed, setFeed] = useState<DiaryFeed | null>(null);
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
      setFeed(taskData.feed?.https ? (taskData.feed as DiaryFeed) : null);
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
  const events = useMemo<DiaryEvent[]>(() => {
    const mine = tasks.map((task) => taskScheduleEvent(task, today));
    return [...mine, ...horizon];
  }, [tasks, horizon, today]);
  const visibleEvents = useMemo(() => eventsForLens(events, lens, today), [events, lens, today]);
  const tableRows = useMemo(
    () => rowsForLens(diaryTableRows(tasks, horizon, today), lens),
    [tasks, horizon, today, lens]
  );
  const counts = useMemo(() => {
    const rows = diaryTableRows(tasks, horizon, today);
    return Object.fromEntries(DIARY_LENSES.map((item) => [item.id, rowsForLens(rows, item.id).length])) as Record<
      DiaryLens,
      number
    >;
  }, [tasks, horizon, today]);

  useEffect(() => {
    if (!focusKey) return;
    document.getElementById(`diary-row-${focusKey}`)?.scrollIntoView({ block: 'nearest' });
  }, [focusKey, lens, tableRows]);

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
      await syncConnectedCalendars(companyId, privyUserId);
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
    const changed = await syncConnectedCalendars(companyId, privyUserId);
    if (changed) await load();
  };

  const onSelectEvent = (event: ScheduleEvent) => {
    const next = lensForDiaryEvent(event, today);
    if (lens === 'all' && next === 'done') setLens('done');
    else if (lens !== 'all' && lens !== next) setLens(next);
    setFocusKey(event.id);
  };

  const downloadDiary = () => {
    downloadIcsBrowser(
      'sales-diary.ics',
      salesDiaryIcs(events, {
        calName: 'Sales diary',
        pageUrl: `${window.location.origin}/sales/tasks`,
      })
    );
  };

  const copyFeed = async () => {
    if (!feed) return;
    try {
      await navigator.clipboard.writeText(feed.https);
      toast.success('Feed link copied. Paste it into Google, Apple, or Outlook.');
    } catch {
      toast.error('Could not copy the feed link');
    }
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
        <div className="flex flex-col gap-2 sm:items-end">
          <button
            type="button"
            className="btn-primary min-h-11"
            onClick={() => setFormOpen((v) => !v)}
          >
            <Plus className="h-4 w-4" /> New task
          </button>
          <div className="flex flex-wrap gap-2">
            {feed ? (
              <>
                <a className={toolBtn} href={feed.google} target="_blank" rel="noreferrer">
                  Subscribe Google
                </a>
                <a className={toolBtn} href={feed.webcal}>
                  Subscribe Apple
                </a>
                <a className={toolBtn} href={feed.outlook} target="_blank" rel="noreferrer">
                  Subscribe Outlook
                </a>
                <button type="button" className={toolBtn} onClick={() => void copyFeed()}>
                  Copy feed link
                </button>
              </>
            ) : null}
            <button type="button" className={toolBtn} onClick={downloadDiary}>
              Download .ics
            </button>
          </div>
        </div>
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

      <DiaryCalendarConnect companyId={companyId} privyUserId={privyUserId} onChanged={() => void load()} />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <section className="min-w-0 rounded-3xl border border-neutral-200 bg-white p-3 sm:p-5">
          <div role="tablist" aria-label="Diary" className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {DIARY_LENSES.map((item) => {
              const selected = lens === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-semibold ${
                    selected ? LENS_ON[item.id] : 'border-neutral-200 bg-white text-slate-800'
                  }`}
                  onClick={() => setLens(item.id)}
                >
                  <span className={`h-2 w-2 rounded-full ${selected && item.id === 'all' ? 'bg-white' : LENS_DOT[item.id]}`} />
                  {item.label}
                  <span className="text-xs font-medium opacity-70">{counts[item.id]}</span>
                </button>
              );
            })}
          </div>
          <PracticeScheduleCalendar
            events={visibleEvents}
            accent="sky"
            title="Sales diary"
            printBrand="SupplierAdvisor"
            emptyLabel="Nothing on this day"
            defaultView="month"
            selectedEventId={focusKey}
            onSelectDate={(date) => {
              setForm((f) => ({ ...f, due_on: date }));
              setFormOpen(true);
            }}
            onSelectEvent={(event) => onSelectEvent(event)}
          />
          <DiaryTable
            rows={tableRows}
            tasks={tasks}
            focusKey={focusKey}
            lens={lens}
            onToggle={markDone}
          />
          <p className="mt-3 text-xs text-neutral-500">
            Tap a day to add a task. The tabs filter the calendar and the table. A connected SupplierAdvisor
            calendar writes both ways. The subscribe buttons are a separate one-way mirror, so use one or the other
            or the same task appears twice.
          </p>
        </section>
      )}
    </div>
  );
}

function lensLabel(id: DiaryTableRow['lens']) {
  return DIARY_LENSES.find((item) => item.id === id)?.label || 'Task';
}

function DiaryTable({
  rows,
  tasks,
  focusKey,
  lens,
  onToggle,
}: {
  rows: DiaryTableRow[];
  tasks: CrmTask[];
  focusKey: string | null;
  lens: DiaryLens;
  onToggle: (task: CrmTask) => void;
}) {
  if (!rows.length) {
    return (
      <p className="mt-4 rounded-2xl border border-dashed border-neutral-200 p-6 text-sm text-neutral-600">
        {lens === 'done' ? (
          'Nothing marked done yet.'
        ) : lens === 'all' ? (
          <>
            Nothing in the diary yet. Add a follow-up, or set a next step on a{' '}
            <Link href="/sales/pipeline" className="font-semibold text-[#0077b6]">
              pipeline deal
            </Link>
            .
          </>
        ) : (
          `Nothing under ${DIARY_LENSES.find((item) => item.id === lens)?.label || 'this tab'}.`
        )}
      </p>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            <th className="py-2 pr-3 font-semibold">When</th>
            <th className="py-2 pr-3 font-semibold">Item</th>
            <th className="hidden py-2 pr-3 font-semibold sm:table-cell">Kind</th>
            <th className="py-2 font-semibold">
              <span className="sr-only">Done</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const task = row.taskId != null ? tasks.find((item) => item.id === row.taskId) : undefined;
            const focused = focusKey === row.key;
            return (
              <tr
                key={row.key}
                id={`diary-row-${row.key}`}
                className={`border-b border-neutral-100 ${focused ? 'bg-sky-50' : ''}`}
              >
                <td className="whitespace-nowrap py-3 pr-3 align-top font-medium text-slate-800">
                  {row.date}
                  {row.time ? <span className="block text-xs font-normal text-neutral-500">{row.time}</span> : null}
                </td>
                <td className="py-3 pr-3 align-top">
                  <p className="font-semibold text-slate-900">{row.title}</p>
                  <p className="text-xs text-neutral-500 sm:hidden">{lensLabel(row.lens)}</p>
                  {row.detail ? <p className="text-xs text-neutral-500">{row.detail}</p> : null}
                  <div className="mt-1 flex flex-wrap gap-3">
                    {row.customerId ? (
                      <Link
                        href={`/dashboard/customers/profiles?id=${row.customerId}`}
                        className="text-xs font-semibold text-[#0077b6]"
                      >
                        Customer book
                      </Link>
                    ) : null}
                    {row.opportunityId ? (
                      <Link href="/sales/pipeline" className="text-xs font-semibold text-[#0077b6]">
                        Pipeline deal
                      </Link>
                    ) : null}
                  </div>
                </td>
                <td className="hidden whitespace-nowrap py-3 pr-3 align-top text-neutral-600 sm:table-cell">
                  {lensLabel(row.lens)}
                </td>
                <td className="py-3 align-top">
                  {task ? (
                    <button
                      type="button"
                      aria-label={task.status === 'done' ? 'Reopen task' : 'Mark done'}
                      onClick={() => onToggle(task)}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 text-neutral-500"
                    >
                      <Check className={`h-4 w-4 ${task.status === 'done' ? 'text-emerald-600' : ''}`} />
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
