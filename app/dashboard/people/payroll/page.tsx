'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Calculator, CheckCircle2, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  RelationshipHeader,
  RelationshipPage,
  Panel,
} from '@/components/relationship/RelationshipChrome';
import { formatMoney } from '@/lib/accounting/types';
import { statusBadgeClass } from '@/lib/hr/types';

type Run = {
  id: number;
  period_label?: string;
  period_year: number;
  period_month: number;
  status: string;
  employee_count?: number;
  total_gross?: number;
  total_deductions?: number;
  total_net?: number;
  total_employer_cost?: number;
  journal_entry_id?: number | null;
};

type Line = {
  id: number;
  employee_name?: string;
  employee_number?: string;
  basic_pay?: number;
  gross_pay?: number;
  paye?: number;
  uif_employee?: number;
  total_deductions?: number;
  net_pay?: number;
  employer_cost?: number;
};

export default function PayrollPage() {
  const companyId = getSelectedCompanyId()!;
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<Run | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/payroll?companyId=${companyId}`);
      const data = await res.json();
      setRuns(data.runs || []);
      if (data.warning) toast.message(data.warning, { description: data.hint });
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  async function openRun(run: Run) {
    setSelected(run);
    const res = await fetch(
      `/api/hr/payroll?companyId=${companyId}&runId=${run.id}`
    );
    const data = await res.json();
    setLines(data.lines || []);
    if (data.run) setSelected(data.run);
  }

  async function calculate() {
    setBusy(true);
    try {
      const res = await fetch('/api/hr/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'calculate',
          period_year: year,
          period_month: month,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Calculate failed');
      toast.success(
        `Calculated ${data.run?.employee_count || 0} employees · net ${formatMoney(data.run?.total_net || 0)}`
      );
      setSelected(data.run);
      setLines(data.lines || []);
      void loadRuns();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch('/api/hr/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'approve',
          id: selected.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approve failed');
      toast.success('Payroll approved');
      setSelected(data.run);
      void loadRuns();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch('/api/hr/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'pay',
          id: selected.id,
          post_gl: true,
          post_cost_entries: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pay failed');
      toast.success(
        data.journal?.entryNumber
          ? `Paid · GL ${data.journal.entryNumber}`
          : 'Payroll marked paid'
      );
      setSelected(data.run);
      void loadRuns();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <RelationshipPage>
      <RelationshipHeader
        title="Payroll"
        titleAccent="runs"
        description="Calculate gross, PAYE/UIF proxies, approve, pay, post journals, and allocate labour to cost centres."
        action={
          <Link
            href="/dashboard/people/directory"
            className="btn-secondary !py-2.5 !px-4 text-sm"
          >
            Directory
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-xs font-semibold text-neutral-600">
          Year
          <input
            type="number"
            className="mt-1 block w-24 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        <label className="text-xs font-semibold text-neutral-600">
          Month
          <select
            className="mt-1 block w-32 rounded-xl border border-neutral-200 px-3 py-2 text-sm bg-white"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, '0')}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void calculate()}
          className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
        >
          <Calculator className="w-4 h-4" />
          {busy ? 'Working…' : 'Calculate run'}
        </button>
        {selected && selected.status === 'calculated' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void approve()}
            className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" /> Approve
          </button>
        )}
        {selected &&
          (selected.status === 'approved' || selected.status === 'calculated') && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void pay()}
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2 border-emerald-200 text-emerald-900"
            >
              <Banknote className="w-4 h-4" /> Mark paid + GL
            </button>
          )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel className="lg:col-span-1 !p-0 overflow-hidden">
          <div className="px-4 py-3 border-b font-bold text-sm">Recent runs</div>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
            </div>
          ) : runs.length === 0 ? (
            <p className="p-4 text-sm text-neutral-500">
              No payroll runs yet. Calculate a period above.
            </p>
          ) : (
            <ul className="divide-y max-h-[420px] overflow-y-auto">
              {runs.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => void openRun(r)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${
                      selected?.id === r.id ? 'bg-sky-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">
                        {r.period_label ||
                          `${r.period_year}-${String(r.period_month).padStart(2, '0')}`}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadgeClass(r.status)}`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      {r.employee_count || 0} people · net{' '}
                      {formatMoney(Number(r.total_net || 0))}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="lg:col-span-2">
          {!selected ? (
            <p className="text-sm text-neutral-500 py-8 text-center">
              Select or calculate a payroll run to view payslips.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {[
                  { l: 'Gross', v: selected.total_gross },
                  { l: 'Deductions', v: selected.total_deductions },
                  { l: 'Net', v: selected.total_net },
                  { l: 'Employer cost', v: selected.total_employer_cost },
                ].map((x) => (
                  <div
                    key={x.l}
                    className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2"
                  >
                    <div className="text-[10px] font-bold uppercase text-neutral-400">
                      {x.l}
                    </div>
                    <div className="font-black tabular-nums text-slate-900">
                      {formatMoney(Number(x.v || 0))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase text-neutral-400 border-b">
                      <th className="py-2 pr-2">Employee</th>
                      <th className="py-2 pr-2 text-right">Basic</th>
                      <th className="py-2 pr-2 text-right">PAYE</th>
                      <th className="py-2 pr-2 text-right">UIF</th>
                      <th className="py-2 text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {lines.map((l) => (
                      <tr key={l.id}>
                        <td className="py-2 pr-2">
                          <div className="font-semibold">{l.employee_name}</div>
                          <div className="text-[10px] text-neutral-400">
                            {l.employee_number}
                          </div>
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {formatMoney(Number(l.basic_pay || 0))}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {formatMoney(Number(l.paye || 0))}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {formatMoney(Number(l.uif_employee || 0))}
                        </td>
                        <td className="py-2 text-right tabular-nums font-semibold">
                          {formatMoney(Number(l.net_pay || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[11px] text-neutral-500">
                PAYE/UIF figures are illustrative proxies for demo — not SARS
                tax advice. Wire full statutory tables for production payroll.
              </p>
            </>
          )}
        </Panel>
      </div>
    </RelationshipPage>
  );
}
