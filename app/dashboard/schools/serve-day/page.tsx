'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  clearOfflineDraft,
  isBrowserOnline,
  loadOfflineDraft,
  saveOfflineDraft,
} from '@/lib/schools/offline-draft';

export default function ServeDayPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function localIsoDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const todayIso = useMemo(() => localIsoDate(), []);
  const [serveDate, setServeDate] = useState(() => {
    if (typeof window === 'undefined') return todayIso;
    try {
      const q = new URLSearchParams(window.location.search).get('date');
      if (q && /^\d{4}-\d{2}-\d{2}$/.test(q) && q <= todayIso) return q;
    } catch {
      /* soft */
    }
    return todayIso;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [present, setPresent] = useState('');
  const [served, setServed] = useState('');
  const [waste, setWaste] = useState('0');
  const [cost, setCost] = useState('');
  const [autoIssue, setAutoIssue] = useState(true);
  const [draftBanner, setDraftBanner] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const draftId = String(data?.date || serveDate || 'today');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/schools/serve-day?companyId=${companyId}&date=${encodeURIComponent(serveDate)}`,
        { cache: 'no-store' }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setData(json);
      const day = String(json.date || serveDate || 'today');
      const draft = loadOfflineDraft<{
        present?: string;
        served?: string;
        waste?: string;
        cost?: string;
        autoIssue?: boolean;
      }>('serve-day', companyId, day);
      if (draft?.payload) {
        setPresent(String(draft.payload.present ?? json.suggestedServed ?? ''));
        setServed(String(draft.payload.served ?? json.suggestedServed ?? ''));
        setWaste(String(draft.payload.waste ?? '0'));
        setCost(String(draft.payload.cost ?? ''));
        if (draft.payload.autoIssue != null)
          setAutoIssue(Boolean(draft.payload.autoIssue));
        setDraftBanner(
          `Restored offline draft from ${new Date(draft.savedAt).toLocaleString()}`
        );
      } else {
        const att = json.attendance?.present;
        const fed =
          json.feeding?.planned_meals ?? json.feeding?.served_meals;
        const seed =
          att != null
            ? String(att)
            : fed != null
              ? String(fed)
              : String(json.suggestedServed ?? '');
        setPresent(seed);
        setServed(
          json.feeding?.served_meals != null
            ? String(json.feeding.served_meals)
            : seed
        );
        setWaste(
          json.feeding?.waste_meals != null
            ? String(json.feeding.waste_meals)
            : '0'
        );
        setDraftBanner(null);
      }
    } catch (e: unknown) {
      // Offline: restore draft only
      const draft = loadOfflineDraft<{
        present?: string;
        served?: string;
        waste?: string;
        cost?: string;
      }>('serve-day', companyId, serveDate || 'today');
      if (draft?.payload) {
        setPresent(String(draft.payload.present || ''));
        setServed(String(draft.payload.served || ''));
        setWaste(String(draft.payload.waste || '0'));
        setCost(String(draft.payload.cost || ''));
        setDraftBanner('Offline — working from local draft');
        setOffline(true);
      } else {
        toast.error(e instanceof Error ? e.message : 'Load failed');
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, serveDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onOff = () => setOffline(!isBrowserOnline());
    const onOn = () => setOffline(false);
    window.addEventListener('offline', onOff);
    window.addEventListener('online', onOn);
    setOffline(!isBrowserOnline());
    return () => {
      window.removeEventListener('offline', onOff);
      window.removeEventListener('online', onOn);
    };
  }, []);

  // Autosave draft
  useEffect(() => {
    if (!data?.date && !offline) return;
    const t = setTimeout(() => {
      saveOfflineDraft(
        'serve-day',
        companyId,
        String(data?.date || 'today'),
        { present, served, waste, cost, autoIssue },
        'Serve day'
      );
    }, 400);
    return () => clearTimeout(t);
  }, [companyId, data?.date, present, served, waste, cost, autoIssue, offline]);

  const complete = async () => {
    setSaving(true);
    try {
      if (!isBrowserOnline()) {
        saveOfflineDraft(
          'serve-day',
          companyId,
          draftId,
          { present, served, waste, cost, autoIssue, pendingSubmit: true },
          'Serve day pending sync'
        );
        toast.message('Saved offline — will need to submit when online');
        return;
      }
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
          date: data?.date || serveDate,
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
      clearOfflineDraft('serve-day', companyId, draftId);
      setDraftBanner(null);
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
      saveOfflineDraft(
        'serve-day',
        companyId,
        draftId,
        { present, served, waste, cost, autoIssue, pendingSubmit: true },
        'Serve day (failed submit)'
      );
      toast.error(e instanceof Error ? e.message : 'Failed — draft saved');
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
        titleAccent={serveDate === todayIso ? 'Today' : serveDate}
        description="One screen for kitchen managers: pick the day → menu → attendance → meals served → waste. Defaults to the day you logged in."
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
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-end gap-2">
            <label className="text-xs flex-1 min-w-[10rem]">
              <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Serve day
              </span>
              <input
                type="date"
                value={serveDate}
                max={todayIso}
                onChange={(e) => {
                  if (e.target.value) setServeDate(e.target.value);
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold tabular-nums"
              />
            </label>
            <button
              type="button"
              onClick={() => setServeDate(todayIso)}
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              Today
            </button>
          </div>
          {offline || draftBanner ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {offline ? 'You are offline. ' : ''}
              {draftBanner || 'Draft autosaved on this device.'}
            </div>
          ) : null}
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
              {String(data?.date || serveDate)} · {String(data?.mealType)}
            </p>
            <h2 className="text-xl font-black mt-1">{String(school.name)}</h2>
            <p className="text-sm text-slate-600">
              Enrolled {Number(school.enrolled || 0)} · Menu:{' '}
              <strong>
                {menu?.dish?.dish || menu?.name || 'No active menu dish today'}
              </strong>
            </p>
            {data?.portion_plan ? (
              <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/60 px-3 py-2.5 text-xs text-sky-950">
                <p className="font-bold">
                  Portions from{' '}
                  {String(
                    (data.portion_plan as { basis?: string }).basis || 'present'
                  )}{' '}
                  ·{' '}
                  {Number(
                    (data.portion_plan as { portions?: number }).portions || 0
                  )}{' '}
                  learners
                  {(data.portion_plan as { recipe_name?: string }).recipe_name
                    ? ` · ${String((data.portion_plan as { recipe_name?: string }).recipe_name)}`
                    : ''}
                </p>
                <ul className="mt-1.5 space-y-0.5 max-h-28 overflow-y-auto">
                  {(
                    ((data.portion_plan as { lines?: Array<Record<string, unknown>> })
                      .lines || []) as Array<Record<string, unknown>>
                  )
                    .slice(0, 8)
                    .map((l, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span>{String(l.product_name)}</span>
                        <span className="font-bold tabular-nums">
                          {Number(l.qty_with_wastage || 0)} {String(l.uom || '')}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
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
