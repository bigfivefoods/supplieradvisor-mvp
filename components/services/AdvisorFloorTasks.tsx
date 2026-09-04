'use client';

import { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { BarChart3, ChevronDown, Plus, Star, Users } from 'lucide-react';
import { toast } from 'sonner';
import { gymPwaFieldClass } from '@/lib/fitness/gym-pwa-theme';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import { C, ChartCard, MixDoughnut } from '@/components/accounting/AccountingCharts';
import {
  countFloorTaskSlices,
  FLOOR_TASK_LISTS,
  floorTaskCountByAssignee,
  floorTaskCountBySlice,
  floorTaskCountByWeek,
  floorTaskSlice,
  floorTasksInPeriod,
  liveFloorTasks,
  sortFloorTasks,
  weekStartIso,
  type FloorTask,
  type FloorTaskList,
  type FloorTaskRepeat,
  type FloorTaskSlice,
} from '@/lib/services/advisor-floor-tasks';
import { isoDateInZone, GYM_DEFAULT_TZ } from '@/lib/fitness/gym-local-time';

type Person = { id: string; name: string; active?: boolean };

type Props = {
  tasks: FloorTask[];
  staff: Person[];
  people: Person[];
  staffLabel: string;
  personLabel: string;
  timezone?: string | null;
  saving?: boolean;
  accent?: 'gym' | 'medical';
  onAction: (body: Record<string, unknown>) => Promise<unknown>;
};

const SLICES: Array<{ id: FloorTaskSlice; label: string }> = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'done', label: 'Done' },
];

