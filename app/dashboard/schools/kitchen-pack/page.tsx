'use client';

/**
 * Mobile kitchen pack — big taps for POD, one-tap GRN, serve day + offline queue.
 * One-tap serve day includes a calendar (default = day you logged in / local today)
 * so staff pick the serve date and capture learners present for that day.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Camera,
  CheckCircle2,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  RefreshCw,
  Truck,
  UtensilsCrossed,
  WifiOff,
  CalendarDays,
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

/** Local calendar date YYYY-MM-DD (not UTC — kitchen staff work on local school day). */
function localIsoDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoLocal(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

function addMonths(isoMonthStart: string, delta: number): string {
  const d = parseIsoLocal(isoMonthStart.slice(0, 7) + '-01');
  d.setMonth(d.getMonth() + delta);
  return localIsoDate(d).slice(0, 7) + '-01';
}

function formatDayLabel(iso: string): string {
  try {
    return parseIsoLocal(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function KitchenPackPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const todayIso = useMemo(() => localIsoDate(), []);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [awaiting, setAwaiting] = useState(0);
  /** Serve calendar day — defaults to the day staff logged in (local today) */
  const [serveDate, setServeDate] = useState(todayIso);
  const [calendarMonth, setCalendarMonth] = useState(
    () => todayIso.slice(0, 7) + '-01'
  );
  const [showCalendar, setShowCalendar] = useState(true);
  const [serveDone, setServeDone] = useState(false);
  const [suggested, setSuggested] = useState<number | null>(null);
  const [present, setPresent] = useState('');
  const [menuDish, setMenuDish] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState<number | null>(null);
  const [queued, setQueued] = useState(0);

  const refreshQueue = useCallback(() => {
    try {
      let n = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith('sa_nsnp_draft_v1:kitchen_pack:')) n += 1;
      }
      setQueued(n);
    } catch {
      setQueued(0);
    }
  }, []);

  const loadDeliveries = useCallback(async () => {
    try {
      const dRes = await fetch(
        `/api/schools/deliveries?companyId=${companyId}`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const d = await dRes.json().catch(() => ({}));
      if (dRes.ok) {
        const list = (d.deliveries || d.items || []) as Array<
          Record<string, unknown>
        >;
        setAwaiting(
          list.filter((x) =>
            ['dispatched', 'delivered', 'confirmed'].includes(String(x.status))
          ).length
        );
      }
    } catch {
      /* soft */
    }
  }, [companyId]);

  const loadServeDay = useCallback(
    async (date: string) => {
      setLoadingDay(true);
      try {
        const sRes = await fetch(
          `/api/schools/serve-day?companyId=${companyId}&date=${encodeURIComponent(date)}`,
          { cache: 'no-store', credentials: 'same-origin' }
        );
        const s = await sRes.json().catch(() => ({}));
        if (sRes.ok) {
          setServeDone(Boolean(s.complete));
          const sug =
            s.suggestedServed != null ? Number(s.suggestedServed) : null;
          setSuggested(Number.isFinite(sug as number) ? sug : null);
          setEnrolled(
            s.school?.enrolled != null ? Number(s.school.enrolled) : null
          );
          const dish =
            s.menu?.dish?.dish != null
              ? String(s.menu.dish.dish)
              : s.menu?.name != null
                ? String(s.menu.name)
                : null;
          setMenuDish(dish);

          // Prefer existing attendance / feeding for that day, else suggested
          const attPresent =
            s.attendance?.present != null
              ? Number(s.attendance.present)
              : null;
          const fedPresent =
            s.feeding?.planned_meals != null
              ? Number(s.feeding.planned_meals)
              : s.feeding?.served_meals != null
                ? Number(s.feeding.served_meals)
                : null;
          const seed =
            attPresent != null && attPresent > 0
              ? attPresent
              : fedPresent != null && fedPresent > 0
                ? fedPresent
                : sug != null && sug > 0
                  ? sug
                  : null;
          setPresent(seed != null ? String(seed) : '');
        }
      } catch {
        /* soft — offline seed from draft */
        const draft = loadOfflineDraft<{ present?: number }>(
          'kitchen_pack',
          companyId,
          `serve-${date}`
        );
        if (draft?.payload?.present != null) {
          setPresent(String(draft.payload.present));
        }
      } finally {
        setLoadingDay(false);
        refreshQueue();
      }
    },
    [companyId, refreshQueue]
  );

  useEffect(() => {
    void loadDeliveries();
    void loadServeDay(serveDate);
    const on = () => setOnline(isBrowserOnline());
    setOnline(isBrowserOnline());
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, [loadDeliveries, loadServeDay, serveDate]);

  const selectServeDate = (iso: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    setServeDate(iso);
    // Keep calendar month in sync when jumping
    setCalendarMonth(iso.slice(0, 7) + '-01');
  };

  const calendarCells = useMemo(() => {
    const start = parseIsoLocal(calendarMonth);
    const year = start.getFullYear();
    const month = start.getMonth();
    // Monday-first grid
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ iso: string | null; day: number | null }> = [];
    for (let i = 0; i < firstDow; i++) {
      cells.push({ iso: null, day: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = localIsoDate(new Date(year, month, d));
      cells.push({ iso, day: d });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ iso: null, day: null });
    }
    return cells;
  }, [calendarMonth]);

  const monthTitle = useMemo(() => {
    try {
      return parseIsoLocal(calendarMonth).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return calendarMonth.slice(0, 7);
    }
  }, [calendarMonth]);

  const flushQueue = async () => {
    if (!isBrowserOnline()) {
      toast.message('Still offline — will sync when connected');
      return;
    }
    setBusy(true);
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(`sa_nsnp_draft_v1:kitchen_pack:${companyId}:`)) {
          keys.push(k);
        }
      }
      let ok = 0;
      for (const k of keys) {
        const id = k.split(':').pop() || 'serve';
        const draft = loadOfflineDraft<{
          action: string;
          present?: number;
          date?: string;
        }>('kitchen_pack', companyId, id);
        if (!draft) continue;
        if (draft.payload.action === 'serve') {
          const day =
            draft.payload.date ||
            (id.startsWith('serve-') ? id.slice(6) : localIsoDate());
          const res = await fetch('/api/schools/serve-day', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              companyId,
              date: day,
              present: draft.payload.present,
              served_meals: draft.payload.present,
              planned_meals: draft.payload.present,
            }),
          });
          if (res.ok) {
            clearOfflineDraft('kitchen_pack', companyId, id);
            ok += 1;
          }
        }
      }
      toast.success(ok ? `Synced ${ok} offline action(s)` : 'Nothing to sync');
      void loadServeDay(serveDate);
      void loadDeliveries();
    } finally {
      setBusy(false);
    }
  };

  const quickServe = async () => {
    const n = Number(present || suggested || 0);
    if (!(n > 0)) {
      toast.error('Enter learners present for the selected day');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(serveDate)) {
      toast.error('Pick a valid day on the calendar');
      return;
    }
    setBusy(true);
    try {
      if (!isBrowserOnline()) {
        saveOfflineDraft(
          'kitchen_pack',
          companyId,
          `serve-${serveDate}`,
          { action: 'serve', present: n, date: serveDate },
          `Serve day ${serveDate} offline`
        );
        toast.message(
          `Saved offline for ${formatDayLabel(serveDate)} — will submit when online`
        );
        refreshQueue();
        return;
      }
      const res = await fetch('/api/schools/serve-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          date: serveDate,
          present: n,
          served_meals: n,
          planned_meals: n,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        serveDone
          ? `Serve day updated · ${formatDayLabel(serveDate)}`
          : `Serve day logged · ${formatDayLabel(serveDate)}`
      );
      setServeDone(true);
      void loadServeDay(serveDate);
    } catch (e: unknown) {
      saveOfflineDraft(
        'kitchen_pack',
        companyId,
        `serve-${serveDate}`,
        { action: 'serve', present: n, date: serveDate },
        `Serve day ${serveDate} (retry)`
      );
      toast.error(
        e instanceof Error
          ? `${e.message} — saved offline`
          : 'Saved offline'
      );
      refreshQueue();
    } finally {
      setBusy(false);
    }
  };

  const btn =
    'min-h-[72px] rounded-3xl font-black text-base flex flex-col items-center justify-center gap-1.5 px-4 active:scale-[0.98] transition';

  const isToday = serveDate === todayIso;

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Kitchen pack"
        titleAccent="Mobile"
        description="Big buttons for kitchen staff — receive, POD, serve day. Pick the day on the calendar (defaults to today). Works offline."
        mode="school"
        action={
          <button
            type="button"
            onClick={() => {
              void loadDeliveries();
              void loadServeDay(serveDate);
            }}
            className="btn-secondary !py-2 !px-3 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        }
      />

      {!online ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex gap-2 items-center">
          <WifiOff className="w-5 h-5 shrink-0" />
          Offline — serve day will queue locally until you reconnect.
          {queued > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void flushQueue()}
              className="ml-auto font-bold underline"
            >
              Retry sync ({queued})
            </button>
          ) : null}
        </div>
      ) : queued > 0 ? (
        <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm flex justify-between items-center">
          <span>{queued} offline action(s) waiting</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void flushQueue()}
            className="btn-primary !py-1.5 !px-3 text-xs"
          >
            Sync now
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <Link
          href="/dashboard/schools/deliveries"
          className={`${btn} bg-sky-600 text-white shadow-lg shadow-sky-200`}
        >
          <Truck className="w-8 h-8" />
          Receive deliveries
          {awaiting > 0 ? (
            <span className="text-xs font-bold bg-white/20 rounded-full px-2 py-0.5">
              {awaiting} waiting
            </span>
          ) : (
            <span className="text-xs opacity-80">GRN into kitchen</span>
          )}
        </Link>
        <Link
          href="/dashboard/schools/deliveries"
          className={`${btn} bg-violet-600 text-white shadow-lg shadow-violet-200`}
        >
          <Camera className="w-8 h-8" />
          Photo POD
          <span className="text-xs opacity-80">Open delivery → attach</span>
        </Link>
        <Link
          href="/dashboard/schools/kitchen"
          className={`${btn} bg-emerald-600 text-white shadow-lg shadow-emerald-200`}
        >
          <Package className="w-8 h-8" />
          Kitchen stock
          <span className="text-xs opacity-80">Cover · reorder · order</span>
        </Link>
        <Link
          href={`/dashboard/schools/serve-day?date=${serveDate}`}
          className={`${btn} bg-amber-500 text-white shadow-lg shadow-amber-200`}
        >
          <UtensilsCrossed className="w-8 h-8" />
          Full serve day
          <span className="text-xs opacity-80">
            {serveDone
              ? `Logged ${isToday ? 'today' : serveDate} ✓`
              : 'Menu · nutrition · waste'}
          </span>
        </Link>
      </div>

      <div className="rounded-3xl border-2 border-amber-200 bg-amber-50/50 p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-amber-800 shrink-0" />
            <div>
              <p className="font-black text-slate-900">One-tap serve day</p>
              <p className="text-xs text-slate-600">
                Pick the day, enter learners present, log. Defaults to{' '}
                <strong>today</strong> ({formatDayLabel(todayIso)}).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCalendar((v) => !v)}
            className="shrink-0 rounded-xl border border-amber-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-amber-900 inline-flex items-center gap-1"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            {showCalendar ? 'Hide' : 'Calendar'}
          </button>
        </div>

        {/* Selected day strip */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => selectServeDate(todayIso)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold border ${
              isToday
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            Today
          </button>
          <label className="flex-1 min-w-[10rem]">
            <span className="sr-only">Serve date</span>
            <input
              type="date"
              value={serveDate}
              max={todayIso}
              onChange={(e) => {
                if (e.target.value) selectServeDate(e.target.value);
              }}
              className="w-full rounded-2xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-bold tabular-nums"
            />
          </label>
        </div>

        {showCalendar ? (
          <div className="rounded-2xl border border-amber-200 bg-white p-3">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() =>
                  setCalendarMonth((m) => addMonths(m, -1))
                }
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <p className="text-sm font-black text-slate-900">{monthTitle}</p>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  className="text-center text-[10px] font-bold uppercase text-slate-400 py-1"
                >
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((c, i) => {
                if (!c.iso) {
                  return <div key={`e-${i}`} className="aspect-square" />;
                }
                const selected = c.iso === serveDate;
                const isTodayCell = c.iso === todayIso;
                const future = c.iso > todayIso;
                return (
                  <button
                    key={c.iso}
                    type="button"
                    disabled={future}
                    onClick={() => selectServeDate(c.iso!)}
                    className={`aspect-square rounded-xl text-sm font-bold tabular-nums transition active:scale-95 ${
                      selected
                        ? 'bg-amber-600 text-white shadow-md'
                        : isTodayCell
                          ? 'bg-amber-100 text-amber-950 border-2 border-amber-400'
                          : future
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'bg-slate-50 text-slate-800 hover:bg-sky-50'
                    }`}
                  >
                    {c.day}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-slate-500 text-center">
              Capturing for{' '}
              <strong className="text-slate-800">
                {formatDayLabel(serveDate)}
              </strong>
              {isToday ? ' · default login day' : null}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-600 text-center">
            Day: <strong>{formatDayLabel(serveDate)}</strong>
            {isToday ? ' (today)' : null}
          </p>
        )}

        {loadingDay ? (
          <div className="flex justify-center py-2">
            <Loader2 className="w-5 h-5 animate-spin text-amber-700" />
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-100 bg-white/80 px-3 py-2 text-xs text-slate-700 space-y-0.5">
            <p>
              Menu:{' '}
              <strong>{menuDish || 'No dish linked for this day'}</strong>
            </p>
            <p>
              Suggested present:{' '}
              <strong className="tabular-nums">{suggested ?? '—'}</strong>
              {enrolled != null ? (
                <span className="text-slate-500">
                  {' '}
                  · enrolled {enrolled.toLocaleString('en-ZA')}
                </span>
              ) : null}
            </p>
            {serveDone ? (
              <p className="text-emerald-800 font-bold inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Already logged for this
                day — you can update numbers
              </p>
            ) : null}
          </div>
        )}

        <label className="block text-xs font-bold uppercase text-slate-500">
          Learners present
          <span className="font-normal normal-case text-slate-400">
            {' '}
            · {formatDayLabel(serveDate)}
          </span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-lg font-black tabular-nums bg-white"
            value={present}
            onChange={(e) => setPresent(e.target.value)}
            inputMode="numeric"
            placeholder={suggested != null ? String(suggested) : '0'}
          />
        </label>
        <button
          type="button"
          disabled={busy || loadingDay}
          onClick={() => void quickServe()}
          className="w-full min-h-[56px] rounded-2xl bg-emerald-600 text-white font-black text-lg disabled:opacity-40 inline-flex items-center justify-center gap-2"
        >
          {busy ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : serveDone ? (
            <>
              <CheckCircle2 className="w-5 h-5" /> Update serve day
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" /> Log serve day
              {isToday ? ' now' : ''}
            </>
          )}
        </button>
      </div>
    </SchoolsPage>
  );
}
