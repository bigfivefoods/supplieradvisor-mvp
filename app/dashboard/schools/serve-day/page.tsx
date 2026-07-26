'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  UtensilsCrossed,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

export default function ServeDayPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [present, setPresent] = useState('');
  const [served, setServed] = useState('');
  const [waste, setWaste] = useState('0');
  const [cost, setCost] = useState('');
  const [autoIssue, setAutoIssue] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/schools/serve-day?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setData(json);
      const sug = String(json.suggestedServed ?? '');
      setPresent(sug);
      setServed(sug);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const complete = async () => {
    setSaving(true);
    try {
      const nutrition = data?.nutrition as
        | { pass?: boolean; energy_kcal?: number; protein_g?: number }
        | undefined;
      const menu = data?.menu as { dish?: { dish?: string } } | null;
      const dish = menu?.dish as
        | { dish?: string; approved_product_ids?: number[] }
        | null
        | undefined;
      const res = await fetch('/api/schools/serve-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          date: data?.date,
          meal_type: data?.mealType || 'lunch',
          present: Number(present || 0),
          enrolled: Number(
            (data?.school as { enrolled?: number })?.enrolled || present || 0
          ),
          planned_meals: Number(present || 0),
          served_meals: Number(served || 0),
          waste_meals: Number(waste || 0),
          cost_amount: cost ? Number(cost) : null,
          menu_name: dish?.dish || menu?.dish?.dish || null,
          nutrition_pass: nutrition?.pass ?? null,
          nutrition_energy_kcal: nutrition?.energy_kcal ?? null,
          nutrition_protein_g: nutrition?.protein_g ?? null,
          auto_issue: autoIssue,
          issue_product_ids: dish?.approved_product_ids || [],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      const issued = (json.stock_issues || []).filter(
        (x: { status?: string }) => x.status === 'issued'
      ).length;
      toast.success(
        issued > 0
          ? `Serve day complete · ${issued} stock line(s) issued`
          : 'Serve day complete'
      );
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const school = (data?.school || {}) as Record<string, unknown>;
  const menu = (data?.menu || null) as {
    name?: string;
    dish?: {
      dish?: string;
      meal_type?: string;
      approved_product_ids?: number[];
    } | null;
  } | null;
  const nutrition = (data?.nutrition || null) as {
    pass?: boolean;
    energy_kcal?: number;
    protein_g?: number;
    min_energy_kcal?: number;
    min_protein_g?: number;
  } | null;
  const alerts = (data?.alerts || []) as Array<Record<string, unknown>>;
  const completeFlag = Boolean(data?.complete);

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Serve day"
        titleAccent="Today"
        description="One screen for kitchen managers: menu → attendance → meals served → waste. Built for low-friction daily NSNP ops."
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

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="max-w-xl mx-auto space-y-4">
          {alerts.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
              {alerts.map((a) => (
                <div key={String(a.id)} className="flex gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">{String(a.title)}</p>
                    <p className="text-xs text-amber-900/80">{String(a.body || '')}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-[10px] font-bold uppercase text-slate-400">
              {String(data?.date)} · {String(data?.mealType)}
            </p>
            <h2 className="text-xl font-black mt-1">{String(school.name)}</h2>
            <p className="text-sm text-slate-600">
              Enrolled {Number(school.enrolled || 0)} · Menu:{' '}
              <strong>
                {menu?.dish?.dish || menu?.name || 'No active menu dish today'}
              </strong>
            </p>
            {completeFlag ? (
              <div className="mt-3 space-y-2">
                <p className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" /> Serve day already logged
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link
                    href="/dashboard/schools/surveys"
                    className="text-xs font-bold px-3 py-1.5 rounded-full bg-violet-50 text-violet-800 border border-violet-200"
                  >
                    Share food survey →
                  </Link>
                  <Link
                    href="/dashboard/schools/kitchen"
                    className="text-xs font-bold px-3 py-1.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200"
                  >
                    Log kitchen waste →
                  </Link>
                  <Link
                    href="/dashboard/schools/claims"
                    className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200"
                  >
                    Claims pack →
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          {nutrition ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                nutrition.pass
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-amber-200 bg-amber-50'
              }`}
            >
              <strong>Nutrition check:</strong>{' '}
              {nutrition.energy_kcal ?? 0} kcal / {nutrition.protein_g ?? 0}g
              protein (min {nutrition.min_energy_kcal}/
              {nutrition.min_protein_g}) —{' '}
              {nutrition.pass ? 'PASS' : 'BELOW NORM'}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
              Link approved products on today&apos;s menu dish for nutrition
              checks.{' '}
              <Link href="/dashboard/schools/menu" className="font-bold text-[#0077b6]">
                Edit menu →
              </Link>
            </div>
          )}

          <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3">
            <label className="block text-sm">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Learners present
              </span>
              <input
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-lg font-bold"
                inputMode="numeric"
                value={present}
                onChange={(e) => {
                  setPresent(e.target.value);
                  if (!served || served === present) setServed(e.target.value);
                }}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Meals served
              </span>
              <input
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-lg font-bold"
                inputMode="numeric"
                value={served}
                onChange={(e) => setServed(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Waste meals
                </span>
                <input
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold"
                  inputMode="numeric"
                  value={waste}
                  onChange={(e) => setWaste(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Food cost (optional)
                </span>
                <input
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold"
                  inputMode="decimal"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="ZAR"
                />
              </label>
            </div>

            <p className="text-xs text-slate-500">
              Stock lines at zero: {Number(data?.stockZero || 0)} ·{' '}
              <Link
                href="/dashboard/schools/kitchen"
                className="font-bold text-[#0077b6]"
              >
                Kitchen →
              </Link>
            </p>

            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={autoIssue}
                onChange={(e) => setAutoIssue(e.target.checked)}
              />
              <span>
                <span className="font-bold text-slate-800">
                  Auto-issue menu stock
                </span>
                <span className="block text-xs text-slate-500">
                  Deduct today&apos;s menu products from kitchen when you
                  complete serve day (closes PO → GRN → plate).
                </span>
              </span>
            </label>

            <button
              type="button"
              onClick={() => void complete()}
              disabled={saving}
              className="w-full btn-primary !py-4 text-base font-black inline-flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <UtensilsCrossed className="w-5 h-5" />
              )}
              Complete serve day
            </button>
          </div>
        </div>
      )}
    </SchoolsPage>
  );
}
