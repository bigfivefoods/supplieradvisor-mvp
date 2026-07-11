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

type Project = { id: number; name: string };
type Task = {
  id: number;
  title: string;
  column_key: string;
  priority?: string;
  assignee?: string | null;
  project_id: number;
};

const COLS = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
];

export default function KanbanPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [board, setBoard] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');

  const loadProjects = useCallback(async () => {
    if (!companyId) return;
    const params = new URLSearchParams({ companyId: String(companyId) });
    if (privyUserId) params.set('privyUserId', privyUserId);
    const res = await fetch(`/api/projects?${params}`);
    const json = await res.json();
    const list = json.projects || [];
    setProjects(list);
    if (!projectId && list[0]) setProjectId(list[0].id);
  }, [companyId, privyUserId, projectId]);

  const loadBoard = useCallback(async () => {
    if (!companyId || !projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        projectId: String(projectId),
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/projects/tasks?${params}`);
      const json = await res.json();
      setBoard(json.board || {});
    } finally {
      setLoading(false);
    }
  }, [companyId, projectId, privyUserId]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const addTask = async () => {
    if (!projectId || !title.trim()) return;
    const res = await fetch('/api/projects/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        privyUserId,
        project_id: projectId,
        title,
        column_key: 'backlog',
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Failed');
      return;
    }
    setTitle('');
    toast.success('Task added');
    await loadBoard();
  };

  const move = async (taskId: number, column_key: string) => {
    const res = await fetch('/api/projects/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, privyUserId, id: taskId, column_key }),
    });
    if (!res.ok) {
      const j = await res.json();
      toast.error(j.error || 'Failed');
      return;
    }
    await loadBoard();
  };

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/projects"
        backLabel="Projects"
        eyebrow="Kanban"
        title="Task"
        titleAccent="board"
        description="Drag-free board: move tasks between columns with one click."
      />

      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="text-xs font-medium">Project</label>
          <select
            className="input mt-1 !py-2 !text-sm min-w-[200px]"
            value={projectId || ''}
            onChange={(e) => setProjectId(Number(e.target.value))}
          >
            {projects.length === 0 && <option value="">No projects</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 flex-1 min-w-[200px]">
          <input
            className="input flex-1 !py-2 !text-sm"
            placeholder="New task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void addTask()}
          />
          <button type="button" onClick={() => void addTask()} className="btn-primary !py-2 !px-4 text-sm">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLS.map((col) => (
            <div
              key={col.key}
              className="min-w-[220px] w-[220px] bg-neutral-50 border rounded-2xl flex flex-col max-h-[70vh]"
            >
              <div className="px-3 py-2.5 font-bold text-xs uppercase tracking-wide text-neutral-600 border-b bg-white rounded-t-2xl">
                {col.label}{' '}
                <span className="text-neutral-400">({(board[col.key] || []).length})</span>
              </div>
              <ul className="p-2 space-y-2 overflow-y-auto flex-1">
                {(board[col.key] || []).map((t) => (
                  <li key={t.id} className="bg-white border rounded-xl p-3 shadow-sm">
                    <div className="text-sm font-semibold text-slate-900">{t.title}</div>
                    {t.assignee && (
                      <div className="text-[10px] text-neutral-500 mt-1">{t.assignee}</div>
                    )}
                    <select
                      className="mt-2 w-full text-[11px] border rounded-lg px-2 py-1"
                      value={t.column_key}
                      onChange={(e) => void move(t.id, e.target.value)}
                    >
                      {COLS.map((c) => (
                        <option key={c.key} value={c.key}>
                          → {c.label}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </RelationshipPage>
  );
}
