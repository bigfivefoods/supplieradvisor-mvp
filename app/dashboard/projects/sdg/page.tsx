'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { Globe2, Loader2, Plus, Target } from 'lucide-react';
import { toast } from 'sonner';
import {
  RelationshipHeader,
  RelationshipPage,
  Panel,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { SDG_GOALS, getSdgGoal, sdgTargetOptions } from '@/lib/projects/sdg-catalog';
import {
  healthBadge,
  statusBadge,
  MIGRATION_HINT,
} from '@/lib/projects/types';

type Project = {
  id: number;
  name: string;
  status?: string;
  health?: string | null;
  methodology?: string | null;
  sdg_goal?: number | null;
  sdg_targets?: string[] | null;
  owner_name?: string | null;
  progress?: number | null;
  goal_statement?: string | null;
  open_riads?: number;
};

export default function SdgProjectsPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    sdg_goal: '12',
    sdg_targets: [] as string[],
    goal_statement: '',
    owner_name: '',
    hybrid: false,
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
      const res = await fetch(`/api/projects?${p}`);
      const json = await res.json();
      setWarning(json.warning || json.hint || null);
      const all: Project[] = json.projects || [];
      setProjects(
        all.filter(
          (x) =>
            x.methodology === 'sdg' ||
            x.methodology === 'hybrid' ||
            (x.sdg_goal != null && Number(x.sdg_goal) >= 1)
        )
      );
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const byGoal = useMemo(() => {
    const map: Record<number, Project[]> = {};
    for (const g of SDG_GOALS) map[g.id] = [];
    for (const p of projects) {
      const id = Number(p.sdg_goal);
      if (id >= 1 && id <= 17) {
        map[id] = map[id] || [];
        map[id].push(p);
      }
    }
    return map;
  }, [projects]);

  const coveredGoals = useMemo(
    () => SDG_GOALS.filter((g) => (byGoal[g.id] || []).length > 0).length,
    [byGoal]
  );

  const filtered = useMemo(() => {
    if (selectedGoal == null) return projects;
    return byGoal[selectedGoal] || [];
  }, [selectedGoal, projects, byGoal]);

  const toggleTarget = (code: string) => {
    setForm((f) => ({
      ...f,
      sdg_targets: f.sdg_targets.includes(code)
        ? f.sdg_targets.filter((c) => c !== code)
        : [...f.sdg_targets, code],
    }));
  };

  const create = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    const goal = Number(form.sdg_goal);
    if (!Number.isFinite(goal) || goal < 1 || goal > 17) {
      toast.error('Select an SDG goal (1–17)');
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
          methodology: form.hybrid ? 'hybrid' : 'sdg',
          project_type: 'sdg',
          methodology_gate: form.hybrid ? 'define' : null,
          status: 'active',
          sdg_goal: goal,
          sdg_targets: form.sdg_targets,
          goal_statement: form.goal_statement || null,
          owner_name: form.owner_name || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.hint || 'Failed');
      toast.success(`SDG ${goal} project created`);
      setShowNew(false);
      setForm({
        name: '',
        sdg_goal: String(goal),
        sdg_targets: [],
        goal_statement: '',
        owner_name: '',
        hybrid: false,
      });
      setSelectedGoal(goal);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const formGoal = getSdgGoal(Number(form.sdg_goal));
  const formTargets = sdgTargetOptions(Number(form.sdg_goal));

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/projects"
        backLabel="Projects"
        eyebrow="UN SDGs · Impact PMO"
        title="SDG"
        titleAccent="portfolio"
        description="Map initiatives to all 17 Sustainable Development Goals and their targets. Track coverage and outcomes."
        action={
          <button
            type="button"
            onClick={() => {
              if (selectedGoal) setForm((f) => ({ ...f, sdg_goal: String(selectedGoal) }));
              setShowNew(true);
            }}
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> New SDG project
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
        <Panel className="p-3">
          <div className="text-[10px] font-bold uppercase text-neutral-400">SDG projects</div>
          <div className="text-2xl font-black text-slate-900">{projects.length}</div>
        </Panel>
        <Panel className="p-3">
          <div className="text-[10px] font-bold uppercase text-neutral-400">Goals covered</div>
          <div className="text-2xl font-black text-emerald-700">
            {coveredGoals}
            <span className="text-sm font-medium text-neutral-400">/17</span>
          </div>
        </Panel>
        <Panel className="p-3">
          <div className="text-[10px] font-bold uppercase text-neutral-400">Coverage</div>
          <div className="text-2xl font-black text-[#00b4d8]">
            {Math.round((coveredGoals / 17) * 100)}%
          </div>
        </Panel>
        <Panel className="p-3">
          <div className="text-[10px] font-bold uppercase text-neutral-400">Active</div>
          <div className="text-2xl font-black text-violet-700">
            {projects.filter((p) => p.status === 'active' || p.status === 'planning').length}
          </div>
        </Panel>
      </div>

      <Panel className="p-3 sm:p-4 mb-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-[#00b4d8]" />
            17 goals
          </h2>
          {selectedGoal != null && (
            <button
              type="button"
              onClick={() => setSelectedGoal(null)}
              className="text-xs font-semibold text-[#00b4d8]"
            >
              Clear filter
            </button>
          )}
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-9 md:grid-cols-12 xl:grid-cols-[repeat(17,minmax(0,1fr))] gap-1.5">
          {SDG_GOALS.map((g) => {
            const count = (byGoal[g.id] || []).length;
            const active = selectedGoal === g.id;
            return (
              <button
                key={g.id}
                type="button"
                title={`SDG ${g.id}: ${g.name}`}
                onClick={() => setSelectedGoal(active ? null : g.id)}
                className={`relative aspect-square rounded-xl text-white font-black text-sm sm:text-base transition ring-offset-1 ${
                  active ? 'ring-2 ring-slate-900 scale-[1.03]' : 'hover:opacity-90'
                }`}
                style={{ backgroundColor: g.color }}
              >
                {g.id}
                {count > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-white text-[9px] font-black text-slate-900 flex items-center justify-center shadow">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {selectedGoal != null && (
          <div className="mt-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-3">
            {(() => {
              const g = getSdgGoal(selectedGoal)!;
              return (
                <>
                  <div className="flex items-start gap-3">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-black shrink-0"
                      style={{ backgroundColor: g.color }}
                    >
                      {g.id}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-slate-900">{g.name}</h3>
                      <p className="text-xs text-neutral-500">{g.short}</p>
                    </div>
                  </div>
                  <ul className="mt-3 grid sm:grid-cols-2 gap-1.5">
                    {g.targets.map((t) => (
                      <li
                        key={t.code}
                        className="text-[11px] text-slate-600 flex gap-1.5 items-start"
                      >
                        <span className="font-mono font-bold text-neutral-400 shrink-0">
                          {t.code}
                        </span>
                        <span>{t.title}</span>
                      </li>
                    ))}
                  </ul>
                </>
              );
            })()}
          </div>
        )}
      </Panel>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : filtered.length === 0 ? (
        <Panel className="p-10 text-center">
          <Target className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-800">
            {selectedGoal
              ? `No projects on SDG ${selectedGoal} yet`
              : 'No SDG projects yet'}
          </p>
          <p className="text-sm text-neutral-500 mt-1 max-w-md mx-auto">
            Align process improvement or impact work to UN targets. Hybrid projects
            also appear on the DMAIC board.
          </p>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="btn-primary !py-2 !px-4 text-sm mt-4"
          >
            Create SDG project
          </button>
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const g = getSdgGoal(p.sdg_goal);
            const targets = Array.isArray(p.sdg_targets) ? p.sdg_targets : [];
            return (
              <Panel key={p.id} className="p-4 min-w-0">
                <div className="flex items-start gap-3">
                  {g && (
                    <div
                      className="h-11 w-11 rounded-xl flex items-center justify-center text-white font-black shrink-0 text-lg"
                      style={{ backgroundColor: g.color }}
                    >
                      {g.id}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-1.5 mb-1">
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
                      {p.methodology === 'hybrid' && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-violet-50 text-violet-800 border-violet-200">
                          DMAIC + SDG
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 leading-snug">{p.name}</h3>
                    {g && (
                      <p className="text-xs text-neutral-500 mt-0.5">{g.name}</p>
                    )}
                  </div>
                </div>
                {p.goal_statement && (
                  <p className="mt-2 text-xs text-neutral-600 line-clamp-2">
                    {p.goal_statement}
                  </p>
                )}
                {targets.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {targets.map((t) => (
                      <span
                        key={t}
                        className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-neutral-100 text-neutral-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-neutral-500">
                  {p.owner_name && <span>{p.owner_name}</span>}
                  {(p.open_riads || 0) > 0 && (
                    <Link
                      href="/dashboard/projects/risk-register"
                      className="text-amber-700 font-semibold"
                    >
                      {p.open_riads} open RIAD
                    </Link>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-xl space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg">New SDG project</h3>
            <input
              className="input"
              placeholder="Project name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <div>
              <label className="text-[11px] font-bold uppercase text-neutral-400">
                Primary SDG
              </label>
              <select
                className="input mt-1"
                value={form.sdg_goal}
                onChange={(e) =>
                  setForm({
                    ...form,
                    sdg_goal: e.target.value,
                    sdg_targets: [],
                  })
                }
              >
                {SDG_GOALS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.id}. {g.name}
                  </option>
                ))}
              </select>
            </div>
            {formGoal && (
              <div>
                <label className="text-[11px] font-bold uppercase text-neutral-400">
                  Targets (sub-goals)
                </label>
                <div className="mt-1.5 max-h-40 overflow-y-auto space-y-1 rounded-xl border border-neutral-100 p-2">
                  {formTargets.map((t) => {
                    const on = form.sdg_targets.includes(t.code);
                    return (
                      <label
                        key={t.code}
                        className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs cursor-pointer ${
                          on ? 'bg-sky-50' : 'hover:bg-neutral-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={on}
                          onChange={() => toggleTarget(t.code)}
                        />
                        <span>
                          <span className="font-mono font-bold text-neutral-500">
                            {t.code}
                          </span>{' '}
                          {t.title}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <textarea
              className="input min-h-[64px]"
              placeholder="Impact goal / outcome statement"
              value={form.goal_statement}
              onChange={(e) =>
                setForm({ ...form, goal_statement: e.target.value })
              }
            />
            <input
              className="input"
              placeholder="Owner"
              value={form.owner_name}
              onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.hybrid}
                onChange={(e) => setForm({ ...form, hybrid: e.target.checked })}
              />
              Also run as DMAIC process improvement (hybrid)
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary !py-2 !px-4 text-sm"
                onClick={() => setShowNew(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                className="btn-primary !py-2 !px-4 text-sm"
                onClick={() => void create()}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </RelationshipPage>
  );
}
