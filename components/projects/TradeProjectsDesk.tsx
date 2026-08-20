'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { formatMoney } from '@/lib/customers/types';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import {
  HubTelemetryGrid,
  TelemetryCard,
} from '@/components/chrome/CommandHubChrome';
import { Panel } from '@/components/relationship/RelationshipChrome';
import { healthBadge, statusBadge } from '@/lib/projects/types';
import {
  addDays,
  dateRangeOverlaps,
  isoDay,
  waterfallPhaseMeta,
} from '@/lib/projects/waterfall';
import { WaterfallGantt, type GanttGroup } from '@/components/projects/WaterfallGantt';

type Kind = 'customer' | 'supplier';

type Partner = { id: number; name: string };

type Project = {
  id: number;
  name: string;
  description?: string | null;
  status?: string;
  health?: string;
  start_date?: string | null;
  target_date?: string | null;
  budget?: number | null;
  currency?: string | null;
  owner_name?: string | null;
  customer_id?: number | null;
  supplier_id?: number | null;
  partner_name?: string | null;
  progress?: number | null;
  task_stats?: { total: number; done: number };
};

type Task = {
  id: number;
  project_id: number;
  title: string;
  column_key?: string;
  status?: string;
  start_date?: string | null;
  due_date?: string | null;
  phase_key?: string | null;
  assignee?: string | null;
};

const STATUSES = ['planning', 'active', 'on_hold', 'completed'] as const;