export function AdvisorFloorTasks({
  tasks,
  staff,
  people,
  staffLabel,
  personLabel,
  timezone,
  saving,
  accent = 'gym',
  onAction,
}: Props) {
  const today = isoDateInZone(timezone || GYM_DEFAULT_TZ);
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('this_month')
  );
  const [slice, setSlice] = useState<FloorTaskSlice | 'all'>('all');
  const [list, setList] = useState<FloorTaskList | 'all'>('all');
  const [assignee, setAssignee] = useState('');
  const [person, setPerson] = useState('');
  const [repeatFilter, setRepeatFilter] = useState<FloorTaskRepeat | 'all'>(
    'all'
  );
  const [weekKey, setWeekKey] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState('');
  const [draftDue, setDraftDue] = useState(today);
  const [draftRepeat, setDraftRepeat] = useState<FloorTaskRepeat>('none');
  const [draftAssignee, setDraftAssignee] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const live = useMemo(() => liveFloorTasks(tasks), [tasks]);
  const inPeriod = useMemo(
    () => floorTasksInPeriod(live, period.from, period.to),
    [live, period.from, period.to]
  );
  const counts = useMemo(
    () => countFloorTaskSlices(inPeriod, today),
    [inPeriod, today]
  );
  const byWeek = useMemo(
    () => floorTaskCountByWeek(inPeriod, period.from, period.to),
    [inPeriod, period.from, period.to]
  );
  const bySlice = useMemo(
    () => floorTaskCountBySlice(inPeriod, today),
    [inPeriod, today]
  );
  const byAssignee = useMemo(
    () => floorTaskCountByAssignee(inPeriod, staff),
    [inPeriod, staff]
  );
  const staffName = (id?: string | null) =>
    staff.find((s) => s.id === id)?.name || '';
  const personName = (id?: string | null) =>
    people.find((p) => p.id === id)?.name || '';

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inPeriod
      .filter((t) => (slice === 'all' ? true : floorTaskSlice(t, today) === slice))
      .filter((t) => (list === 'all' ? true : t.list === list))
      .filter((t) => {
        if (!assignee) return true;
        if (assignee === 'unassigned') return !t.assignee_id;
        return t.assignee_id === assignee;
      })
      .filter((t) => (person ? t.person_id === person : true))
      .filter((t) => (repeatFilter === 'all' ? true : t.repeat === repeatFilter))
      .filter((t) => {
        if (!weekKey) return true;
        const d = t.due_date || String(t.created_at || '').slice(0, 10);
        return weekStartIso(d) === weekKey;
      })
      .filter((t) =>
        needle
          ? `${t.title} ${t.notes || ''} ${staffName(t.assignee_id)} ${personName(t.person_id)}`
              .toLowerCase()
              .includes(needle)
          : true
      )
      .sort(sortFloorTasks);
  }, [
    inPeriod,
    slice,
    list,
    assignee,
    person,
    repeatFilter,
    weekKey,
    q,
    today,
    staff,
    people,
  ]);

  const run = async (body: Record<string, unknown>, id?: string) => {
    setBusyId(id || 'new');
    try {
      await onAction({ action: 'floor_task', ...body });
    } catch {
      toast.error('Could not save task');
    } finally {
      setBusyId(null);
    }
  };

  const add = async () => {
    const title = draft.trim();
    if (!title) {
      toast.error('Type a task');
      return;
    }
    await run({
      op: 'upsert',
      title,
      list: list === 'all' ? 'floor' : list,
      due_date: draftDue || today,
      repeat: draftRepeat,
      assignee_id: draftAssignee || null,
    });
    setDraft('');
    setDraftDue(today);
    setDraftRepeat('none');
    setDraftAssignee('');
    setSlice('all');
  };

  const chip =
    accent === 'gym'
      ? 'border-yellow-500 bg-yellow-300 text-yellow-950'
      : 'border-emerald-600 bg-emerald-600 text-white';
  const chipOff =
    'border-slate-200 bg-white text-slate-700 dark:border-white/20 dark:bg-white/5 dark:text-slate-100';
  const saveBtn =
    accent === 'gym'
      ? 'bg-[#E8E830] text-slate-900'
      : 'bg-emerald-600 text-white';

  const sliceActive = (id: FloorTaskSlice | 'all') =>
    slice === id ? chip : chipOff;
  const weekIdx = weekKey
    ? byWeek.findIndex((w) => w.key === weekKey)
    : null;
  const sliceIdx = bySlice.findIndex((s) => s.key === slice && slice !== 'all');
  const assigneeIdx = byAssignee.findIndex((s) => s.key === assignee);

  return (
    <div className="space-y-4">
      <PeriodSlicer
        value={period}
        onChange={(next) => {
          setPeriod(next);
          setWeekKey(null);
        }}
        defaultOpen={false}
        className="mb-0"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <button
          type="button"
          onClick={() => setSlice('all')}
          className={`rounded-2xl border px-3 py-3 text-left ${sliceActive('all')}`}
        >
          <div className="text-[10px] font-black uppercase tracking-wide opacity-80">
            In period
          </div>
          <div className="text-xl font-black tabular-nums">{inPeriod.length}</div>
        </button>
        {SLICES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSlice(s.id)}
            className={`rounded-2xl border px-3 py-3 text-left ${sliceActive(s.id)}`}
          >
            <div className="text-[10px] font-black uppercase tracking-wide opacity-80">
              {s.label}
            </div>
            <div className="text-xl font-black tabular-nums">{counts[s.id]}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Tasks by due week"
          subtitle="Click a bar to filter the list"
          icon={BarChart3}
          height={240}
        >
          <Bar
            data={{
              labels: byWeek.map((w) => w.label),
              datasets: [
                {
                  label: 'Tasks',
                  data: byWeek.map((w) => w.count),
                  backgroundColor: byWeek.map((w, i) =>
                    weekIdx === i ? '#E8E830' : C.net
                  ),
                  borderRadius: 10,
                  maxBarThickness: 36,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              onClick: (_e, els) => {
                if (!els.length) return;
                const i = els[0].index;
                const key = byWeek[i]?.key;
                if (!key) return;
                setWeekKey((cur) => (cur === key ? null : key));
              },
            }}
          />
        </ChartCard>
        <ChartCard
          title="Mix"
          subtitle="Status · assignee — click a slice"
          icon={Users}
          height={240}
        >
          <div className="grid h-full gap-3 sm:grid-cols-2">
            <MixDoughnut
              format="count"
              centerLabel="Status"
              centerValue={String(inPeriod.length)}
              emptyMessage="No tasks in this period"
              segments={bySlice.map((s) => ({
                label: s.label,
                value: s.count,
              }))}
              activeIndex={sliceIdx >= 0 ? sliceIdx : null}
              onSegmentClick={(_i, seg) => {
                const key = bySlice.find((s) => s.label === seg.label)?.key as
                  | FloorTaskSlice
                  | undefined;
                if (!key) return;
                setSlice((cur) => (cur === key ? 'all' : key));
              }}
            />
            <MixDoughnut
              format="count"
              centerLabel="Assigned"
              emptyMessage="Nobody assigned"
              segments={byAssignee.map((s) => ({
                label: s.label,
                value: s.count,
              }))}
              activeIndex={assigneeIdx >= 0 ? assigneeIdx : null}
              onSegmentClick={(_i, seg) => {
                const key = byAssignee.find((s) => s.label === seg.label)?.key;
                if (!key) return;
                setAssignee((cur) => (cur === key ? '' : key));
              }}
            />
          </div>
        </ChartCard>
      </div>

      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
          Create task
        </p>
        <input
          className={gymPwaFieldClass}
          placeholder="Task title"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void add();
            }
          }}
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
            Due date
            <input
              type="date"
              className={`${gymPwaFieldClass} mt-1`}
              value={draftDue}
              onChange={(e) => setDraftDue(e.target.value)}
            />
          </label>
          <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
            Repeat
            <select
              className={`${gymPwaFieldClass} mt-1`}
              value={draftRepeat}
              onChange={(e) =>
                setDraftRepeat(e.target.value as FloorTaskRepeat)
              }
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
            Assign to
            <select
              className={`${gymPwaFieldClass} mt-1`}
              value={draftAssignee}
              onChange={(e) => setDraftAssignee(e.target.value)}
            >
              <option value="">Unassigned</option>
              {staff
                .filter((s) => s.active !== false)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          disabled={saving || busyId === 'new'}
          onClick={() => void add()}
          className={`inline-flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm font-black disabled:opacity-50 ${saveBtn}`}
        >
          <Plus className="h-4 w-4" />
          Add task
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className={gymPwaFieldClass}
          value={list}
          onChange={(e) => setList(e.target.value as FloorTaskList | 'all')}
        >
          <option value="all">All lists</option>
          {FLOOR_TASK_LISTS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <select
          className={gymPwaFieldClass}
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
        >
          <option value="">All {staffLabel.toLowerCase()}s</option>
          {staff
            .filter((s) => s.active !== false)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
        <select
          className={gymPwaFieldClass}
          value={person}
          onChange={(e) => setPerson(e.target.value)}
        >
          <option value="">All {personLabel.toLowerCase()}s</option>
          {people
            .filter((p) => p.active !== false)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
        <select
          className={gymPwaFieldClass}
          value={repeatFilter}
          onChange={(e) =>
            setRepeatFilter(e.target.value as FloorTaskRepeat | 'all')
          }
        >
          <option value="all">Any repeat</option>
          <option value="none">One-off</option>
          <option value="daily">Daily</option>
          <option value="weekdays">Weekdays</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <input
          className={`${gymPwaFieldClass} min-w-[12rem] flex-1`}
          placeholder="Search title, notes, people…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {weekKey ? (
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
            onClick={() => setWeekKey(null)}
          >
            Clear week
          </button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
          Nothing in {slice === 'all' ? 'this period' : slice}. Add a task or
          pick another filter.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((t) => {
            const open = openId === t.id;
            const doneBits = t.checks.filter((c) => c.done).length;
            return (
              <li
                key={t.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
              >
                <div className="flex items-start gap-2 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="mt-1.5"
                    checked={t.status === 'done'}
                    disabled={busyId === t.id}
                    onChange={() =>
                      void run(
                        {
                          op: t.status === 'done' ? 'reopen' : 'complete',
                          id: t.id,
                        },
                        t.id
                      )
                    }
                  />
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : t.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span
                      className={`block text-sm font-semibold ${
                        t.status === 'done'
                          ? 'text-slate-400 line-through'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {t.title}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {[
                        FLOOR_TASK_LISTS.find((l) => l.id === t.list)?.label,
                        t.due_date
                          ? `${t.due_date}${t.due_time ? ` ${t.due_time}` : ''}`
                          : null,
                        t.assignee_id ? `${staffLabel} · ${staffName(t.assignee_id)}` : null,
                        t.person_id ? `${personLabel} · ${personName(t.person_id)}` : null,
                        t.status === 'waiting'
                          ? `Waiting${t.waiting_on ? ` · ${t.waiting_on}` : ''}`
                          : null,
                        t.checks.length ? `${doneBits}/${t.checks.length}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </button>
                  <button
                    type="button"
                    title="Now"
                    disabled={busyId === t.id}
                    onClick={() =>
                      void run(
                        {
                          op: 'upsert',
                          task: {
                            ...t,
                            priority: t.priority === 'now' ? 'normal' : 'now',
                          },
                        },
                        t.id
                      )
                    }
                    className={`mt-0.5 rounded-lg p-1 ${
                      t.priority === 'now'
                        ? 'text-amber-500'
                        : 'text-slate-300 hover:text-amber-400'
                    }`}
                  >
                    <Star
                      className="h-4 w-4"
                      fill={t.priority === 'now' ? 'currentColor' : 'none'}
                    />
                  </button>
                  {t.status !== 'done' ? (
                    <button
                      type="button"
                      disabled={busyId === t.id}
                      onClick={() =>
                        void run({ op: 'complete', id: t.id }, t.id)
                      }
                      className="mt-0.5 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-black uppercase"
                    >
                      Close
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busyId === t.id}
                    onClick={() => void run({ op: 'delete', id: t.id }, t.id)}
                    className="mt-0.5 rounded-lg border border-rose-200 px-2 py-1 text-[10px] font-black uppercase text-rose-700"
                  >
                    Delete
                  </button>
                  <ChevronDown
                    className={`mt-1 h-4 w-4 shrink-0 text-slate-400 ${
                      open ? '' : '-rotate-90'
                    }`}
                  />
                </div>
                {open ? (
                  <TaskEditor
                    key={t.id}
                    task={t}
                    staff={staff}
                    people={people}
                    staffLabel={staffLabel}
                    personLabel={personLabel}
                    busy={busyId === t.id}
                    saveBtn={saveBtn}
                    onSave={(patch) =>
                      void run({ op: 'upsert', task: { ...t, ...patch } }, t.id)
                    }
                    onWait={(waiting_on) =>
                      void run({ op: 'wait', id: t.id, waiting_on }, t.id)
                    }
                    onDelete={() => void run({ op: 'delete', id: t.id }, t.id)}
                    onToggleCheck={(check_id) =>
                      void run({ op: 'toggle_check', id: t.id, check_id }, t.id)
                    }
                    onAddCheck={(title) =>
                      void run(
                        {
                          op: 'upsert',
                          task: {
                            ...t,
                            checks: [
                              ...(t.checks || []),
                              { id: `chk_${Date.now().toString(36)}`, title, done: false },
                            ],
                          },
                        },
                        t.id
                      )
                    }
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TaskEditor({
  task,
  staff,
  people,
  staffLabel,
  personLabel,
  busy,
  saveBtn,
  onSave,
  onWait,
  onDelete,
  onToggleCheck,
  onAddCheck,
}: {
  task: FloorTask;
  staff: Person[];
  people: Person[];
  staffLabel: string;
  personLabel: string;
  busy: boolean;
  saveBtn: string;
  onSave: (patch: Partial<FloorTask>) => void;
  onWait: (waiting_on: string) => void;
  onDelete: () => void;
  onToggleCheck: (id: string) => void;
  onAddCheck: (title: string) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes || '');
  const [dueDate, setDueDate] = useState(task.due_date || '');
  const [dueTime, setDueTime] = useState(task.due_time || '');
  const [list, setList] = useState(task.list);
  const [repeat, setRepeat] = useState(task.repeat);
  const [priority, setPriority] = useState(task.priority);
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || '');
  const [personId, setPersonId] = useState(task.person_id || '');
  const [waitingOn, setWaitingOn] = useState(task.waiting_on || '');
  const [checkDraft, setCheckDraft] = useState('');

  return (
    <div className="space-y-3 border-t border-slate-100 p-3 dark:border-slate-800">
      <input
        className={gymPwaFieldClass}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className={gymPwaFieldClass}
        rows={2}
        placeholder="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
          Due
          <input
            type="date"
            className={`${gymPwaFieldClass} mt-1`}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </label>
        <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
          Time
          <input
            type="time"
            className={`${gymPwaFieldClass} mt-1`}
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
          />
        </label>
        <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
          List
          <select
            className={`${gymPwaFieldClass} mt-1`}
            value={list}
            onChange={(e) => setList(e.target.value as FloorTaskList)}
          >
            {FLOOR_TASK_LISTS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
          Repeat
          <select
            className={`${gymPwaFieldClass} mt-1`}
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as FloorTask['repeat'])}
          >
            <option value="none">Does not repeat</option>
            <option value="daily">Every day</option>
            <option value="weekdays">Weekdays</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
          {staffLabel}
          <select
            className={`${gymPwaFieldClass} mt-1`}
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {staff
              .filter((s) => s.active !== false)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
        <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
          {personLabel}
          <select
            className={`${gymPwaFieldClass} mt-1`}
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
          >
            <option value="">Nobody linked</option>
            {people
              .filter((p) => p.active !== false)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
          Priority
          <select
            className={`${gymPwaFieldClass} mt-1`}
            value={priority}
            onChange={(e) => setPriority(e.target.value as FloorTask['priority'])}
          >
            <option value="normal">Normal</option>
            <option value="soon">Soon</option>
            <option value="now">Now</option>
          </select>
        </label>
        <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
          Waiting on
          <input
            className={`${gymPwaFieldClass} mt-1`}
            value={waitingOn}
            placeholder="Name or reason"
            onChange={(e) => setWaitingOn(e.target.value)}
          />
        </label>
      </div>

      <div>
        <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
          Checklist
        </div>
        <ul className="space-y-1">
          {(task.checks || []).map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={c.done}
                disabled={busy}
                onChange={() => onToggleCheck(c.id)}
              />
              <span className={c.done ? 'text-slate-400 line-through' : ''}>
                {c.title}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input
            className={`${gymPwaFieldClass} flex-1`}
            placeholder="Add a step"
            value={checkDraft}
            onChange={(e) => setCheckDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const title = checkDraft.trim();
                if (!title) return;
                onAddCheck(title);
                setCheckDraft('');
              }
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onSave({
              title,
              notes,
              due_date: dueDate || null,
              due_time: dueTime || null,
              list,
              repeat,
              priority,
              assignee_id: assigneeId || null,
              person_id: personId || null,
              waiting_on: waitingOn || null,
            })
          }
          className={`rounded-xl px-3 py-1.5 text-xs font-black disabled:opacity-50 ${saveBtn}`}
        >
          Save
        </button>
        {task.status !== 'waiting' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onWait(waitingOn)}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold dark:border-slate-600"
          >
            Waiting
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
