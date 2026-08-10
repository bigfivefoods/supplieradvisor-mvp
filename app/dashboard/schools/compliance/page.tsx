'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

export default function CompliancePage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('hygiene');
  const [body, setBody] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/schools/compliance?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setEvents(data.events || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!title.trim()) return toast.error('Title required');
    try {
      const res = await fetch('/api/schools/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, title, kind, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Compliance event logged');
      setTitle('');
      setBody('');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const close = async (id: number) => {
    const res = await fetch('/api/schools/compliance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, id, status: 'closed' }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || 'Failed');
    void load();
  };

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Compliance"
        titleAccent="Evidence"
        description="Hygiene checks, training, incidents, monitor visits, and document evidence."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2 !px-3 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        }
      />

      <div className="mb-6 rounded-3xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/50 p-5 space-y-3">
        <div className="grid sm:grid-cols-3 gap-2">
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="hygiene">Hygiene</option>
            <option value="training">Training</option>
            <option value="incident">Incident</option>
            <option value="document">Document</option>
            <option value="monitor_visit">Monitor visit</option>
          </select>
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <textarea
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          rows={2}
          placeholder="Notes / evidence summary"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          type="button"
          onClick={() => void add()}
          className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Log event
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li
              key={String(e.id)}
              className="rounded-2xl border border-emerald-200 bg-white dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40 px-4 py-3 flex flex-wrap justify-between gap-2"
            >
              <div>
                <p className="font-bold text-sm">{String(e.title)}</p>
                <p className="text-[10px] uppercase font-bold text-slate-400">
                  {String(e.kind)} · {String(e.status)} ·{' '}
                  {String(e.event_date || '')}
                </p>
                {e.body ? (
                  <p className="text-xs text-slate-600 mt-1">{String(e.body)}</p>
                ) : null}
              </div>
              {String(e.status) !== 'closed' ? (
                <button
                  type="button"
                  onClick={() => void close(Number(e.id))}
                  className="btn-secondary !py-1 !px-2 text-[11px]"
                >
                  Close
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </SchoolsPage>
  );
}