function partnerIdOf(p: Project, kind: Kind): number | null {
  const n = kind === 'customer' ? Number(p.customer_id) : Number(p.supplier_id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function barTone(task: Task): GanttGroup['bars'][number]['tone'] {
  const k = String(task.column_key || task.status || '');
  if (k === 'done') return 'emerald';
  if (k === 'in_progress' || k === 'review') return 'cyan';
  if (k === 'todo') return 'violet';
  return 'slate';
}

export function TradeProjectsDesk({ kind }: { kind: Kind }) {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const noun = kind === 'customer' ? 'customer' : 'supplier';

  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('full_fy')
  );
  const [partners, setPartners] = useState<Partner[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [health, setHealth] = useState('all');
  const [partnerId, setPartnerId] = useState<number | 'all'>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    partner: '' as number | '',
    start_date: isoDay(new Date()),
    target_date: addDays(isoDay(new Date()), 56),
    budget: '',
    owner_name: '',
  });
  const [taskTitle, setTaskTitle] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) qs.set('privyUserId', privyUserId);
      qs.set('partner', kind);
      if (partnerId !== 'all') {
        if (kind === 'customer') qs.set('customerId', String(partnerId));
        else qs.set('supplierId', String(partnerId));
      }
      const bookUrl =
        kind === 'customer'
          ? `/api/customers?${qs}`
          : `/api/suppliers?${qs}`;
      const [pRes, tRes, bRes] = await Promise.all([
        fetch(`/api/projects?${qs}`),
        fetch(`/api/projects/tasks?${qs}`),
        fetch(bookUrl),
      ]);
      const pj = await pRes.json();
      const tj = await tRes.json();
      const bj = await bRes.json();
      setProjects(pj.projects || []);
      setTasks(tj.tasks || []);
      const book: Partner[] = kind === 'customer'
        ? (bj.customers || []).map((c: { id: number; trading_name?: string }) => ({
            id: Number(c.id),
            name: String(c.trading_name || `#${c.id}`),
          }))
        : (bj.suppliers || []).map((s: { id: number; trading_name?: string }) => ({
            id: Number(s.id),
            name: String(s.trading_name || `#${s.id}`),
          }));
      setPartners(book);
      if (pj.warning) toast.message(pj.warning);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, kind, partnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sliced = useMemo(() => {
    return projects.filter((p) => {
      if (status !== 'all' && String(p.status) !== status) return false;
      if (health !== 'all' && String(p.health || 'green') !== health) return false;
      if (partnerId !== 'all' && partnerIdOf(p, kind) !== partnerId) return false;
      return dateRangeOverlaps(
        p.start_date,
        p.target_date,
        period.from,
        period.to
      );
    });
  }, [projects, status, health, partnerId, kind, period.from, period.to]);

  const selected = sliced.find((p) => p.id === selectedId) || sliced[0] || null;

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  const today = isoDay(new Date());
  const metrics = useMemo(() => {
    const active = sliced.filter((p) => p.status === 'active').length;
    const done = sliced.filter((p) => p.status === 'completed').length;
    const onTime = sliced.filter((p) => {
      if (p.status === 'completed') return true;
      if (!p.target_date) return true;
      return String(p.target_date).slice(0, 10) >= today;
    }).length;
    const taskTotal = sliced.reduce((n, p) => n + (p.task_stats?.total || 0), 0);
    const taskDone = sliced.reduce((n, p) => n + (p.task_stats?.done || 0), 0);
    const budget = sliced.reduce((n, p) => n + Number(p.budget || 0), 0);
    return { active, done, onTime, taskTotal, taskDone, budget };
  }, [sliced, today]);

  const groups: GanttGroup[] = useMemo(() => {
    return sliced.map((p) => {
      const mine = tasks
        .filter((t) => t.project_id === p.id)
        .sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
      const bars = mine.length
        ? mine.map((t) => ({
            id: String(t.id),
            label: t.phase_key
              ? waterfallPhaseMeta(t.phase_key).label
              : t.title,
            start: String(t.start_date || p.start_date || period.from).slice(0, 10),
            end: String(t.due_date || p.target_date || period.to).slice(0, 10),
            tone: barTone(t),
            progress: t.column_key === 'done' || t.status === 'done' ? 100 : 0,
            subtitle: t.column_key || t.status || undefined,
          }))
        : [
            {
              id: `p-${p.id}`,
              label: p.name,
              start: String(p.start_date || period.from).slice(0, 10),
              end: String(p.target_date || period.to).slice(0, 10),
              tone: 'cyan' as const,
              progress: Number(p.progress || 0),
            },
          ];
      return {
        id: String(p.id),
        title: p.name,
        subtitle: [p.partner_name, p.status].filter(Boolean).join(' · '),
        bars,
      };
    });
  }, [sliced, tasks, period.from, period.to]);

  const selectedTasks = tasks
    .filter((t) => selected && t.project_id === selected.id)
    .sort((a, b) => (a.id > b.id ? 1 : -1));

  const create = async () => {
    if (!form.name.trim() || !form.partner) {
      toast.error(`Name and ${noun} required`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          name: form.name,
          description: form.description,
          status: 'planning',
          project_type: 'joint',
          methodology: 'standard',
          start_date: form.start_date,
          target_date: form.target_date,
          budget: form.budget ? Number(form.budget) : null,
          owner_name: form.owner_name || null,
          customer_id: kind === 'customer' ? form.partner : null,
          supplier_id: kind === 'supplier' ? form.partner : null,
          seed_waterfall: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || json.hint || 'Failed');
        return;
      }
      toast.success('Project opened on both books');
      setShow(false);
      setForm((f) => ({ ...f, name: '', description: '', budget: '' }));
      await load();
    } finally {
      setSaving(false);
    }
  };

  const patchProject = async (id: number, patch: Record<string, unknown>) => {
    const res = await fetch('/api/projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, privyUserId, id, ...patch }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Failed');
      return;
    }
    await load();
  };

  const patchTask = async (id: number, patch: Record<string, unknown>) => {
    const res = await fetch('/api/projects/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, privyUserId, id, ...patch }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Failed');
      return;
    }
    await load();
  };

  const addTask = async () => {
    if (!selected || !taskTitle.trim()) return;
    const res = await fetch('/api/projects/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        privyUserId,
        project_id: selected.id,
        title: taskTitle,
        column_key: 'todo',
        start_date: selected.start_date || period.from,
        due_date: selected.target_date || period.to,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Failed');
      return;
    }
    setTaskTitle('');
    await load();
  };

  return (
    <div className="space-y-5">
      <PeriodSlicer
        value={period}
        onChange={setPeriod}
        showTrailing
        defaultOpen={false}
        className="mb-0"
      />
      <div className="flex flex-wrap gap-2">
        <select
          className="input !py-1.5 !px-2 !text-xs"
          value={partnerId === 'all' ? 'all' : String(partnerId)}
          onChange={(e) =>
            setPartnerId(e.target.value === 'all' ? 'all' : Number(e.target.value))
          }
        >
          <option value="all">All {noun}s</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(status === s ? 'all' : s)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase border ${
              status === s
                ? 'bg-[#00b4d8] border-[#00b4d8] text-white'
                : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
        {(['green', 'amber', 'red'] as const).map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => setHealth(health === h ? 'all' : h)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase border ${
              health === h
                ? 'bg-slate-800 border-slate-800 text-white'
                : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            {h}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-neutral-500">
          Slice {period.label} · {sliced.length} project{sliced.length === 1 ? '' : 's'}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> New project
          </button>
        </div>
      </div>

      <HubTelemetryGrid className="mb-0">
        <TelemetryCard label="In slice" value={sliced.length} sub={period.label} accent="violet" />
        <TelemetryCard label="Active" value={metrics.active} sub={`${metrics.done} closed`} accent="cyan" />
        <TelemetryCard
          label="On time"
          value={sliced.length ? `${Math.round((metrics.onTime / sliced.length) * 100)}%` : '—'}
          sub="Vs target date"
          accent="emerald"
        />
        <TelemetryCard
          label="Tasks"
          value={`${metrics.taskDone}/${metrics.taskTotal}`}
          sub="Done / total"
          accent="sky"
        />
        <TelemetryCard
          label="Budget"
          value={formatMoney(metrics.budget)}
          sub="Sum in slice"
          accent="amber"
        />
        <TelemetryCard
          label="Partners"
          value={partners.length}
          sub={`On the ${noun} book`}
          accent="slate"
        />
      </HubTelemetryGrid>

      {show ? (
        <Panel title={`Open a project with a ${noun}`} className="p-0">
          <div className="p-5 grid sm:grid-cols-2 gap-3">
            <select
              className="input !p-2.5 !text-sm sm:col-span-2"
              value={form.partner}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  partner: e.target.value ? Number(e.target.value) : '',
                }))
              }
            >
              <option value="">Select {noun}</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              className="input !p-2.5 !text-sm sm:col-span-2"
              placeholder="Project name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <textarea
              className="input !p-2.5 !text-sm sm:col-span-2 min-h-[64px]"
              placeholder="What are we delivering together?"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <label className="text-[10px] font-bold uppercase text-neutral-400">
              Start
              <input
                type="date"
                className="input mt-0.5 w-full !p-2 !text-sm font-medium normal-case"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </label>
            <label className="text-[10px] font-bold uppercase text-neutral-400">
              Target
              <input
                type="date"
                className="input mt-0.5 w-full !p-2 !text-sm font-medium normal-case"
                value={form.target_date}
                onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))}
              />
            </label>
            <input
              className="input !p-2.5 !text-sm"
              placeholder="Budget (ZAR)"
              value={form.budget}
              onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
            />
            <input
              className="input !p-2.5 !text-sm"
              placeholder="Owner"
              value={form.owner_name}
              onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))}
            />
            <p className="sm:col-span-2 text-[11px] text-neutral-500">
              Seeds Initiate → Plan → Execute → Verify → Close as a sequential
              waterfall the {noun} can also see on their portal.
            </p>
            <button
              type="button"
              disabled={saving}
              onClick={() => void create()}
              className="btn-primary !py-2.5 text-sm sm:col-span-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create waterfall project'}
            </button>
          </div>
        </Panel>
      ) : null}

      {loading && !projects.length ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <WaterfallGantt
          groups={groups}
          from={period.from}
          to={period.to}
          onSelect={(gid) => setSelectedId(Number(gid))}
        />
      )}

      {selected ? (
        <div className="grid lg:grid-cols-5 gap-4">
          <Panel title="Info" className="lg:col-span-2">
            <div className="p-5 space-y-3">
              <h3 className="text-lg font-black text-slate-900">{selected.name}</h3>
              <p className="text-sm text-neutral-600">
                {selected.description || 'No description yet.'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 border ${statusBadge(selected.status)}`}>
                  {selected.status}
                </span>
                <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 border ${healthBadge(selected.health)}`}>
                  {selected.health || 'green'}
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                With <strong>{selected.partner_name || noun}</strong>
                {selected.owner_name ? ` · ${selected.owner_name}` : ''}
              </p>
              <p className="text-xs tabular-nums text-neutral-500">
                {String(selected.start_date || '—').slice(0, 10)} →{' '}
                {String(selected.target_date || '—').slice(0, 10)}
                {selected.budget != null
                  ? ` · ${formatMoney(selected.budget, selected.currency || 'ZAR')}`
                  : ''}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void patchProject(selected.id, { status: s })}
                    className="btn-secondary !py-1 !px-2 text-[10px]"
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </Panel>
          <Panel title="Tasks" className="lg:col-span-3">
            <div className="p-4 space-y-2">
              {selectedTasks.length === 0 ? (
                <p className="text-sm text-neutral-500">No tasks yet.</p>
              ) : (
                selectedTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{t.title}</p>
                      <p className="text-[11px] text-neutral-500">
                        {[t.phase_key, t.start_date, t.due_date ? `→ ${t.due_date}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {['todo', 'in_progress', 'done'].map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() =>
                            void patchTask(t.id, { column_key: col, status: col })
                          }
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                            (t.column_key || t.status) === col
                              ? 'bg-[#00b4d8] border-[#00b4d8] text-white'
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          {col.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
              <div className="flex gap-2 pt-2">
                <input
                  className="input flex-1 !py-2 !px-2.5 !text-sm"
                  placeholder="Add a task"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                />
                <button
                  type="button"
                  disabled={!taskTitle.trim()}
                  onClick={() => void addTask()}
                  className="btn-secondary !py-2 !px-3 text-xs"
                >
                  Add
                </button>
              </div>
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
