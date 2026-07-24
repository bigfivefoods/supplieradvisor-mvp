'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import {
  Loader2,
  Plus,
  GripVertical,
  AlertTriangle,
  Target,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  RelationshipHeader,
  RelationshipPage,
  Panel,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  DMAIC_GATES,
  DMAIC_GATE_CHECKLISTS,
  type DmaicGate,
  healthBadge,
  MIGRATION_HINT,
} from '@/lib/projects/types';

type Project = {
  id: number;
  name: string;
  methodology_gate?: string | null;
  methodology?: string | null;
  status?: string;
  health?: string | null;
  owner_name?: string | null;
  problem_statement?: string | null;
  goal_statement?: string | null;
  open_riads?: number;
  progress?: number | null;
};

export default function DmaicBoardPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [board, setBoard] = useState<Record<string, Project[]>>({});
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    problem_statement: '',
    goal_statement: '',
    owner_name: '',
  });

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const p = new URLSearchParams({
        companyId: String(companyId),
        board: 'dmaic',
        methodology: 'dmaic',
      });
      if (privyUserId) p.set('privyUserId', privyUserId);
      // Also load hybrid
      const res = await fetch(`/api/projects?${p}&board=dmaic`);
      const json = await res.json();
      // Fetch all and filter client-side so hybrid included
      const allP = new URLSearchParams({
        companyId: String(companyId),
        board: 'dmaic',
      });
      if (privyUserId) allP.set('privyUserId', privyUserId);
      const res2 = await fetch(`/api/projects?${allP}`);
      const json2 = await res2.json();
      setWarning(json2.warning || json2.hint || json.warning || null);
      if (json2.dmaicBoard) {
        setBoard(json2.dmaicBoard);
      } else {
        const empty: Record<string, Project[]> = {};
        for (const g of DMAIC_GATES) empty[g.key] = [];
        for (const proj of json2.projects || []) {
          if (proj.methodology !== 'dmaic' && proj.methodology !== 'hybrid')
            continue;
          const gate = String(proj.methodology_gate || 'define');
          if (!empty[gate]) empty[gate] = [];
          empty[gate].push(proj);
        }
        setBoard(empty);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const moveToGate = async (projectId: number, to_gate: DmaicGate) => {
    const res = await fetch('/api/projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        privyUserId,
        id: projectId,
        action: 'move_gate',
        methodology_gate: to_gate,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Gate move failed');
      return;
    }
    toast.success(`Moved to ${to_gate.toUpperCase()}`);
    await load();
  };

  const onDrop = async (gate: DmaicGate) => {
    if (dragId == null) return;
    await moveToGate(dragId, gate);
    setDragId(null);
  };

  const create = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
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
          methodology: 'dmaic',
          project_type: 'process_improvement',
          methodology_gate: 'define',
          status: 'active',
          problem_statement: form.problem_statement || null,
          goal_statement: form.goal_statement || null,
          owner_name: form.owner_name || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      toast.success('DMAIC project chartered in Define');
      setShowNew(false);
      setForm({
        name: '',
        problem_statement: '',
        goal_statement: '',
        owner_name: '',
      });
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/projects"
        backLabel="Projects"
        eyebrow="Lean Six Sigma · PMO"
        title="DMAIC"
        titleAccent="stage-gates"
        description="Process improvement projects flow Define → Measure → Analyze → Improve → Control. Drag a project card into the next gate."
        action={
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Charter DMAIC
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
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-6">
          {DMAIC_GATES.map((gate) => {
            const items = board[gate.key] || [];
            return (
              <div
                key={gate.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => void onDrop(gate.key)}
                className={`min-w-[240px] w-[240px] sm:min-w-[260px] sm:w-[260px] flex flex-col max-h-[75vh] rounded-2xl border-2 ${gate.color}`}
              >
                <div className="px-3 py-3 border-b border-black/5 bg-white/70 rounded-t-2xl">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white font-black text-sm shadow-sm">
                      {gate.short}
                    </span>
                    <div>
                      <div className="text-xs font-black uppercase tracking-wide">
                        {gate.label}
                      </div>
                      <div className="text-[10px] opacity-70">
                        {items.length} project{items.length === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-snug opacity-80">
                    {gate.desc}
                  </p>
                </div>
                <ul className="p-2 space-y-2 overflow-y-auto flex-1">
                  {items.map((p) => (
                    <li
                      key={p.id}
                      draggable
                      onDragStart={() => setDragId(p.id)}
                      onDragEnd={() => setDragId(null)}
                      className={`rounded-xl border border-white/80 bg-white p-3 shadow-sm cursor-grab active:cursor-grabbing ${
                        dragId === p.id ? 'opacity-60 ring-2 ring-[#00b4d8]' : ''
                      }`}
                    >
                      <div className="flex items-start gap-1.5">
                        <GripVertical className="w-3.5 h-3.5 text-neutral-300 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-slate-900 leading-snug">
                            {p.name}
                          </div>
                          {p.owner_name && (
                            <div className="text-[10px] text-neutral-500 mt-0.5">
                              {p.owner_name}
                            </div>
                          )}
                          {p.problem_statement && (
                            <p className="text-[10px] text-neutral-500 mt-1 line-clamp-2">
                              {p.problem_statement}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span
                              className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${healthBadge(p.health)}`}
                            >
                              {p.health || 'green'}
                            </span>
                            {(p.open_riads || 0) > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                {p.open_riads} RIAD
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {DMAIC_GATES.filter((g) => g.key !== gate.key).map(
                              (g) => (
                                <button
                                  key={g.key}
                                  type="button"
                                  onClick={() => void moveToGate(p.id, g.key)}
                                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md border border-neutral-200 bg-neutral-50 hover:bg-sky-50 hover:border-sky-200"
                                >
                                  → {g.short}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                  {items.length === 0 && (
                    <li className="text-[11px] text-center text-neutral-400 py-8 px-2">
                      Drop projects here
                    </li>
                  )}
                </ul>
                <details className="border-t border-black/5 bg-white/50 px-2 py-2 rounded-b-2xl">
                  <summary className="text-[10px] font-bold cursor-pointer text-neutral-600">
                    Gate checklist
                  </summary>
                  <ul className="mt-1 space-y-0.5 text-[10px] text-neutral-500">
                    {DMAIC_GATE_CHECKLISTS[gate.key].map((c) => (
                      <li key={c}>· {c}</li>
                    ))}
                  </ul>
                </details>
              </div>
            );
          })}
        </div>
      )}

      <Panel className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Target className="w-5 h-5 text-[#00b4d8] shrink-0 mt-0.5" />
          <div className="text-sm text-slate-600 leading-relaxed">
            <strong className="text-slate-900">How to use:</strong> Charter a
            DMAIC project (starts in Define). Drag the card to Measure when the
            Define checklist is met, and so on through Control. Attach RIAD items
            on the{' '}
            <Link
              href="/dashboard/projects/risk-register"
              className="text-[#00b4d8] font-semibold underline"
            >
              risk / RIAD register
            </Link>
            .
          </div>
        </div>
      </Panel>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-xl p-5 space-y-3">
            <h3 className="font-bold text-lg">Charter DMAIC project</h3>
            <input
              className="input"
              placeholder="Project name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <textarea
              className="input min-h-[72px]"
              placeholder="Problem statement (Y metric + baseline gap)"
              value={form.problem_statement}
              onChange={(e) =>
                setForm({ ...form, problem_statement: e.target.value })
              }
            />
            <textarea
              className="input min-h-[72px]"
              placeholder="Goal statement (SMART target)"
              value={form.goal_statement}
              onChange={(e) =>
                setForm({ ...form, goal_statement: e.target.value })
              }
            />
            <input
              className="input"
              placeholder="Black belt / owner"
              value={form.owner_name}
              onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
            />
            <div className="flex justify-end gap-2 pt-1">
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
