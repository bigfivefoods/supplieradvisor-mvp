'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2, Plus, X, Layers, Globe2, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  PROJECT_METHODOLOGIES,
  PROJECT_TYPES,
  healthBadge,
  statusBadge,
  MIGRATION_HINT,
  dmaicGateMeta,
} from '@/lib/projects/types';
import { getSdgGoal, SDG_GOALS } from '@/lib/projects/sdg-catalog';

type Project = {
  id: number;
  name: string;
  description?: string | null;
  status?: string;
  priority?: string;
  progress?: number;
  health?: string;
  target_date?: string | null;
  budget?: number | null;
  currency?: string | null;
  owner_name?: string | null;
  methodology?: string | null;
  methodology_gate?: string | null;
  project_type?: string | null;
  programme_id?: number | null;
  sdg_goal?: number | null;
  customer_id?: number | null;
  supplier_id?: number | null;
  partner_name?: string | null;
  open_riads?: number;
  task_stats?: { total: number; done: number };
  milestone_stats?: { total: number; done: number };
};

type CustomerOpt = { id: number; name: string };

type Programme = { id: number; name: string; code?: string | null };

export default function PortfolioPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      }
    >
      <PortfolioInner />
    </Suspense>
  );
}

function PortfolioInner() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const searchParams = useSearchParams();
  const programmeFromUrl = searchParams.get('programmeId');

  const [projects, setProjects] = useState<Project[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [filterMethod, setFilterMethod] = useState('all');
  const [filterProgramme, setFilterProgramme] = useState(
    programmeFromUrl || 'all'
  );
  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'planning',
    priority: 'medium',
    target_date: '',
    owner_name: '',
    budget: '',
    methodology: 'standard',
    project_type: 'initiative',
    programme_id: '',
    sdg_goal: '',
    problem_statement: '',
    goal_statement: '',
    customer_id: '',
    seed_waterfall: true,
  });

  useEffect(() => {
    if (programmeFromUrl) setFilterProgramme(programmeFromUrl);
  }, [programmeFromUrl]);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      if (filterProgramme !== 'all') params.set('programmeId', filterProgramme);
      if (filterMethod !== 'all') params.set('methodology', filterMethod);

      const custParams = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) custParams.set('privyUserId', privyUserId);
      const [pRes, progRes, custRes] = await Promise.all([
        fetch(`/api/projects?${params}`),
        fetch(`/api/projects/programmes?${params}`),
        fetch(`/api/customers?${custParams}`),
      ]);
      const json = await pRes.json();
      const progJson = await progRes.json();
      const custJson = await custRes.json();
      setProjects(json.projects || []);
      setProgrammes(
        (progJson.programmes || []).map((p: Programme) => ({
          id: p.id,
          name: p.name,
          code: p.code,
        }))
      );
      setCustomers(
        ((custJson.customers || []) as Array<{ id: number; trading_name?: string }>)
          .slice(0, 400)
          .map((c) => ({
            id: Number(c.id),
            name: String(c.trading_name || `#${c.id}`),
          }))
      );
      setWarning(json.warning || json.migration || json.hint || null);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, filterProgramme, filterMethod]);

  useEffect(() => {
    void load();
  }, [load]);

  const programmeName = useMemo(() => {
    const m: Record<number, string> = {};
    for (const p of programmes) m[p.id] = p.name;
    return m;
  }, [programmes]);

  const create = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        privyUserId,
        name: form.name,
        description: form.description,
        status: form.status,
        priority: form.priority,
        target_date: form.target_date || null,
        owner_name: form.owner_name || null,
        budget: form.budget ? Number(form.budget) : null,
        methodology: form.methodology,
        project_type: form.project_type,
        programme_id: form.programme_id ? Number(form.programme_id) : null,
        sdg_goal: form.sdg_goal ? Number(form.sdg_goal) : null,
        problem_statement: form.problem_statement || null,
        goal_statement: form.goal_statement || null,
        methodology_gate:
          form.methodology === 'dmaic' || form.methodology === 'hybrid'
            ? 'define'
            : null,
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        seed_waterfall: form.seed_waterfall === true,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || json.hint || 'Failed');
      return;
    }
    toast.success('Project created');
    setShow(false);
    setForm({
      name: '',
      description: '',
      status: 'planning',
      priority: 'medium',
      target_date: '',
      owner_name: '',
      budget: '',
      methodology: 'standard',
      project_type: 'initiative',
      programme_id: filterProgramme !== 'all' ? filterProgramme : '',
      sdg_goal: '',
      problem_statement: '',
      goal_statement: '',
      customer_id: '',
      seed_waterfall: true,
    });
    await load();
  };

  const setStatus = async (id: number, status: string) => {
    const res = await fetch('/api/projects', {
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

  const setProgramme = async (id: number, programme_id: string) => {
    const res = await fetch('/api/projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        privyUserId,
        id,
        programme_id: programme_id ? Number(programme_id) : null,
      }),
    });
    if (!res.ok) {
      const j = await res.json();
      toast.error(j.error || 'Failed');
      return;
    }
    toast.success('Programme updated');
    await load();
  };

  const setCustomer = async (id: number, customer_id: string) => {
    const res = await fetch('/api/projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        privyUserId,
        id,
        customer_id: customer_id ? Number(customer_id) : null,
      }),
    });
    if (!res.ok) {
      const j = await res.json();
      toast.error(j.error || 'Failed');
      return;
    }
    toast.success(
      customer_id
        ? 'Linked to customer portal (joint project)'
        : 'Customer link removed'
    );
    await load();
  };

  const needsDmaic =
    form.methodology === 'dmaic' || form.methodology === 'hybrid';
  const needsSdg = form.methodology === 'sdg' || form.methodology === 'hybrid';

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/projects"
        backLabel="Projects"
        eyebrow="EPM · Portfolio"
        title="All"
        titleAccent="initiatives"
        description="Strategic, DMAIC, and SDG projects in one portfolio. Link a customer (e.g. Boxer) to share the waterfall on their guest portal — both sides work the same tasks."
        action={
          <button
            type="button"
            onClick={() => setShow(true)}
            className="btn-primary !py-2 !px-4 text-sm"
          >
            <Plus className="w-4 h-4" /> New project
          </button>
        }
      />

      {warning && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {warning}
          <span className="mt-1 block font-mono text-xs">{MIGRATION_HINT}</span>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          className="input !py-1.5 !text-xs w-auto"
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value)}
        >
          <option value="all">All methodologies</option>
          {PROJECT_METHODOLOGIES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          className="input !py-1.5 !text-xs w-auto max-w-[220px]"
          value={filterProgramme}
          onChange={(e) => setFilterProgramme(e.target.value)}
        >
          <option value="all">All programmes</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code ? `${p.code} · ` : ''}
              {p.name}
            </option>
          ))}
        </select>
        <Link
          href="/dashboard/projects/programmes"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#00b4d8] px-2"
        >
          <Layers className="w-3.5 h-3.5" /> Manage programmes
        </Link>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white border rounded-3xl p-16 text-center text-sm text-neutral-500">
          No projects yet. Create a standard, DMAIC, or SDG initiative.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => {
            const sdg = getSdgGoal(p.sdg_goal);
            const gate =
              p.methodology === 'dmaic' || p.methodology === 'hybrid'
                ? dmaicGateMeta(String(p.methodology_gate || 'define'))
                : null;
            return (
              <div
                key={p.id}
                className="bg-white border rounded-3xl p-5 flex flex-col gap-3 min-w-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-1 mb-1">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadge(p.status)}`}
                      >
                        {p.status}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${healthBadge(p.health)}`}
                      >
                        {p.health || 'green'}
                      </span>
                      {p.methodology && p.methodology !== 'standard' && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-violet-50 text-violet-800 border-violet-200">
                          {p.methodology}
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-slate-900">{p.name}</div>
                    {p.description && (
                      <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                        {p.description}
                      </p>
                    )}
                  </div>
                  {sdg && (
                    <div
                      className="h-9 w-9 rounded-lg flex items-center justify-center text-white text-sm font-black shrink-0"
                      style={{ backgroundColor: sdg.color }}
                      title={sdg.name}
                    >
                      {sdg.id}
                    </div>
                  )}
                </div>

                <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full"
                    style={{ width: `${Math.min(100, p.progress || 0)}%` }}
                  />
                </div>

                <div className="text-[11px] text-neutral-500 flex flex-wrap gap-x-2 gap-y-1">
                  <span>{p.priority} priority</span>
                  {p.target_date && <span>· due {p.target_date}</span>}
                  {p.programme_id && programmeName[p.programme_id] && (
                    <span>· {programmeName[p.programme_id]}</span>
                  )}
                  {gate && (
                    <span className="inline-flex items-center gap-0.5 text-violet-700 font-semibold">
                      <Workflow className="w-3 h-3" /> {gate.label}
                    </span>
                  )}
                  {(p.open_riads || 0) > 0 && (
                    <span className="text-amber-700 font-semibold">
                      · {p.open_riads} RIAD
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-neutral-500">
                  Tasks {p.task_stats?.done || 0}/{p.task_stats?.total || 0} ·
                  Milestones {p.milestone_stats?.done || 0}/
                  {p.milestone_stats?.total || 0}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="input !py-1.5 !text-xs"
                    value={p.status || 'planning'}
                    onChange={(e) => void setStatus(p.id, e.target.value)}
                  >
                    {['planning', 'active', 'on_hold', 'completed', 'cancelled'].map(
                      (s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      )
                    )}
                  </select>
                  <select
                    className="input !py-1.5 !text-xs"
                    value={p.programme_id ? String(p.programme_id) : ''}
                    onChange={(e) => void setProgramme(p.id, e.target.value)}
                  >
                    <option value="">No programme</option>
                    {programmes.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.name}
                      </option>
                    ))}
                  </select>
                </div>
                <select
                  className="input !py-1.5 !text-xs w-full"
                  value={p.customer_id ? String(p.customer_id) : ''}
                  onChange={(e) => void setCustomer(p.id, e.target.value)}
                  title="Customer on portal"
                >
                  <option value="">No customer portal link</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      Portal · {c.name}
                    </option>
                  ))}
                </select>
                {p.partner_name || p.customer_id ? (
                  <p className="text-[10px] font-semibold text-[#0077b6]">
                    Joint with{' '}
                    {p.partner_name ||
                      customers.find((c) => c.id === Number(p.customer_id))?.name ||
                      'customer'}
                    {' · '}visible on their portal Projects tab
                  </p>
                ) : null}

                {(p.methodology === 'dmaic' || p.methodology === 'hybrid') && (
                  <Link
                    href="/dashboard/projects/dmaic"
                    className="text-[11px] font-bold text-[#00b4d8]"
                  >
                    Open DMAIC board →
                  </Link>
                )}
                {(p.methodology === 'sdg' || p.methodology === 'hybrid') && (
                  <Link
                    href="/dashboard/projects/sdg"
                    className="text-[11px] font-bold text-emerald-700 inline-flex items-center gap-1"
                  >
                    <Globe2 className="w-3 h-3" /> SDG portfolio →
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      {show && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl border p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-lg">New project</h3>
              <button type="button" onClick={() => setShow(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <input
                className="input w-full !p-3 !text-sm"
                placeholder="Name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <textarea
                className="input w-full !p-3 !text-sm min-h-[60px]"
                placeholder="Description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
              <select
                className="input w-full !p-3 !text-sm"
                value={form.methodology}
                onChange={(e) =>
                  setForm({ ...form, methodology: e.target.value })
                }
              >
                {PROJECT_METHODOLOGIES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                className="input w-full !p-3 !text-sm"
                value={form.project_type}
                onChange={(e) =>
                  setForm({ ...form, project_type: e.target.value })
                }
              >
                {PROJECT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                className="input w-full !p-3 !text-sm"
                value={form.programme_id}
                onChange={(e) =>
                  setForm({ ...form, programme_id: e.target.value })
                }
              >
                <option value="">Programme (optional)</option>
                {programmes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {needsSdg && (
                <select
                  className="input w-full !p-3 !text-sm"
                  value={form.sdg_goal}
                  onChange={(e) =>
                    setForm({ ...form, sdg_goal: e.target.value })
                  }
                >
                  <option value="">Primary SDG</option>
                  {SDG_GOALS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.id}. {g.name}
                    </option>
                  ))}
                </select>
              )}
              {needsDmaic && (
                <>
                  <textarea
                    className="input w-full !p-3 !text-sm min-h-[56px]"
                    placeholder="Problem statement"
                    value={form.problem_statement}
                    onChange={(e) =>
                      setForm({ ...form, problem_statement: e.target.value })
                    }
                  />
                  <textarea
                    className="input w-full !p-3 !text-sm min-h-[56px]"
                    placeholder="Goal statement"
                    value={form.goal_statement}
                    onChange={(e) =>
                      setForm({ ...form, goal_statement: e.target.value })
                    }
                  />
                </>
              )}
              <input
                className="input w-full !p-3 !text-sm"
                placeholder="Owner"
                value={form.owner_name}
                onChange={(e) =>
                  setForm({ ...form, owner_name: e.target.value })
                }
              />
              <input
                type="date"
                className="input w-full !p-3 !text-sm"
                value={form.target_date}
                onChange={(e) =>
                  setForm({ ...form, target_date: e.target.value })
                }
              />
              <input
                className="input w-full !p-3 !text-sm"
                placeholder="Budget"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
              />
              <select
                className="input w-full !p-3 !text-sm"
                value={form.customer_id}
                onChange={(e) =>
                  setForm({ ...form, customer_id: e.target.value })
                }
              >
                <option value="">Customer portal (optional)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Link a customer (e.g. Boxer) so this project appears on their
                guest portal. Both of you update the same waterfall tasks.
              </p>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.seed_waterfall}
                  onChange={(e) =>
                    setForm({ ...form, seed_waterfall: e.target.checked })
                  }
                />
                Seed starter waterfall tasks (recommended for portal collab)
              </label>
              <button
                type="button"
                onClick={() => void create()}
                className="btn-primary w-full !py-3"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </RelationshipPage>
  );
}
