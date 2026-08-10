'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

export default function FeedingPage() {
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
    feed_date: new Date().toISOString().slice(0, 10),
    meal_type: 'lunch',
    menu_name: '',
    planned_meals: '',
    served_meals: '',
    waste_meals: '0',
    learners_present: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/schools/feeding?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setRows(data.feeding || []);
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
      const res = await fetch('/api/schools/feeding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          ...form,
          planned_meals: Number(form.planned_meals || 0),
          served_meals: Number(form.served_meals || 0),
          waste_meals: Number(form.waste_meals || 0),
          learners_present: Number(form.learners_present || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Feeding day saved');
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
        title="Daily feeding"
        titleAccent="Meals"
        description="Log planned vs served meals and waste. Links to attendance for integrity reporting."
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

      <div className="mb-6 rounded-3xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/50 p-5 grid sm:grid-cols-3 gap-3">
        {(
          [
            ['feed_date', 'Date', 'date'],
            ['meal_type', 'Meal', 'select'],
            ['menu_name', 'Menu name', 'text'],
            ['planned_meals', 'Planned meals', 'number'],
            ['served_meals', 'Served meals', 'number'],
            ['waste_meals', 'Waste meals', 'number'],
            ['learners_present', 'Learners present', 'number'],
          ] as const
        ).map(([k, label, type]) => (
          <label key={k} className="text-xs">
            <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              {label}
            </span>
            {type === 'select' ? (
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.meal_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, meal_type: e.target.value }))
                }
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="snack">Snack</option>
              </select>
            ) : (
              <input
                type={type}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form[k as keyof typeof form]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [k]: e.target.value }))
                }
              />
            )}
          </label>
        ))}
        <div className="sm:col-span-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UtensilsCrossed className="w-4 h-4" />
            )}
            Save feeding day
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="rounded-3xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/50 overflow-hidden">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                <th className="px-4 py-3">Date</th>
                <th className="px-3 py-3">Meal</th>
                <th className="px-3 py-3">Menu</th>
                <th className="px-3 py-3 text-right">Planned</th>
                <th className="px-3 py-3 text-right">Served</th>
                <th className="px-3 py-3 text-right">Waste</th>
                <th className="px-3 py-3 text-right">Present</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)} className="border-b border-slate-50">
                  <td className="px-4 py-2 font-mono text-xs">
                    {String(r.feed_date)}
                  </td>
                  <td className="px-3 py-2 capitalize text-xs">
                    {String(r.meal_type)}
                  </td>
                  <td className="px-3 py-2">{String(r.menu_name || '—')}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {Number(r.planned_meals || 0)}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    {Number(r.served_meals || 0)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {Number(r.waste_meals || 0)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {Number(r.learners_present || 0)}
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
