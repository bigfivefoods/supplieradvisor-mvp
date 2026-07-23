'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Loader2,
  Plus,
  Search,
  X,
  Building2,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  RelationshipHeader,
  RelationshipPage,
  Panel,
} from '@/components/relationship/RelationshipChrome';
import {
  EMPLOYMENT_TYPES,
  EMPLOYEE_STATUSES,
  PAY_FREQUENCIES,
  statusBadgeClass,
  type HrEmployee,
} from '@/lib/hr/types';
import { formatMoney } from '@/lib/accounting/types';

type CostOpt = { id: number; code?: string | null; name: string };

const emptyForm = {
  first_name: '',
  last_name: '',
  full_name: '',
  email: '',
  phone: '',
  mobile: '',
  job_title: '',
  department: '',
  employment_type: 'full_time',
  status: 'active',
  start_date: new Date().toISOString().slice(0, 10),
  id_number: '',
  tax_number: '',
  salary_basic: '',
  salary_currency: 'ZAR',
  pay_frequency: 'monthly',
  hourly_rate: '',
  bank_name: '',
  bank_account_number: '',
  bank_branch_code: '',
  business_unit_id: '',
  work_center_id: '',
  work_station_id: '',
  asset_id: '',
  leave_balance_days: '15',
  sick_balance_days: '10',
  notes: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
};

