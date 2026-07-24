'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2, Plus, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import {
  RelationshipHeader,
  RelationshipPage,
  Panel,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  INITIATIVE_PILLARS,
  MIGRATION_HINT,
  healthBadge,
  statusBadge,
} from '@/lib/sustainability/types';
import { SDG_GOALS } from '@/lib/projects/sdg-catalog';

type Initiative = {
  id: number;
  title: string;
  description?: string | null;
  pillar?: string;
  status?: string;
  owner_name?: string | null;
  progress?: number | null;
  health?: string | null;
  sdg_goal?: number | null;
  target_date?: string | null;
  estimated_impact?: string | null;
};

export default function EsgInitiativesPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [rows, setRows] = useState<Initiative[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    in_progress: number;
    completed: number;
    planned: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    pillar: 'environment',
    owner_name: '',
    sdg_goal: '',
    target_date: '',
    estimated_impact: '',
    status: 'planned',
  });

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const p = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) p.set('privyUserId', privyUserId);
      const res = await fetch(`/api/sustainability/initiatives?${p}`);
      const json = await res.json();
      setRows(json.initiatives || []);
      setSummary(json.summary || null);
      setWarning(json.warning || json.hint || null);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!form.title.trim()) {
      toast.error('Title required');
      return;
    }
    const res = await fetch('/api/sustainability/initiatives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        privyUserId,
        ...form,
        sdg_goal: form.sdg_goal ? Number(form.sdg_goal) : null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || json.hint || 'Failed');
      return;
    }
    toast.success('Initiative created');
    setShow(false);
    setForm({
      title: '',
      description: '',
      pillar: 'environment',
      owner_name: '',
      sdg_goal: '',
      target_date: '',
      estimated_impact: '',
      status: 'planned',
    });
    await load();
  };

  const patch = async (id: number, body: Record<string, unknown>) => {
    await fetch('/api/sustainability/initiatives', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, privyUserId, id, ...body }),
    });
    await load();
  };

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/sustainability"
        backLabel="Sustainability"
        eyebrow="Action plans · E · S · G"
        title="ESG"
        titleAccent="initiatives"
        description="Turn material topics and targets into owned actions. Link to SDGs and optional Projects DMAIC work."
        action={
          <button
            type="button"
            onClick={() => setShow(true)}
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> New initiative
          </button>
        }
      />

      {warning && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {warning}
          <span className="mt-1 block font-mono text-xs">{MIGRATION_HINT}</span>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Total', v: summary?.total ?? 0 },
          { label: 'Planned', v: summary?.planned ?? 0 },
          { label: 'In progress', v: summary?.in_progress ?? 0 },
          { label: 'Completed', v: summary?.completed ?? 0 },
        ].map((c) => (
          <Panel key={c.label} className="p-3">
            <div className="text-[10px] font-bold uppercase text-neutral-400">
              {c.label}
            </div>
            <div className="text-2xl font-black">{c.v}</div>
          </Panel>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : rows.length === 0 ? (
        <Panel className="p-10 text-center">
          <Workflow className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="font-semibold">No initiatives yet</p>
          <p className="text-sm text-neutral-500 mt-1">
            Example: switch site electricity to renewable PPAs; supplier Code of
            Conduct rollout; packaging light-weighting pilot.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <Panel key={r.id} className="p-4">
              <div className="flex flex-wrap gap-1.5 mb-1">
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadge(r.status)}`}
                >
                  {r.status}
                </span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-neutral-50 text-neutral-600 border-neutral-200">
                  {r.pillar}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${healthBadge(r.health)}`}
                >
                  {r.health || 'green'}
                </span>
                {r.sdg_goal != null && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                    SDG {r.sdg_goal}
                  </span>
                )}
              </div>
              <h3 className="font-bold text-slate-900">{r.title}</h3>
              {r.description && (
                <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                  {r.description}
                </p>
              )}
              {r.estimated_impact && (
                <p className="text-xs text-emerald-800 mt-1 font-medium">
                  Impact: {r.estimated_impact}
                </p>
              )}
              <div className="mt-3">
                <div className="flex justify-between text-[10px] font-bold text-neutral-500 mb-1">
                  <span>Progress</span>
                  <span>{r.progress ?? 0}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${Math.min(100, r.progress || 0)}%` }}
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <select
                  className="input !py-1 !text-xs w-auto"
                  value={r.status || 'planned'}
                  onChange={(e) =>
                    void patch(r.id, {
                      status: e.target.value,
                      progress:
                        e.target.value === 'completed'
                          ? 100
                          : e.target.value === 'in_progress'
                            ? Math.max(r.progress || 10, 10)
                            : r.progress,
                    })
                  }
                >
                  {['planned', 'in_progress', 'completed', 'on_hold', 'cancelled'].map(
                    (s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    )
                  )}
                </select>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={r.progress || 0}
                  onChange={(e) =>
                    void patch(r.id, { progress: Number(e.target.value) })
                  }
                  className="flex-1 min-w-[80px]"
                />
                {r.owner_name && (
                  <span className="text-[11px] text-neutral-500">{r.owner_name}</span>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-neutral-500">
        Process-heavy work can become a{' '}
        <Link href="/dashboard/projects/dmaic" className="text-[#00b4d8] font-semibold">
          DMAIC project
        </Link>{' '}
        or{' '}
        <Link href="/dashboard/projects/sdg" className="text-emerald-700 font-semibold">
          SDG project
        </Link>
        .
      </p>

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg">New initiative</h3>
            <input
              className="input"
              placeholder="Title *"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <textarea
              className="input min-h-[64px]"
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
            <select
              className="input"
              value={form.pillar}
              onChange={(e) => setForm({ ...form, pillar: e.target.value })}
            >
              {INITIATIVE_PILLARS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={form.sdg_goal}
              onChange={(e) => setForm({ ...form, sdg_goal: e.target.value })}
            >
              <option value="">SDG (optional)</option>
              {SDG_GOALS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.id}. {g.name}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="Owner"
              value={form.owner_name}
              onChange={(e) =>
                setForm({ ...form, owner_name: e.target.value })
              }
            />
            <input
              className="input"
              type="date"
              value={form.target_date}
              onChange={(e) =>
                setForm({ ...form, target_date: e.target.value })
              }
            />
            <input
              className="input"
              placeholder="Estimated impact"
              value={form.estimated_impact}
              onChange={(e) =>
                setForm({ ...form, estimated_impact: e.target.value })
              }
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary !py-2 !px-4 text-sm"
                onClick={() => setShow(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary !py-2 !px-4 text-sm"
                onClick={() => void create()}
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
