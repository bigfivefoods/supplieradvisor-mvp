'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  RelationshipHeader,
  RelationshipPage,
  Panel,
} from '@/components/relationship/RelationshipChrome';
import { statusBadgeClass } from '@/lib/hr/types';

type Emp = { id: number; full_name: string; business_unit_id?: number | null };
type Case = {
  id: number;
  case_number?: string;
  employee_id: number;
  title: string;
  case_type?: string;
  severity?: string;
  status?: string;
  outcome?: string;
  raised_date?: string;
  incident_date?: string;
  description?: string;
};

const CASE_TYPES = [
  { value: 'misconduct', label: 'Misconduct' },
  { value: 'performance', label: 'Performance' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'policy', label: 'Policy breach' },
  { value: 'safety', label: 'Safety / SHEQ' },
  { value: 'other', label: 'Other' },
];

const SEVERITIES = [
  { value: 'verbal', label: 'Verbal warning' },
  { value: 'written', label: 'Written warning' },
  { value: 'final', label: 'Final written' },
  { value: 'suspension', label: 'Suspension' },
  { value: 'dismissal', label: 'Dismissal' },
];

const STATUSES = [
  'open',
  'investigation',
  'hearing',
  'sanction',
  'closed',
  'withdrawn',
];

const OUTCOMES = [
  { value: '', label: '— None yet —' },
  { value: 'counselling', label: 'Counselling' },
  { value: 'verbal_warning', label: 'Verbal warning' },
  { value: 'written_warning', label: 'Written warning' },
  { value: 'final_warning', label: 'Final warning' },
  { value: 'suspension', label: 'Suspension' },
  { value: 'dismissal', label: 'Dismissal' },
  { value: 'none', label: 'No sanction' },
];

export default function DisciplinaryPage() {
  const companyId = getSelectedCompanyId()!;
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<Case | null>(null);
  const [form, setForm] = useState({
    employee_id: '',
    title: '',
    case_type: 'misconduct',
    severity: 'verbal',
    description: '',
    incident_date: new Date().toISOString().slice(0, 10),
    related_policy: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs =
        filter === 'all'
          ? `companyId=${companyId}`
          : `companyId=${companyId}&status=${filter}`;
      const [cr, er] = await Promise.all([
        fetch(`/api/hr/disciplinary?${qs}`),
        fetch(`/api/hr/employees?companyId=${companyId}`),
      ]);
      const cj = await cr.json();
      const ej = await er.json();
      setCases(cj.cases || []);
      setEmployees(
        (ej.employees || []).map((e: Emp) => ({
          id: e.id,
          full_name: e.full_name,
          business_unit_id: e.business_unit_id,
        }))
      );
      if (cj.warning) toast.message(cj.warning, { description: cj.hint });
    } catch {
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const nameOf = (id: number) =>
    employees.find((e) => e.id === id)?.full_name || `#${id}`;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/hr/disciplinary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          employee_id: Number(form.employee_id),
          title: form.title,
          case_type: form.case_type,
          severity: form.severity,
          description: form.description,
          incident_date: form.incident_date,
          related_policy: form.related_policy || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Case ${data.case?.case_number || ''} opened`);
      setShow(false);
      setForm({
        employee_id: '',
        title: '',
        case_type: 'misconduct',
        severity: 'verbal',
        description: '',
        incident_date: new Date().toISOString().slice(0, 10),
        related_policy: '',
      });
      void load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function updateCase(
    id: number,
    patch: Record<string, unknown>
  ) {
    try {
      const res = await fetch('/api/hr/disciplinary', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, id, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Case updated');
      setEdit(null);
      void load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <RelationshipPage>
      <RelationshipHeader
        title="Disciplinary"
        titleAccent="process"
        description="Misconduct, performance, and safety cases — investigation, hearing, sanction, and close-out."
        action={
          <button
            type="button"
            onClick={() => setShow(true)}
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Open case
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {['all', ...STATUSES].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
              filter === s
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      <Panel>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
          </div>
        ) : cases.length === 0 ? (
          <div className="py-14 text-center">
            <Scale className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-neutral-500">
              No disciplinary cases. Fair process starts with a clear record.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {cases.map((c) => (
              <li
                key={c.id}
                className="py-4 flex flex-wrap items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400">
                      {c.case_number}
                    </span>
                    <span className="font-bold text-slate-900">{c.title}</span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {nameOf(c.employee_id)} · {c.case_type} · severity{' '}
                    {c.severity}
                    {c.incident_date ? ` · incident ${c.incident_date}` : ''}
                  </div>
                  {c.description && (
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                      {c.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadgeClass(c.status)}`}
                  >
                    {c.status}
                  </span>
                  {c.outcome && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50">
                      {c.outcome}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setEdit(c)}
                    className="text-xs font-bold text-[#00b4d8]"
                  >
                    Update
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <form
            onSubmit={create}
            className="bg-white rounded-3xl w-full max-w-lg p-5 space-y-3 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <h3 className="font-bold text-lg">Open disciplinary case</h3>
            <label className="block text-xs font-semibold">
              Employee *
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
                    {!e.business_unit_id ? ' (no BU)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold">
              Title *
              <input
                required
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Unauthorised absence 12–14 Mar"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-semibold">
                Type
                <select
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  value={form.case_type}
                  onChange={(e) =>
                    setForm({ ...form, case_type: e.target.value })
                  }
                >
                  {CASE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold">
                Severity
                <select
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  value={form.severity}
                  onChange={(e) =>
                    setForm({ ...form, severity: e.target.value })
                  }
                >
                  {SEVERITIES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-xs font-semibold">
              Incident date
              <input
                type="date"
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={form.incident_date}
                onChange={(e) =>
                  setForm({ ...form, incident_date: e.target.value })
                }
              />
            </label>
            <label className="block text-xs font-semibold">
              Description
              <textarea
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm min-h-[80px]"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            <label className="block text-xs font-semibold">
              Related policy
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={form.related_policy}
                onChange={(e) =>
                  setForm({ ...form, related_policy: e.target.value })
                }
                placeholder="Code of conduct §…"
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
                Open case
              </button>
            </div>
          </form>
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 space-y-3 shadow-xl">
            <h3 className="font-bold text-lg">Update case</h3>
            <p className="text-sm text-neutral-600">
              {edit.case_number} · {edit.title}
            </p>
            <label className="block text-xs font-semibold">
              Status
              <select
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                defaultValue={edit.status || 'open'}
                id="disc-status"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold">
              Outcome
              <select
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                defaultValue={edit.outcome || ''}
                id="disc-outcome"
              >
                {OUTCOMES.map((o) => (
                  <option key={o.value || 'none'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="btn-secondary !py-2 !px-3 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary !py-2 !px-4 text-sm"
                onClick={() => {
                  const status = (
                    document.getElementById('disc-status') as HTMLSelectElement
                  )?.value;
                  const outcome = (
                    document.getElementById(
                      'disc-outcome'
                    ) as HTMLSelectElement
                  )?.value;
                  void updateCase(edit.id, {
                    status,
                    outcome: outcome || null,
                  });
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </RelationshipPage>
  );
}
