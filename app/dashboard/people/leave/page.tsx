'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  RelationshipHeader,
  RelationshipPage,
  Panel,
} from '@/components/relationship/RelationshipChrome';
import { statusBadgeClass } from '@/lib/hr/types';

type Emp = { id: number; full_name: string };
type LeaveType = { id: number; code: string; name: string };
type LeaveReq = {
  id: number;
  employee_id: number;
  leave_type_code?: string;
  start_date: string;
  end_date: string;
  days: number;
  reason?: string;
  status: string;
};

export default function LeavePage() {
  const companyId = getSelectedCompanyId()!;
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [requests, setRequests] = useState<LeaveReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    employee_id: '',
    leave_type_id: '',
    leave_type_code: 'ANNUAL',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    reason: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lr, er] = await Promise.all([
        fetch(`/api/hr/leave?companyId=${companyId}`),
        fetch(`/api/hr/employees?companyId=${companyId}&status=active`),
      ]);
      const lj = await lr.json();
      const ej = await er.json();
      setTypes(lj.types || []);
      setRequests(lj.requests || []);
      setEmployees(
        (ej.employees || []).map((e: Emp & { full_name: string }) => ({
          id: e.id,
          full_name: e.full_name,
        }))
      );
      if (lj.warning) toast.message(lj.warning, { description: lj.hint });
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
      const t = types.find((x) => String(x.id) === form.leave_type_id);
      const res = await fetch('/api/hr/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          employee_id: Number(form.employee_id),
          leave_type_id: form.leave_type_id
            ? Number(form.leave_type_id)
            : null,
          leave_type_code: t?.code || form.leave_type_code,
          start_date: form.start_date,
          end_date: form.end_date,
          reason: form.reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Leave request submitted');
      setShow(false);
      void load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function setStatus(id: number, status: string) {
    try {
      const res = await fetch('/api/hr/leave', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Leave ${status}`);
      void load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  const nameOf = (id: number) =>
    employees.find((e) => e.id === id)?.full_name || `Employee #${id}`;

  return (
    <RelationshipPage>
      <RelationshipHeader
        title="Leave"
        titleAccent="management"
        description="Annual, sick, and family leave — request, approve, and keep balances current."
        action={
          <button
            type="button"
            onClick={() => setShow(true)}
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Request leave
          </button>
        }
      />

      <Panel>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
          </div>
        ) : requests.length === 0 ? (
          <p className="py-12 text-center text-sm text-neutral-500">
            No leave requests yet.
          </p>
        ) : (
          <ul className="divide-y">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <div className="font-semibold text-slate-900">
                    {nameOf(r.employee_id)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {r.leave_type_code || 'Leave'} · {r.start_date} → {r.end_date}{' '}
                    · {r.days} day(s)
                    {r.reason ? ` · ${r.reason}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadgeClass(r.status)}`}
                  >
                    {r.status}
                  </span>
                  {r.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => void setStatus(r.id, 'approved')}
                        className="p-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        title="Approve"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void setStatus(r.id, 'rejected')}
                        className="p-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50"
                        title="Reject"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
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
            className="bg-white rounded-3xl shadow-xl w-full max-w-md p-5 space-y-3"
          >
            <h3 className="font-bold text-lg">Request leave</h3>
            <label className="block text-xs font-semibold">
              Employee
              <select
                required
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={form.employee_id}
                onChange={(e) =>
                  setForm({ ...form, employee_id: e.target.value })
                }
              >
                <option value="">Select…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold">
              Type
              <select
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={form.leave_type_id}
                onChange={(e) =>
                  setForm({ ...form, leave_type_id: e.target.value })
                }
              >
                <option value="">Default annual</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} · {t.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-semibold">
                From
                <input
                  type="date"
                  required
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm({ ...form, start_date: e.target.value })
                  }
                />
              </label>
              <label className="block text-xs font-semibold">
                To
                <input
                  type="date"
                  required
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  value={form.end_date}
                  onChange={(e) =>
                    setForm({ ...form, end_date: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="block text-xs font-semibold">
              Reason
              <textarea
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm min-h-[60px]"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShow(false)}
                className="btn-secondary !py-2 !px-3 text-sm"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary !py-2 !px-4 text-sm">
                Submit
              </button>
            </div>
          </form>
        </div>
      )}
    </RelationshipPage>
  );
}
