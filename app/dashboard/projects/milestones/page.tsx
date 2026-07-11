'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';

export default function MilestonesPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [milestones, setMilestones] = useState<
    { id: number; title: string; due_date?: string; done?: boolean; project_id: number; pm_projects?: { name?: string } }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const p = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) p.set('privyUserId', privyUserId);
      const [pr, mr] = await Promise.all([
        fetch(`/api/projects?${p}`),
        fetch(`/api/projects/milestones?${p}`),
      ]);
      const pj = await pr.json();
      const mj = await mr.json();
      setProjects(pj.projects || []);
      setMilestones(mj.milestones || []);
      if (!projectId && (pj.projects || [])[0]) setProjectId(pj.projects[0].id);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!projectId || !title.trim()) {
      toast.error('Project and title required');
      return;
    }
    const res = await fetch('/api/projects/milestones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        privyUserId,
        project_id: projectId,
        title,
        due_date: due || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Failed');
      return;
    }
    setTitle('');
    setDue('');
    toast.success('Milestone added');
    await load();
  };

  const toggle = async (id: number, done: boolean) => {
    await fetch('/api/projects/milestones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, privyUserId, id, done: !done }),
    });
    await load();
  };

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/projects"
        backLabel="Projects"
        eyebrow="Stage gates"
        title="Milestones"
        titleAccent="live"
        description="Completion checkpoints across the portfolio."
      />

      <div className="bg-white border rounded-3xl p-4 mb-4 flex flex-wrap gap-2 items-end">
        <select
          className="input !py-2 !text-sm"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          className="input flex-1 min-w-[160px] !py-2 !text-sm"
          placeholder="Milestone title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="date"
          className="input !py-2 !text-sm"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
        <button type="button" onClick={() => void add()} className="btn-primary !py-2 !px-4 text-sm">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <ul className="bg-white border rounded-3xl divide-y">
          {milestones.length === 0 ? (
            <li className="p-12 text-center text-sm text-neutral-500">No milestones yet.</li>
          ) : (
            milestones.map((m) => (
              <li key={m.id} className="px-4 py-3 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={!!m.done}
                  onChange={() => void toggle(m.id, !!m.done)}
                  className="accent-[#00b4d8]"
                />
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-sm ${m.done ? 'line-through text-neutral-400' : ''}`}>
                    {m.title}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {(m.pm_projects as { name?: string } | undefined)?.name ||
                      `Project #${m.project_id}`}
                    {m.due_date ? ` · due ${m.due_date}` : ''}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </RelationshipPage>
  );
}
