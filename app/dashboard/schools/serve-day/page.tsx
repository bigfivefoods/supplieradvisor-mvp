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

function formatServeDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
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
  const [fridgeOk, setFridgeOk] = useState(true);
  const [handwashOk, setHandwashOk] = useState(true);
  const [illnessFree, setIllnessFree] = useState(true);
  const [cleanedOk, setCleanedOk] = useState(true);

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
      // Daily kitchen food-safety micro-log (R638 continuous evidence)
      try {
        await fetch('/api/schools/kitchen-safety', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            action: 'daily_log',
            date: data?.date || serveDate,
            fridge_temp_ok: fridgeOk,
            handwash_ok: handwashOk,
            illness_free: illnessFree,
            cleaned_ok: cleanedOk,
          }),
        });
      } catch {
        /* soft */
      }
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
  const dishName =
    menu?.dish?.dish || menu?.name || 'No active menu dish today';
  const mealType = String(data?.mealType || 'lunch');
  const enrolledN = Number(school.enrolled || 0);
  const presentN = Number(present || 0);
  const servedN = Number(served || 0);
  const wasteN = Number(waste || 0);
  const wastePct =
    servedN + wasteN > 0
      ? Math.round((wasteN / (servedN + wasteN)) * 100)
      : 0;
  const portionPlan = (data?.portion_plan || null) as {
    basis?: string;
    portions?: number;
    recipe_name?: string;
    lines?: Array<Record<string, unknown>>;
  } | null;
  const portionLines = (portionPlan?.lines || []) as Array<
    Record<string, unknown>
  >;

  const renderPortion = () =>
    portionPlan ? (
    <div className="rounded-2xl border border-sky-100 bg-sky-50/80 dark:border-sky-800 dark:bg-sky-950/40 px-3 py-2.5 text-xs text-sky-950 dark:text-sky-100">
      <p className="font-bold">
        Portions from {String(portionPlan.basis || 'present')} ·{' '}
        {Number(portionPlan.portions || 0)} learners
        {portionPlan.recipe_name ? ` · ${portionPlan.recipe_name}` : ''}
      </p>
      <ul className="mt-1.5 space-y-1 max-h-36 lg:max-h-[min(20rem,40vh)] overflow-y-auto">
        {portionLines.map((l, i) => (
          <li
            key={i}
            className="flex justify-between gap-2 border-b border-sky-100/80 dark:border-sky-800/80 pb-1 last:border-0"
          >
            <span className="min-w-0 truncate">{String(l.product_name)}</span>
            <span className="font-bold tabular-nums shrink-0">
              {Number(l.qty_with_wastage || 0)} {String(l.uom || '')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  const renderNutrition = () =>
    nutrition ? (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        nutrition.pass
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/60'
          : 'border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/50'
      }`}
    >
      <strong>Nutrition check:</strong> {nutrition.energy_kcal ?? 0} kcal /{' '}
      {nutrition.protein_g ?? 0}g protein (min {nutrition.min_energy_kcal}/
      {nutrition.min_protein_g}) — {nutrition.pass ? 'PASS' : 'BELOW NORM'}
    </div>
  ) : (
    <div className="rounded-2xl border border-emerald-200 bg-white dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40 px-4 py-3 text-xs text-slate-500 dark:text-slate-300">
      Link approved products on today&apos;s menu dish for nutrition checks.{' '}
      <Link href="/dashboard/schools/menu" className="font-bold text-[#0077b6]">
        Edit menu →
      </Link>
    </div>
  );

  const renderFollowUps = () =>
    completeFlag ? (
    <div className="space-y-2">
      <p className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="w-4 h-4" /> Serve day already logged
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/schools/surveys"
          className="text-xs font-bold min-h-10 px-3 py-2 rounded-full bg-violet-50 text-violet-800 border border-violet-200 inline-flex items-center dark:bg-violet-950 dark:text-violet-200 dark:border-violet-700"
        >
          Share food survey →
        </Link>
        <Link
          href="/dashboard/schools/kitchen"
          className="text-xs font-bold min-h-10 px-3 py-2 rounded-full bg-rose-50 text-rose-800 border border-rose-200 inline-flex items-center dark:bg-rose-950 dark:text-rose-200 dark:border-rose-700"
        >
          Log kitchen waste →
        </Link>
        <Link
          href="/dashboard/schools/claims"
          className="text-xs font-bold min-h-10 px-3 py-2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700"
        >
          Claims pack →
        </Link>
      </div>
    </div>
  ) : null;

  const renderComplete = () => (
    <button
      type="button"
      onClick={() => void complete()}
      disabled={saving}
      className="w-full btn-primary !py-4 text-base font-black inline-flex items-center justify-center gap-2 min-h-14"
    >
      {saving ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <UtensilsCrossed className="w-5 h-5" />
      )}
      Complete serve day
    </button>
  );

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Serve day"
        titleAccent={serveDate === todayIso ? 'Today' : formatServeDay(serveDate)}
        description="Log present, served and waste, then the R638 kitchen checks. On a laptop, menu and portions sit beside the log."
        action={
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Refresh serve day"
            className="btn-secondary !py-2 !px-3 text-xs min-h-11 min-w-11 inline-flex items-center justify-center"
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
        <div className="space-y-4 lg:space-y-5 pb-24 md:pb-0">
          <div className="rounded-2xl border border-emerald-200 bg-white dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40 px-3 py-3 sm:px-4">
            <div className="flex flex-col lg:flex-row lg:items-end gap-3">
              <div className="flex items-end gap-2 sm:gap-3 lg:shrink-0">
                <label className="text-xs flex-1 min-w-0 sm:flex-none sm:w-56">
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
                    className="w-full min-h-11 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-base sm:text-sm font-bold tabular-nums"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setServeDate(todayIso)}
                  disabled={serveDate === todayIso}
                  className="btn-secondary !py-2.5 !px-4 text-sm min-h-11 shrink-0 disabled:opacity-50"
                >
                  Today
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 lg:flex-1 lg:justify-end lg:pb-1">
                <span className="hidden sm:inline-flex items-center min-h-8 rounded-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-2.5 text-[11px] font-bold">
                  {formatServeDay(String(data?.date || serveDate))}
                </span>
                <span className="hidden sm:inline-flex items-center min-h-8 rounded-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-2.5 text-[11px] font-bold capitalize">
                  {mealType}
                </span>
                <span className="hidden sm:inline-flex items-center min-h-8 rounded-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-2.5 text-[11px] font-bold tabular-nums">
                  {enrolledN} enrolled
                </span>
                <span className="hidden sm:inline-flex items-center min-h-8 max-w-[16rem] rounded-full border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950 px-2.5 text-[11px] font-bold truncate">
                  {dishName}
                </span>
                {completeFlag ? (
                  <span className="inline-flex items-center min-h-8 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 text-[11px] font-black text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100 dark:border-emerald-600">
                    Logged
                  </span>
                ) : (
                  <span className="inline-flex items-center min-h-8 rounded-full border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-700">
                    Not logged
                  </span>
                )}
              </div>
            </div>
          </div>
          {offline || draftBanner ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100">
              {offline ? 'You are offline. ' : ''}
              {draftBanner || 'Draft autosaved on this device.'}
            </div>
          ) : null}
          {alerts.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2 dark:border-amber-700 dark:bg-amber-950/60">
              {alerts.map((a) => (
                <div key={String(a.id)} className="flex gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">{String(a.title)}</p>
                    <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
                      {String(a.body || '')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 xl:gap-6 items-start">
            <aside className="hidden lg:block lg:col-span-5 xl:col-span-4 space-y-4">
              <div className="rounded-3xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/50 p-4 sm:p-5">
                <p className="text-[10px] font-bold uppercase text-slate-400">
                  {formatServeDay(String(data?.date || serveDate))} · {mealType}
                </p>
                <h2 className="text-xl xl:text-2xl font-black mt-1 leading-tight">
                  {String(school.name || 'School')}
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-emerald-100 bg-white/80 dark:bg-emerald-900/40 dark:border-emerald-800 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase text-slate-400">
                      Enrolled
                    </p>
                    <p className="text-lg font-black tabular-nums">{enrolledN}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-white/80 dark:bg-emerald-900/40 dark:border-emerald-800 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase text-slate-400">
                      Meal
                    </p>
                    <p className="text-sm font-black capitalize leading-snug">
                      {mealType}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Menu
                  </span>
                  <strong>{dishName}</strong>
                </p>
                {portionPlan ? <div className="mt-3">{renderPortion()}</div> : null}
                {completeFlag ? <div className="mt-3">{renderFollowUps()}</div> : null}
              </div>
              {renderNutrition()}
            </aside>

            <div className="lg:col-span-7 xl:col-span-8 min-w-0">
              <div className="lg:hidden mb-3 rounded-2xl border border-emerald-200 bg-white dark:!border-emerald-400 dark:!bg-emerald-950 px-3 py-3">
                <p className="font-black leading-tight">
                  {String(school.name || 'School')}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                  <span className="capitalize">{mealType}</span>
                  {' · '}
                  {dishName}
                </p>
                {portionPlan ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-bold text-[#0077b6] min-h-10 flex items-center">
                      Portion plan · {Number(portionPlan.portions || 0)} learners
                    </summary>
                    <div className="mt-2">{renderPortion()}</div>
                  </details>
                ) : null}
              </div>

              <div className="rounded-3xl border border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/50 p-4 sm:p-5 xl:p-6 space-y-4 pb-28 md:pb-6">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 className="text-lg sm:text-xl font-black leading-tight">
                      Log this serve
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                      Present {presentN}
                      {enrolledN > 0 ? ` / ${enrolledN}` : ''} · served {servedN}
                      {wasteN > 0 ? ` · waste ${wasteN} (${wastePct}%)` : ''}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  <label className="block text-sm min-w-0">
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      Learners present
                    </span>
                    <input
                      className="mt-1 w-full min-h-12 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 sm:px-4 py-3 text-xl sm:text-2xl font-black tabular-nums"
                      inputMode="numeric"
                      value={present}
                      onChange={(e) => {
                        setPresent(e.target.value);
                        if (!served || served === present)
                          setServed(e.target.value);
                      }}
                    />
                  </label>
                  <label className="block text-sm min-w-0">
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      Meals served
                    </span>
                    <input
                      className="mt-1 w-full min-h-12 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 sm:px-4 py-3 text-xl sm:text-2xl font-black tabular-nums"
                      inputMode="numeric"
                      value={served}
                      onChange={(e) => setServed(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm min-w-0">
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      Waste meals
                    </span>
                    <input
                      className="mt-1 w-full min-h-12 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 sm:px-4 py-3 text-xl sm:text-2xl font-black tabular-nums"
                      inputMode="numeric"
                      value={waste}
                      onChange={(e) => setWaste(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm min-w-0">
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      Food cost (optional)
                    </span>
                    <input
                      className="mt-1 w-full min-h-12 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 sm:px-4 py-3 text-xl sm:text-2xl font-black tabular-nums"
                      inputMode="decimal"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      placeholder="ZAR"
                    />
                  </label>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-300">
                  Stock lines at zero: {Number(data?.stockZero || 0)} ·{' '}
                  <Link
                    href="/dashboard/schools/kitchen"
                    className="font-bold text-[#0077b6]"
                  >
                    Stock →
                  </Link>
                </p>

                <div className="rounded-2xl border border-violet-200 bg-violet-50/70 dark:border-violet-800 dark:bg-violet-950/40 px-3 py-3 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-violet-800 dark:text-violet-200">
                    Kitchen food safety micro-log (R638)
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Tap each check. Daily evidence for CoA — cold chain, hand
                    wash, illness exclusion, pre-service cleaning.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        [
                          fridgeOk,
                          setFridgeOk,
                          'Fridge OK',
                          'Cold storage / fridge OK',
                        ],
                        [
                          handwashOk,
                          setHandwashOk,
                          'Hand wash OK',
                          'Hand wash usable',
                        ],
                        [
                          illnessFree,
                          setIllnessFree,
                          'Handlers well',
                          'No illness among handlers',
                        ],
                        [
                          cleanedOk,
                          setCleanedOk,
                          'Area cleaned',
                          'Area cleaned before service',
                        ],
                      ] as const
                    ).map(([val, setVal, short, label]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setVal(!val)}
                        className={`min-h-12 sm:min-h-14 rounded-2xl border px-2.5 sm:px-3 py-2.5 text-left text-xs sm:text-sm font-bold leading-snug ${
                          val
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-600 dark:bg-emerald-900/70 dark:text-emerald-50'
                            : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-600 dark:bg-rose-950/70 dark:text-rose-50'
                        }`}
                      >
                        <span className="mr-1.5 tabular-nums">
                          {val ? '✓' : '✕'}
                        </span>
                        <span className="sm:hidden">{short}</span>
                        <span className="hidden sm:inline">{label}</span>
                      </button>
                    ))}
                  </div>
                  <Link
                    href="/dashboard/schools/kitchen-safety"
                    className="inline-flex min-h-10 items-center text-[11px] font-bold text-violet-800 dark:text-violet-200 underline"
                  >
                    Full CoA / R638 passport →
                  </Link>
                </div>

                <label className="flex items-start gap-3 text-sm cursor-pointer rounded-2xl border border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-900/50 px-3 py-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0"
                    checked={autoIssue}
                    onChange={(e) => setAutoIssue(e.target.checked)}
                  />
                  <span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      Auto-issue menu stock
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-300">
                      Deduct today&apos;s menu products from kitchen when you
                      complete serve day (closes PO → GRN → plate).
                    </span>
                  </span>
                </label>

                <div className="hidden md:block">{renderComplete()}</div>
              </div>

              <div className="lg:hidden mt-3 space-y-3">
                {renderNutrition()}
                {renderFollowUps()}
              </div>
            </div>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-30 md:hidden pointer-events-none">
            <div className="pointer-events-auto px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-white via-white/95 to-transparent dark:from-black dark:via-black/90">
              {renderComplete()}
            </div>
          </div>
        </div>
      )}
    </SchoolsPage>
  );
}
