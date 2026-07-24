'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  Scale,
  ListTodo,
  Gavel,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  RelationshipHeader,
  RelationshipPage,
  Panel,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { RIAD_TYPES, MIGRATION_HINT } from '@/lib/projects/types';

type Project = { id: number; name: string };
type Riad = {
  id: number;
  project_id: number;
  title: string;
  riad_type?: string;
  status?: string;
  severity?: string | null;
  rpn?: number | null;
  description?: string | null;
  owner_name?: string | null;
  due_date?: string | null;
};

const TYPE_META: Record<
  string,
  { label: string; icon: typeof AlertTriangle; className: string }
> = {
  risk: {
    label: 'Risk',
    icon: AlertTriangle,
    className: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  issue: {
    label: 'Issue',
    icon: Scale,
    className: 'bg-amber-50 text-amber-900 border-amber-200',
  },
  action: {
    label: 'Action',
    icon: ListTodo,
    className: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  decision: {
    label: 'Decision',
    icon: Gavel,
    className: 'bg-violet-50 text-violet-800 border-violet-200',
  },
};

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export default function ProjectRiadPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [riads, setRiads] = useState<Riad[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    open: number;
    byType: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [form, setForm] = useState({
    project_id: '',
    title: '',
    riad_type: 'risk',
    severity: 'medium',
    description: '',
    owner_name: '',
    due_date: '',
    rpn: '',
  });

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const base = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) base.set('privyUserId', privyUserId);
      const [rRes, pRes] = await Promise.all([
        fetch(`/api/projects/riads?${base}`),
        fetch(`/api/projects?${base}`),
      ]);
      const rJson = await rRes.json();
      const pJson = await pRes.json();
      setRiads(rJson.riads || []);
      setSummary(rJson.summary || null);
      setWarning(rJson.warning || rJson.hint || null);
      setProjects(
        (pJson.projects || []).map((p: Project) => ({ id: p.id, name: p.name }))
      );
      if ((pJson.projects || []).length) {
        setForm((f) =>
          f.project_id
            ? f
            : { ...f, project_id: String(pJson.projects[0].id) }
        );
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const projectName = useMemo(() => {
    const m: Record<number, string> = {};
    for (const p of projects) m[p.id] = p.name;
    return m;
  }, [projects]);

  const filtered = useMemo(() => {
    return riads.filter((r) => {
      if (filterType !== 'all' && r.riad_type !== filterType) return false;
      if (filterProject !== 'all' && String(r.project_id) !== filterProject)
        return false;
      return true;
    });
  }, [riads, filterType, filterProject]);

  const add = async () => {
    if (!form.title.trim() || !form.project_id) {
      toast.error('Project and title required');
      return;
    }
    const res = await fetch('/api/projects/riads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        privyUserId,
        project_id: Number(form.project_id),
        title: form.title,
        riad_type: form.riad_type,
        severity: form.severity,
        description: form.description || null,
        owner_name: form.owner_name || null,
        due_date: form.due_date || null,
        rpn: form.rpn ? Number(form.rpn) : null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || json.hint || 'Failed');
      return;
    }
    toast.success('RIAD item logged');
    setForm((f) => ({
      ...f,
      title: '',
      description: '',
      owner_name: '',
      due_date: '',
      rpn: '',
    }));
    await load();
  };

  const setStatus = async (id: number, status: string) => {
    const res = await fetch('/api/projects/riads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, privyUserId, id, status }),
    });
    if (!res.ok) {
      const j = await res.json();
      toast.error(j.error || 'Failed');
      return;
    }
    await load();
  };

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/projects"
        backLabel="Projects"
        eyebrow="PMO · Governance"
        title="RIAD"
        titleAccent="register"
        description="Risks, Issues, Actions, and Decisions — project-scoped governance log used across DMAIC, SDG, and programmes."
      />

      {warning && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {warning}
          <span className="mt-1 block font-mono text-xs">{MIGRATION_HINT}</span>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Panel className="p-3">
          <div className="text-[10px] font-bold uppercase text-neutral-400">Open</div>
          <div className="text-2xl font-black text-amber-700">{summary?.open ?? 0}</div>
        </Panel>
        {RIAD_TYPES.map((t) => (
          <Panel key={t.value} className="p-3">
            <div className="text-[10px] font-bold uppercase text-neutral-400">
              {t.label}s
            </div>
            <div className="text-2xl font-black text-slate-900">
              {summary?.byType?.[t.value] ?? 0}
            </div>
          </Panel>
        ))}
      </div>

      <Panel className="p-4 mb-4">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Log RIAD item
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <select
            className="input !py-2 !text-sm"
            value={form.project_id}
            onChange={(e) => setForm({ ...form, project_id: e.target.value })}
          >
            <option value="">Project *</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="input !py-2 !text-sm"
            value={form.riad_type}
            onChange={(e) => setForm({ ...form, riad_type: e.target.value })}
          >
            {RIAD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            className="input !py-2 !text-sm"
            value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value })}
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                Severity: {s}
              </option>
            ))}
          </select>
          <input
            className="input !py-2 !text-sm"
            type="number"
            placeholder="RPN (optional)"
            value={form.rpn}
            onChange={(e) => setForm({ ...form, rpn: e.target.value })}
          />
          <input
            className="input !py-2 !text-sm sm:col-span-2"
            placeholder="Title *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            className="input !py-2 !text-sm"
            placeholder="Owner"
            value={form.owner_name}
            onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
          />
          <input
            className="input !py-2 !text-sm"
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          />
          <textarea
            className="input !py-2 !text-sm sm:col-span-2 lg:col-span-3 min-h-[56px]"
            placeholder="Description / mitigation / decision rationale"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <button
            type="button"
            onClick={() => void add()}
            className="btn-primary !py-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </Panel>

      <div className="mb-3 flex flex-wrap gap-2">
        <select
          className="input !py-1.5 !text-xs w-auto"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="all">All types</option>
          {RIAD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          className="input !py-1.5 !text-xs w-auto max-w-[220px]"
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
        >
          <option value="all">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <ul className="bg-white border rounded-3xl divide-y overflow-hidden">
          {filtered.length === 0 ? (
            <li className="p-12 text-center text-sm text-neutral-500">
              No RIAD items. Log risks, issues, actions, and decisions against projects.
            </li>
          ) : (
            filtered.map((r) => {
              const meta = TYPE_META[r.riad_type || 'risk'] || TYPE_META.risk;
              const Icon = meta.icon;
              const open = ['open', 'active', 'in_progress'].includes(
                String(r.status || 'open')
              );
              return (
                <li
                  key={r.id}
                  className="px-4 py-3 flex flex-wrap justify-between gap-3 items-start"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${meta.className}`}
                      >
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-neutral-50 text-neutral-600 border-neutral-200">
                        {r.severity || 'medium'}
                      </span>
                      {r.rpn != null && (
                        <span className="text-[10px] font-mono font-bold text-neutral-500">
                          RPN {r.rpn}
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-sm text-slate-900">
                      {r.title}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      {projectName[r.project_id] || `Project #${r.project_id}`}
                      {r.owner_name && ` · ${r.owner_name}`}
                      {r.due_date && ` · due ${r.due_date}`}
                    </div>
                    {r.description && (
                      <p className="text-xs text-neutral-600 mt-1 line-clamp-2">
                        {r.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {open ? (
                      <button
                        type="button"
                        onClick={() => void setStatus(r.id, 'closed')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Close
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void setStatus(r.id, 'open')}
                        className="text-xs text-neutral-500 underline"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}
    </RelationshipPage>
  );
}
