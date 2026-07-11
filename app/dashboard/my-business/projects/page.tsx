'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  BusinessHeader,
  BusinessPage,
} from '@/components/business/BusinessShell';
import { Panel } from '@/components/relationship/RelationshipChrome';

type Milestone = {
  id: string;
  title: string;
  done: boolean;
  due_date?: string | null;
};

type Project = {
  id: number;
  title: string;
  description?: string | null;
  status?: string | null;
  progress?: number | null;
  target_date?: string | null;
  created_at?: string;
  milestones?: Milestone[] | null;
  metadata?: Record<string, unknown> | null;
};

const STATUSES = ['Planning', 'In Progress', 'Completed', 'On Hold'] as const;

function milestonesOf(p: Project): Milestone[] {
  if (Array.isArray(p.milestones)) return p.milestones;
  const meta = p.metadata;
  if (meta && Array.isArray(meta.milestones)) return meta.milestones as Milestone[];
  return [];
}

function progressFromMilestones(ms: Milestone[]): number {
  if (!ms.length) return 0;
  const done = ms.filter((m) => m.done).length;
  return Math.round((done / ms.length) * 100);
}

export default function BusinessProjectsPage() {
  return (
    <CompanyRequired>
      <ProjectsInner />
    </CompanyRequired>
  );
}

