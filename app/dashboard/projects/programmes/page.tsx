'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2, Plus, Layers, FolderKanban } from 'lucide-react';
import { toast } from 'sonner';
import {
  RelationshipHeader,
  RelationshipPage,
  Panel,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  healthBadge,
  statusBadge,
  MIGRATION_HINT,
} from '@/lib/projects/types';
import { formatMoney } from '@/lib/accounting/types';

type Programme = {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  status?: string;
  health?: string | null;
  owner_name?: string | null;
  sponsor_name?: string | null;
  budget?: number | null;
  currency?: string | null;
  strategic_theme?: string | null;
  target_date?: string | null;
  project_stats?: { total: number; active: number };
};

export default function ProgrammesPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [rows, setRows] = useState<Programme[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    owner_name: '',
    sponsor_name: '',
    budget: '',
    strategic_theme: '',
    target_date: '',
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
      const res = await fetch(`/api/projects/programmes?${p}`);
      const json = await res.json();
      setRows(json.programmes || []);
      setWarning(json.warning || json.hint || null);
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
    const res = await fetch('/api/projects/programmes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        privyUserId,
        name: form.name,
        code: form.code || null,
        description: form.description || null,
        owner_name: form.owner_name || null,
        sponsor_name: form.sponsor_name || null,
        budget: form.budget ? Number(form.budget) : null,
        strategic_theme: form.strategic_theme || null,
        target_date: form.target_date || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || json.hint || 'Failed');
      return;
    }
    toast.success('Programme created');
    setShow(false);
    setForm({
      name: '',
      code: '',
      description: '',
      owner_name: '',
      sponsor_name: '',
      budget: '',
      strategic_theme: '',
      target_date: '',
    });
    await load();
  };

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/projects"
        backLabel="Projects"
        eyebrow="PMO · EPM"
        title="Programmes"
        titleAccent="portfolio"
        description="Group related projects under strategic programmes. Roll up budget, health, and delivery."
        action={
          <button
            type="button"
            onClick={() => setShow(true)}
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> New programme
          </button>
        }
      />

      {warning && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {warning}
          <span className="mt-1 block font-mono text-xs">{MIGRATION_HINT}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : rows.length === 0 ? (
        <Panel className="p-10 text-center">
          <Layers className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-800">No programmes yet</p>
          <p className="text-sm text-neutral-500 mt-1 max-w-md mx-auto">
            Create a programme (e.g. “Zero defects 2026”, “SDG 12 packaging”) then
            attach DMAIC and SDG projects from the portfolio.
          </p>
          <button
            type="button"
            onClick={() => setShow(true)}
            className="btn-primary !py-2 !px-4 text-sm mt-4"
          >
            Create first programme
          </button>
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <Panel key={r.id} className="p-5 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {r.code && (
                      <span className="font-mono text-[10px] text-neutral-400">
                        {r.code}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadge(r.status)}`}
                    >
                      {r.status}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${healthBadge(r.health)}`}
                    >
                      {r.health || 'green'}
                    </span>
                  </div>
                  <h3 className="mt-1 text-lg font-black text-slate-900">
                    {r.name}
                  </h3>
                  {r.strategic_theme && (
                    <p className="text-xs text-[#0077b6] font-semibold mt-0.5">
                      {r.strategic_theme}
                    </p>
                  )}
                  {r.description && (
                    <p className="text-sm text-neutral-600 mt-2 line-clamp-2">
                      {r.description}
                    </p>
                  )}
                </div>
                <Layers className="w-5 h-5 text-neutral-300 shrink-0" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-neutral-50 border border-neutral-100 px-3 py-2">
                  <div className="text-neutral-400 font-semibold uppercase text-[10px]">
                    Projects
                  </div>
                  <div className="font-black text-slate-900 text-lg">
                    {r.project_stats?.total ?? 0}
                    <span className="text-xs font-medium text-neutral-500 ml-1">
                      ({r.project_stats?.active ?? 0} active)
                    </span>
                  </div>
                </div>
                <div className="rounded-xl bg-neutral-50 border border-neutral-100 px-3 py-2">
                  <div className="text-neutral-400 font-semibold uppercase text-[10px]">
                    Budget
                  </div>
                  <div className="font-black text-slate-900 text-sm sa-metric-value-sm">
                    {r.budget != null
                      ? formatMoney(r.budget, r.currency || 'ZAR')
                      : '—'}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-neutral-500">
                {r.owner_name && <span>Owner: {r.owner_name}</span>}
                {r.sponsor_name && <span>· Sponsor: {r.sponsor_name}</span>}
                {r.target_date && <span>· Target {r.target_date}</span>}
              </div>
              <Link
                href={`/dashboard/projects/portfolio?programmeId=${r.id}`}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#00b4d8]"
              >
                <FolderKanban className="w-3.5 h-3.5" /> View projects
              </Link>
            </Panel>
          ))}
        </div>
      )}

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg">New programme</h3>
            <input
              className="input"
              placeholder="Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input"
                placeholder="Code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              <input
                className="input"
                type="date"
                value={form.target_date}
                onChange={(e) =>
                  setForm({ ...form, target_date: e.target.value })
                }
              />
            </div>
            <textarea
              className="input min-h-[64px]"
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
            <input
              className="input"
              placeholder="Strategic theme"
              value={form.strategic_theme}
              onChange={(e) =>
                setForm({ ...form, strategic_theme: e.target.value })
              }
            />
            <div className="grid grid-cols-2 gap-2">
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
                placeholder="Sponsor"
                value={form.sponsor_name}
                onChange={(e) =>
                  setForm({ ...form, sponsor_name: e.target.value })
                }
              />
            </div>
            <input
              className="input"
              type="number"
              placeholder="Budget"
              value={form.budget}
              onChange={(e) => setForm({ ...form, budget: e.target.value })}
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
