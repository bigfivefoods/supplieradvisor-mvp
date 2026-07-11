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

export default function TimesheetsPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [entries, setEntries] = useState<
    { id: number; work_date: string; hours: number; user_name?: string; notes?: string; project_id?: number }[]
  >([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    project_id: '',
    work_date: new Date().toISOString().slice(0, 10),
    hours: '1',
    user_name: '',
    notes: '',
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
      const [pr, tr] = await Promise.all([
        fetch(`/api/projects?${p}`),
        fetch(`/api/projects/timesheets?${p}`),
      ]);
      const pj = await pr.json();
      const tj = await tr.json();
      setProjects(pj.projects || []);
      setEntries(tj.entries || []);
      setTotal(tj.total_hours || 0);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    const res = await fetch('/api/projects/timesheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        privyUserId,
        project_id: form.project_id ? Number(form.project_id) : null,
        work_date: form.work_date,
        hours: Number(form.hours),
        user_name: form.user_name || null,
        notes: form.notes || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Failed');
      return;
    }
    toast.success('Hours logged');
    setForm((f) => ({ ...f, hours: '1', notes: '' }));
    await load();
  };

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/projects"
        backLabel="Projects"
        eyebrow="Time tracking"
        title="Timesheets"
        titleAccent="live"
        description={`Total logged: ${total} hours`}
      />

      <div className="bg-white border rounded-3xl p-4 mb-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <select
          className="input !py-2 !text-sm"
          value={form.project_id}
          onChange={(e) => setForm({ ...form, project_id: e.target.value })}
        >
          <option value="">Project (optional)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="input !py-2 !text-sm"
          value={form.work_date}
          onChange={(e) => setForm({ ...form, work_date: e.target.value })}
        />
        <input
          className="input !py-2 !text-sm"
          type="number"
          min={0.25}
          step={0.25}
          placeholder="Hours"
          value={form.hours}
          onChange={(e) => setForm({ ...form, hours: e.target.value })}
        />
        <input
          className="input !py-2 !text-sm"
          placeholder="Person"
          value={form.user_name}
          onChange={(e) => setForm({ ...form, user_name: e.target.value })}
        />
        <button type="button" onClick={() => void add()} className="btn-primary !py-2 text-sm">
          <Plus className="w-4 h-4" /> Log hours
        </button>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <ul className="bg-white border rounded-3xl divide-y">
          {entries.length === 0 ? (
            <li className="p-12 text-center text-sm text-neutral-500">No entries yet.</li>
          ) : (
            entries.map((e) => (
              <li key={e.id} className="px-4 py-3 flex justify-between text-sm">
                <div>
                  <span className="font-semibold">{e.hours}h</span>
                  {e.user_name && <span className="text-neutral-500"> · {e.user_name}</span>}
                  {e.notes && <span className="text-neutral-400"> — {e.notes}</span>}
                </div>
                <span className="text-xs text-neutral-400">{e.work_date}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </RelationshipPage>
  );
}