function ProjectsInner() {
  const companyId = getSelectedCompanyId()!;
  const supabase = createClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'Planning',
    target_date: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('company_projects')
        .select('*')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false });
      if (error) {
        // Fallback: metadata.projects on profile
        const { data: prof } = await supabase
          .from('profiles')
          .select('metadata')
          .eq('id', companyId)
          .maybeSingle();
        const meta = prof?.metadata as { projects?: Project[] } | null;
        setProjects(Array.isArray(meta?.projects) ? meta!.projects! : []);
        if (error.message && !error.message.includes('does not exist')) {
          toast.message(error.message);
        }
      } else {
        setProjects(data || []);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!form.title.trim()) {
      toast.error('Title required');
      return;
    }
    setSaving(true);
    try {
      const row = {
        profile_id: companyId,
        title: form.title.trim(),
        description: form.description || null,
        status: form.status,
        progress: 0,
        target_date: form.target_date || null,
      };
      const { data, error } = await supabase
        .from('company_projects')
        .insert(row)
        .select('*')
        .single();

      if (error) {
        // metadata fallback
        const next: Project = {
          id: Date.now(),
          title: row.title,
          description: row.description,
          status: row.status,
          progress: 0,
          target_date: row.target_date || undefined,
          created_at: new Date().toISOString(),
        };
        const { data: prof } = await supabase
          .from('profiles')
          .select('metadata')
          .eq('id', companyId)
          .maybeSingle();
        const meta =
          prof?.metadata && typeof prof.metadata === 'object'
            ? { ...(prof.metadata as object) }
            : {};
        const existing = Array.isArray((meta as { projects?: Project[] }).projects)
          ? (meta as { projects: Project[] }).projects
          : [];
        const projects = [next, ...existing];
        (meta as { projects: Project[] }).projects = projects;
        const { error: uErr } = await supabase
          .from('profiles')
          .update({ metadata: meta, updated_at: new Date().toISOString() })
          .eq('id', companyId);
        if (uErr) throw uErr;
        setProjects(projects);
        toast.success('Project saved (profile metadata)');
      } else {
        setProjects((prev) => [data as Project, ...prev]);
        toast.success('Project created');
      }
      setForm({ title: '', description: '', status: 'Planning', target_date: '' });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const persistProjects = async (next: Project[]) => {
    const { error } = await supabase
      .from('company_projects')
      .select('id')
      .eq('profile_id', companyId)
      .limit(1);
    // Always mirror into profile metadata as durable fallback
    const { data: prof } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', companyId)
      .maybeSingle();
    const meta =
      prof?.metadata && typeof prof.metadata === 'object'
        ? { ...(prof.metadata as object) }
        : {};
    (meta as { projects: Project[] }).projects = next;
    await supabase
      .from('profiles')
      .update({ metadata: meta, updated_at: new Date().toISOString() })
      .eq('id', companyId);
    void error;
    setProjects(next);
  };

  const setStatus = async (id: number, status: string) => {
    const next = projects.map((p) => (p.id === id ? { ...p, status } : p));
    const { error } = await supabase
      .from('company_projects')
      .update({ status })
      .eq('id', id)
      .eq('profile_id', companyId);
    if (error) {
      await persistProjects(next);
    } else {
      setProjects(next);
      await persistProjects(next);
    }
    toast.success('Status updated');
  };

  const addMilestone = async (projectId: number, title: string) => {
    const t = title.trim();
    if (!t) return;
    const next = projects.map((p) => {
      if (p.id !== projectId) return p;
      const ms = [
        ...milestonesOf(p),
        { id: `m-${Date.now()}`, title: t, done: false },
      ];
      return {
        ...p,
        milestones: ms,
        progress: progressFromMilestones(ms),
        metadata: { ...(p.metadata || {}), milestones: ms },
      };
    });
    for (const p of next) {
      if (p.id !== projectId) continue;
      await supabase
        .from('company_projects')
        .update({
          progress: p.progress,
          metadata: p.metadata,
          milestones: p.milestones,
        })
        .eq('id', p.id)
        .eq('profile_id', companyId);
    }
    await persistProjects(next);
    toast.success('Milestone added');
  };

  const toggleMilestone = async (projectId: number, milestoneId: string) => {
    const next = projects.map((p) => {
      if (p.id !== projectId) return p;
      const ms = milestonesOf(p).map((m) =>
        m.id === milestoneId ? { ...m, done: !m.done } : m
      );
      return {
        ...p,
        milestones: ms,
        progress: progressFromMilestones(ms),
        metadata: { ...(p.metadata || {}), milestones: ms },
      };
    });
    for (const p of next) {
      if (p.id !== projectId) continue;
      await supabase
        .from('company_projects')
        .update({
          progress: p.progress,
          metadata: p.metadata,
          milestones: p.milestones,
          status:
            (p.progress || 0) >= 100
              ? 'Completed'
              : (p.progress || 0) > 0
                ? 'In Progress'
                : p.status,
        })
        .eq('id', p.id)
        .eq('profile_id', companyId);
    }
    await persistProjects(next);
  };

  return (
    <BusinessPage>
      <BusinessHeader
        title="Strategic"
        titleAccent="projects"
        description="Lite project workspace with milestones — company_projects when available, otherwise profile metadata. Full PM suite stays on the roadmap."
      />

      <div className="grid lg:grid-cols-5 gap-4">
        <Panel title="New project" className="lg:col-span-2">
          <div className="p-5 space-y-3">
            <input
              className="input w-full !p-3 !text-sm"
              placeholder="Title *"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <textarea
              className="input w-full !p-3 !text-sm min-h-[70px]"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <select
              className="input w-full !p-3 !text-sm"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="input w-full !p-3 !text-sm"
              value={form.target_date}
              onChange={(e) => setForm({ ...form, target_date: e.target.value })}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void add()}
              className="btn-primary w-full !py-3 text-sm"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Create project
                </>
              )}
            </button>
          </div>
        </Panel>

        <Panel title="Active work" className="lg:col-span-3">
          {loading ? (
            <div className="p-16 flex justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
            </div>
          ) : projects.length === 0 ? (
            <div className="p-12 text-center text-sm text-neutral-500">No projects yet.</div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {projects.map((p) => {
                const ms = milestonesOf(p);
                const pct = p.progress ?? progressFromMilestones(ms);
                return (
                  <li key={p.id} className="px-5 py-4 space-y-3">
                    <div className="flex flex-wrap justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{p.title}</div>
                        {p.description && (
                          <div className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                            {p.description}
                          </div>
                        )}
                        {p.target_date && (
                          <div className="text-[11px] text-neutral-400 mt-1">
                            Target {p.target_date}
                          </div>
                        )}
                      </div>
                      <select
                        className="input !py-1.5 !text-xs !w-auto h-fit"
                        value={p.status || 'Planning'}
                        onChange={(e) => void setStatus(p.id, e.target.value)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className="h-full bg-[#00b4d8] rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-neutral-500">{pct}% · {ms.length} milestones</div>
                    <ul className="space-y-1.5">
                      {ms.map((m) => (
                        <li key={m.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={m.done}
                            onChange={() => void toggleMilestone(p.id, m.id)}
                            className="rounded accent-[#00b4d8]"
                          />
                          <span className={m.done ? 'line-through text-neutral-400' : ''}>
                            {m.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        const title = String(fd.get('m') || '');
                        void addMilestone(p.id, title);
                        e.currentTarget.reset();
                      }}
                    >
                      <input
                        name="m"
                        className="input flex-1 !py-1.5 !text-xs"
                        placeholder="Add milestone…"
                      />
                      <button type="submit" className="btn-secondary !py-1.5 !px-3 text-xs">
                        Add
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </BusinessPage>
  );
}
