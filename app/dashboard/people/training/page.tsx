'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  RelationshipHeader,
  RelationshipPage,
  Panel,
} from '@/components/relationship/RelationshipChrome';
import { statusBadgeClass } from '@/lib/hr/types';

type Emp = { id: number; full_name: string };
type RecordRow = {
  id: number;
  employee_id?: number;
  course_name: string;
  provider?: string;
  status?: string;
  due_date?: string;
  completed_at?: string;
};

export default function TrainingPage() {
  const companyId = getSelectedCompanyId()!;
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    employee_id: '',
    course_name: '',
    provider: '',
    due_date: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tr, er] = await Promise.all([
        fetch(`/api/hr/training?companyId=${companyId}`),
        fetch(`/api/hr/employees?companyId=${companyId}`),
      ]);
      const tj = await tr.json();
      const ej = await er.json();
      setRecords(tj.records || []);
      setEmployees(
        (ej.employees || []).map((e: Emp) => ({
          id: e.id,
          full_name: e.full_name,
        }))
      );
    } catch {
      /* soft */
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/hr/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          employee_id: form.employee_id
            ? Number(form.employee_id)
            : null,
          course_name: form.course_name,
          provider: form.provider || null,
          due_date: form.due_date || null,
          status: 'assigned',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Training assigned');
      setShow(false);
      void load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function complete(id: number) {
    try {
      const res = await fetch('/api/hr/training', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          id,
          status: 'completed',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Marked complete');
      void load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  const nameOf = (id?: number) =>
    id
      ? employees.find((e) => e.id === id)?.full_name || `#${id}`
      : 'All / unassigned';

  return (
    <RelationshipPage>
      <RelationshipHeader
        title="Training"
        titleAccent="records"
        description="Assign courses, track due dates, and mark completion for compliance and skills."
        action={
          <button
            type="button"
            onClick={() => setShow(true)}
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Assign training
          </button>
        }
      />
      <Panel>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
          </div>
        ) : records.length === 0 ? (
          <p className="py-12 text-center text-sm text-neutral-500">
            No training records yet.
          </p>
        ) : (
          <ul className="divide-y">
            {records.map((r) => (
              <li
                key={r.id}
                className="py-3 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <div className="font-semibold">{r.course_name}</div>
                  <div className="text-xs text-neutral-500">
                    {nameOf(r.employee_id)}
                    {r.provider ? ` · ${r.provider}` : ''}
                    {r.due_date ? ` · due ${r.due_date}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadgeClass(r.status)}`}
                  >
                    {r.status}
                  </span>
                  {r.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => void complete(r.id)}
                      className="text-xs font-bold text-[#00b4d8]"
                    >
                      Complete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <form
            onSubmit={submit}
            className="bg-white rounded-3xl w-full max-w-md p-5 space-y-3 shadow-xl"
          >
            <h3 className="font-bold text-lg">Assign training</h3>
            <label className="block text-xs font-semibold">
              Course name *
              <input
                required
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={form.course_name}
                onChange={(e) =>
                  setForm({ ...form, course_name: e.target.value })
                }
              />
            </label>
            <label className="block text-xs font-semibold">
              Employee
              <select
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={form.employee_id}
                onChange={(e) =>
                  setForm({ ...form, employee_id: e.target.value })
                }
              >
                <option value="">Unassigned</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold">
              Provider
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={form.provider}
                onChange={(e) =>
                  setForm({ ...form, provider: e.target.value })
                }
              />
            </label>
            <label className="block text-xs font-semibold">
              Due date
              <input
                type="date"
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={form.due_date}
                onChange={(e) =>
                  setForm({ ...form, due_date: e.target.value })
                }
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShow(false)}
                className="btn-secondary !py-2 !px-3 text-sm"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary !py-2 !px-4 text-sm">
                Assign
              </button>
            </div>
          </form>
        </div>
      )}
    </RelationshipPage>
  );
}
