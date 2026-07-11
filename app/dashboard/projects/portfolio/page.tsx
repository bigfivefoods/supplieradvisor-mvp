'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';

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
  task_stats?: { total: number; done: number };
  milestone_stats?: { total: number; done: number };
};

const healthClass: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-900',
  red: 'bg-red-100 text-red-800',
};

export default function PortfolioPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'planning',
    priority: 'medium',
    target_date: '',
    owner_name: '',
    budget: '',
  });

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/projects?${params}`);
      const json = await res.json();
      setProjects(json.projects || []);
      setWarning(json.warning || json.migration || null);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

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
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Failed');
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

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/projects"
        backLabel="Projects"
        eyebrow="Portfolio"
        title="All"
        titleAccent="initiatives"
        description="Strategic and operational projects in one portfolio."
        action={
          <button type="button" onClick={() => setShow(true)} className="btn-primary !py-2 !px-4 text-sm">
            <Plus className="w-4 h-4" /> New project
          </button>
        }
      />

      {warning && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Run migration 20260711_haccp_esg_pm_suite.sql if tables are missing.
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white border rounded-3xl p-16 text-center text-sm text-neutral-500">
          No projects yet. Create your first initiative.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div key={p.id} className="bg-white border rounded-3xl p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900">{p.name}</div>
                  {p.description && (
                    <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{p.description}</p>
                  )}
                </div>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    healthClass[p.health || 'green'] || healthClass.green
                  }`}
                >
                  {p.health || 'green'}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full"
                  style={{ width: `${Math.min(100, p.progress || 0)}%` }}
                />
              </div>
              <div className="text-[11px] text-neutral-500 flex flex-wrap gap-2">
                <span className="capitalize">{p.status}</span>
                <span>·</span>
                <span>{p.priority} priority</span>
                {p.target_date && (
                  <>
                    <span>·</span>
                    <span>due {p.target_date}</span>
                  </>
                )}
              </div>
              <div className="text-[11px] text-neutral-500">
                Tasks {p.task_stats?.done || 0}/{p.task_stats?.total || 0} · Milestones{' '}
                {p.milestone_stats?.done || 0}/{p.milestone_stats?.total || 0}
              </div>
              <select
                className="input !py-1.5 !text-xs"
                value={p.status || 'planning'}
                onChange={(e) => void setStatus(p.id, e.target.value)}
              >
                {['planning', 'active', 'on_hold', 'completed', 'cancelled'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {show && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl border p-6">
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
                className="input w-full !p-3 !text-sm min-h-[70px]"
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <input
                className="input w-full !p-3 !text-sm"
                placeholder="Owner"
                value={form.owner_name}
                onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
              />
              <input
                type="date"
                className="input w-full !p-3 !text-sm"
                value={form.target_date}
                onChange={(e) => setForm({ ...form, target_date: e.target.value })}
              />
              <input
                className="input w-full !p-3 !text-sm"
                placeholder="Budget"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
              />
              <button type="button" onClick={() => void create()} className="btn-primary w-full !py-3">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </RelationshipPage>
  );
}
