'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

export default function AttendancePage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [form, setForm] = useState({
    attendance_date: new Date().toISOString().slice(0, 10),
    enrolled: '',
    present: '',
    grade: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/schools/attendance?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setRows(data.attendance || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/schools/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          attendance_date: form.attendance_date,
          enrolled: form.enrolled ? Number(form.enrolled) : undefined,
          present: Number(form.present || 0),
          grade: form.grade || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Attendance saved');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Attendance"
        titleAccent="Present"
        description="Daily headcount present. Used with feeding logs for meals-vs-learners integrity."
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

      <div className="mb-6 rounded-3xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/50 p-5 grid sm:grid-cols-4 gap-3">
        <label className="text-xs">
          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
            Date
          </span>
          <input
            type="date"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={form.attendance_date}
            onChange={(e) =>
              setForm((f) => ({ ...f, attendance_date: e.target.value }))
            }
          />
        </label>
        <label className="text-xs">
          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
            Enrolled
          </span>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={form.enrolled}
            onChange={(e) =>
              setForm((f) => ({ ...f, enrolled: e.target.value }))
            }
            placeholder="Auto from register"
          />
        </label>
        <label className="text-xs">
          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
            Present
          </span>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={form.present}
            onChange={(e) =>
              setForm((f) => ({ ...f, present: e.target.value }))
            }
          />
        </label>
        <label className="text-xs">
          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
            Grade (optional)
          </span>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={form.grade}
            onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
          />
        </label>
        <div className="sm:col-span-4">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Users className="w-4 h-4" />
            )}
            Save attendance
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="rounded-3xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                <th className="px-4 py-3">Date</th>
                <th className="px-3 py-3">Grade</th>
                <th className="px-3 py-3 text-right">Enrolled</th>
                <th className="px-3 py-3 text-right">Present</th>
                <th className="px-3 py-3 text-right">Absent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)} className="border-b border-slate-50">
                  <td className="px-4 py-2 font-mono text-xs">
                    {String(r.attendance_date)}
                  </td>
                  <td className="px-3 py-2">{String(r.grade || 'All')}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {Number(r.enrolled || 0)}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    {Number(r.present || 0)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {Number(r.absent || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SchoolsPage>
  );
}