function DirectoryInner() {
  const companyId = getSelectedCompanyId()!;
  const searchParams = useSearchParams();
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [showForm, setShowForm] = useState(
    searchParams.get('new') === '1' || searchParams.get('allocate') === '1'
  );
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    ...emptyForm,
    manager_id: '',
  });
  const [editId, setEditId] = useState<number | null>(null);
  const [bus, setBus] = useState<CostOpt[]>([]);
  const [wcs, setWcs] = useState<CostOpt[]>([]);
  const [wss, setWss] = useState<CostOpt[]>([]);
  const [assets, setAssets] = useState<CostOpt[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (status !== 'all') params.set('status', status);
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/hr/employees?${params}`);
      const data = await res.json();
      setEmployees(data.employees || []);
      if (data.warning) toast.message(data.warning, { description: data.hint });
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, status, q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!companyId) return;
    const qs = `companyId=${companyId}`;
    void (async () => {
      try {
        const [buR, wcR, wsR, asR] = await Promise.all([
          fetch(`/api/manufacturing/business-units?${qs}`),
          fetch(`/api/manufacturing/work-centers?${qs}`),
          fetch(`/api/manufacturing/work-stations?${qs}`),
          fetch(`/api/manufacturing/assets?${qs}`),
        ]);
        const [buJ, wcJ, wsJ, asJ] = await Promise.all([
          buR.json(),
          wcR.json(),
          wsR.json(),
          asR.json(),
        ]);
        const map = (rows: Array<Record<string, unknown>> = []) =>
          rows
            .map((r) => ({
              id: Number(r.id),
              code: r.code != null ? String(r.code) : null,
              name: String(r.name || r.code || `#${r.id}`),
            }))
            .filter((o) => o.id > 0);
        setBus(map(buJ.businessUnits));
        setWcs(map(wcJ.workCenters));
        setWss(map(wsJ.workStations));
        setAssets(map(asJ.assets));
      } catch {
        /* soft */
      }
    })();
  }, [companyId]);

  const filtered = useMemo(() => employees, [employees]);

  function openNew() {
    setEditId(null);
    setForm({ ...emptyForm, manager_id: '' });
    setShowForm(true);
  }

  function openEdit(e: HrEmployee) {
    setEditId(e.id);
    setForm({
      first_name: e.first_name || '',
      last_name: e.last_name || '',
      full_name: e.full_name || '',
      email: e.email || '',
      phone: e.phone || '',
      mobile: e.mobile || '',
      job_title: e.job_title || '',
      department: e.department || '',
      employment_type: e.employment_type || 'full_time',
      status: e.status || 'active',
      start_date: e.start_date || '',
      id_number: (e as { id_number?: string }).id_number || '',
      tax_number: e.tax_number || '',
      salary_basic: e.salary_basic != null ? String(e.salary_basic) : '',
      salary_currency: e.salary_currency || 'ZAR',
      pay_frequency: e.pay_frequency || 'monthly',
      hourly_rate: e.hourly_rate != null ? String(e.hourly_rate) : '',
      bank_name: e.bank_name || '',
      bank_account_number: e.bank_account_number || '',
      bank_branch_code: e.bank_branch_code || '',
      business_unit_id: e.business_unit_id ? String(e.business_unit_id) : '',
      work_center_id: e.work_center_id ? String(e.work_center_id) : '',
      work_station_id: e.work_station_id ? String(e.work_station_id) : '',
      asset_id: e.asset_id ? String(e.asset_id) : '',
      leave_balance_days:
        e.leave_balance_days != null ? String(e.leave_balance_days) : '15',
      sick_balance_days:
        e.sick_balance_days != null ? String(e.sick_balance_days) : '10',
      notes: e.notes || '',
      emergency_contact_name:
        (e as { emergency_contact_name?: string }).emergency_contact_name || '',
      emergency_contact_phone:
        (e as { emergency_contact_phone?: string }).emergency_contact_phone ||
        '',
      manager_id: e.manager_id ? String(e.manager_id) : '',
    });
    setShowForm(true);
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.business_unit_id) {
      toast.error('Business unit is required — allocate every person to a BU');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        companyId,
        ...form,
        salary_basic: Number(form.salary_basic || 0),
        hourly_rate: Number(form.hourly_rate || 0),
        leave_balance_days: Number(form.leave_balance_days || 0),
        sick_balance_days: Number(form.sick_balance_days || 0),
        business_unit_id: form.business_unit_id
          ? Number(form.business_unit_id)
          : null,
        work_center_id: form.work_center_id
          ? Number(form.work_center_id)
          : null,
        work_station_id: form.work_station_id
          ? Number(form.work_station_id)
          : null,
        asset_id: form.asset_id ? Number(form.asset_id) : null,
        manager_id: form.manager_id ? Number(form.manager_id) : null,
        full_name:
          form.full_name ||
          [form.first_name, form.last_name].filter(Boolean).join(' '),
      };
      const res = await fetch('/api/hr/employees', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editId ? { ...payload, id: editId } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success(editId ? 'Employee updated' : 'Employee added');
      setShowForm(false);
      setEditId(null);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function terminate(id: number) {
    if (!confirm('Mark this employee as terminated?')) return;
    try {
      const res = await fetch(
        `/api/hr/employees?companyId=${companyId}&id=${id}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Employee terminated');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  function labelCost(
    list: CostOpt[],
    id?: number | null
  ): string | null {
    if (!id) return null;
    const o = list.find((x) => x.id === Number(id));
    return o ? `${o.code ? o.code + ' · ' : ''}${o.name}` : `#${id}`;
  }

  return (
    <RelationshipPage>
      <RelationshipHeader
        title="Employee"
        titleAccent="directory"
        description="Full HR master data — personal details, job, banking, tax, and cost-centre placement."
        action={
          <button
            type="button"
            onClick={openNew}
            className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add employee
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input !pl-9 w-full !py-2.5 !text-sm"
            placeholder="Search name, email, title…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load()}
          />
        </div>
        <select
          className="input !py-2.5 !text-sm max-w-[160px]"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          {EMPLOYEE_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="btn-secondary !py-2.5 !px-4 text-sm"
        >
          Refresh
        </button>
        <Link
          href="/dashboard/manufacturing/cost-centres"
          className="text-xs font-semibold text-[#00b4d8] underline"
        >
          Cost centres
        </Link>
      </div>

      <Panel>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <UserPlus className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-neutral-500 mb-4">
              No employees yet. Add your first team member to allocate labour
              costs and run payroll.
            </p>
            <button type="button" onClick={openNew} className="btn-primary !py-2 !px-4 text-sm">
              Add employee
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                  <th className="px-4 py-3 font-semibold">Employee</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Cost centre</th>
                  <th className="px-4 py-3 font-semibold text-right">Pay</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-neutral-50/80">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {e.full_name}
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        {e.employee_number || `#${e.id}`}
                        {e.email ? ` · ${e.email}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      <div>{e.job_title || '—'}</div>
                      <div className="text-[11px] text-neutral-400">
                        {e.department || e.employment_type}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-600">
                      {labelCost(bus, e.business_unit_id) ||
                      labelCost(wcs, e.work_center_id) ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 text-violet-900 px-2 py-0.5 font-medium">
                          <Building2 className="w-3 h-3" />
                          {labelCost(bus, e.business_unit_id) ||
                            labelCost(wcs, e.work_center_id)}
                        </span>
                      ) : (
                        <span className="text-amber-700 text-[11px] font-medium">
                          Unallocated
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {formatMoney(Number(e.salary_basic || 0))}
                      <div className="text-[10px] font-normal text-neutral-400">
                        {e.pay_frequency || 'monthly'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusBadgeClass(e.status)}`}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(e)}
                        className="text-xs font-bold text-[#00b4d8] mr-3"
                      >
                        Edit
                      </button>
                      {e.status !== 'terminated' && (
                        <button
                          type="button"
                          onClick={() => void terminate(e.id)}
                          className="text-xs font-bold text-rose-600"
                        >
                          End
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white z-10">
              <h3 className="font-bold">
                {editId ? 'Edit employee' : 'Add employee'}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={save} className="p-5 space-y-5">
              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Identity
                </h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold text-neutral-600">
                    First name
                    <input
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={form.first_name}
                      onChange={(e) =>
                        setForm({ ...form, first_name: e.target.value })
                      }
                    />
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">
                    Last name
                    <input
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={form.last_name}
                      onChange={(e) =>
                        setForm({ ...form, last_name: e.target.value })
                      }
                    />
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600 sm:col-span-2">
                    Full name *
                    <input
                      required
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={form.full_name}
                      onChange={(e) =>
                        setForm({ ...form, full_name: e.target.value })
                      }
                      placeholder="Or derived from first + last"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">
                    Email
                    <input
                      type="email"
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">
                    Mobile
                    <input
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={form.mobile || form.phone}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          mobile: e.target.value,
                          phone: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">
                    ID number
                    <input
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={form.id_number}
                      onChange={(e) =>
                        setForm({ ...form, id_number: e.target.value })
                      }
                    />
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">
                    Tax number
                    <input
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={form.tax_number}
                      onChange={(e) =>
                        setForm({ ...form, tax_number: e.target.value })
                      }
                    />
                  </label>
                </div>
              </section>

              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Job
                </h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold text-neutral-600">
                    Job title
                    <input
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={form.job_title}
                      onChange={(e) =>
                        setForm({ ...form, job_title: e.target.value })
                      }
                    />
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">
                    Department
                    <input
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={form.department}
                      onChange={(e) =>
                        setForm({ ...form, department: e.target.value })
                      }
                    />
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">
                    Employment type
                    <select
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm bg-white"
                      value={form.employment_type}
                      onChange={(e) =>
                        setForm({ ...form, employment_type: e.target.value })
                      }
                    >
                      {EMPLOYMENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">
                    Status
                    <select
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm bg-white"
                      value={form.status}
                      onChange={(e) =>
                        setForm({ ...form, status: e.target.value })
                      }
                    >
                      {EMPLOYEE_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">
                    Start date
                    <input
                      type="date"
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={form.start_date}
                      onChange={(e) =>
                        setForm({ ...form, start_date: e.target.value })
                      }
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-violet-800 mb-2">
                  Organisation & cost allocation
                </h4>
                <p className="text-[11px] text-violet-900/70 mb-3">
                  <strong>Business unit is required.</strong> Set who they report
                  to for the organogram. Work centre / station / asset refine
                  cost placement.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold text-violet-950 sm:col-span-2">
                    Reports to (manager)
                    <select
                      className="mt-1 w-full rounded-xl border border-violet-100 bg-white px-3 py-2 text-sm"
                      value={form.manager_id}
                      onChange={(e) =>
                        setForm({ ...form, manager_id: e.target.value })
                      }
                    >
                      <option value="">— Top of tree / no manager —</option>
                      {employees
                        .filter((e) => e.id !== editId)
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.full_name}
                            {e.job_title ? ` · ${e.job_title}` : ''}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-violet-950">
                    Business unit *
                    <select
                      required
                      className="mt-1 w-full rounded-xl border border-violet-100 bg-white px-3 py-2 text-sm"
                      value={form.business_unit_id}
                      onChange={(e) =>
                        setForm({ ...form, business_unit_id: e.target.value })
                      }
                    >
                      <option value="">— Select BU —</option>
                      {bus.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.code ? `${o.code} · ` : ''}
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-violet-950">
                    Work centre
                    <select
                      className="mt-1 w-full rounded-xl border border-violet-100 bg-white px-3 py-2 text-sm"
                      value={form.work_center_id}
                      onChange={(e) =>
                        setForm({ ...form, work_center_id: e.target.value })
                      }
                    >
                      <option value="">— None —</option>
                      {wcs.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.code ? `${o.code} · ` : ''}
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-violet-950">
                    Work station
                    <select
                      className="mt-1 w-full rounded-xl border border-violet-100 bg-white px-3 py-2 text-sm"
                      value={form.work_station_id}
                      onChange={(e) =>
                        setForm({ ...form, work_station_id: e.target.value })
                      }
                    >
                      <option value="">— None —</option>
                      {wss.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.code ? `${o.code} · ` : ''}
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-violet-950">
                    Asset
                    <select
                      className="mt-1 w-full rounded-xl border border-violet-100 bg-white px-3 py-2 text-sm"
                      value={form.asset_id}
                      onChange={(e) =>
                        setForm({ ...form, asset_id: e.target.value })
                      }
                    >
                      <option value="">— None —</option>
                      {assets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.code ? `${o.code} · ` : ''}
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Compensation & bank
                </h4>
                <div className="grid sm:grid-cols-3 gap-3">
                  <label className="block text-xs font-semibold text-neutral-600">
                    Basic salary
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={form.salary_basic}
                      onChange={(e) =>
                        setForm({ ...form, salary_basic: e.target.value })
                      }
                    />
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">
                    Frequency
                    <select
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm bg-white"
                      value={form.pay_frequency}
                      onChange={(e) =>
                        setForm({ ...form, pay_frequency: e.target.value })
                      }
                    >
                      {PAY_FREQUENCIES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">
                    Hourly rate
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={form.hourly_rate}
                      onChange={(e) =>
                        setForm({ ...form, hourly_rate: e.target.value })
                      }
                    />
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">
                    Bank
                    <input
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={form.bank_name}
                      onChange={(e) =>
                        setForm({ ...form, bank_name: e.target.value })
                      }
                    />
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">
                    Account number
                    <input
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={form.bank_account_number}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          bank_account_number: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">
                    Branch code
                    <input
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={form.bank_branch_code}
                      onChange={(e) =>
                        setForm({ ...form, bank_branch_code: e.target.value })
                      }
                    />
                  </label>
                </div>
              </section>

              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Leave balances · emergency
                </h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold text-neutral-600">
                    Annual leave days
                    <input
                      type="number"
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={form.leave_balance_days}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          leave_balance_days: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">
                    Sick leave days
                    <input
                      type="number"
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={form.sick_balance_days}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          sick_balance_days: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">
                    Emergency contact
                    <input
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={form.emergency_contact_name}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          emergency_contact_name: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="block text-xs font-semibold text-neutral-600">
                    Emergency phone
                    <input
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={form.emergency_contact_phone}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          emergency_contact_phone: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              </section>

              <label className="block text-xs font-semibold text-neutral-600">
                Notes
                <textarea
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm min-h-[70px]"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary !py-2.5 !px-4 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary !py-2.5 !px-5 text-sm"
                >
                  {saving ? 'Saving…' : editId ? 'Save changes' : 'Create employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </RelationshipPage>
  );
}

export default function DirectoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      }
    >
      <DirectoryInner />
    </Suspense>
  );
}
