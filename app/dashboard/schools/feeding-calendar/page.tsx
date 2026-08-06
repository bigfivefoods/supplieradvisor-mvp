'use client';

/**
 * DBE annual NSNP feeding calendar — exact feeding days per month/term/year.
 * Published calendar cascades to schools and service providers; drives MPS day counts.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Printer,
  RefreshCw,
  Save,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';
import {
  dayTypeTone,
  WEEKDAY_LABELS,
  type FeedingCalendarDay,
  type FeedingTerm,
  type MonthSummary,
  type TermSummary,
} from '@/lib/schools/feeding-calendar';

type CalendarRow = {
  id: number;
  year: number;
  name: string;
  status: string;
  default_weekdays: number[];
  terms: FeedingTerm[];
  notes?: string | null;
  published_at?: string | null;
  days: FeedingCalendarDay[];
};

type Summary = {
  year_feeding_days: number;
  months: MonthSummary[];
  terms: TermSummary[];
};

export default function FeedingCalendarPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<'agency' | 'school' | 'isp'>('school');
  const [canEdit, setCanEdit] = useState(false);
  const [calendar, setCalendar] = useState<CalendarRow | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [terms, setTerms] = useState<FeedingTerm[]>([]);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [notes, setNotes] = useState('');
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth() + 1);
  const [pending, setPending] = useState<Map<string, boolean>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/schools/feeding-calendar?companyId=${companyId}&year=${year}`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setRole((data.role || 'school') as 'agency' | 'school' | 'isp');
      setCanEdit(Boolean(data.canEdit));
      setMessage(data.message || null);
      setCalendar(data.calendar || null);
      setSummary(data.summary || null);
      if (data.calendar) {
        setTerms(data.calendar.terms || []);
        setWeekdays(data.calendar.default_weekdays || [1, 2, 3, 4, 5]);
        setNotes(data.calendar.notes || '');
      } else if (data.defaults?.terms) {
        setTerms(data.defaults.terms);
        setWeekdays(data.defaults.weekdays || [1, 2, 3, 4, 5]);
        setNotes('');
      }
      setPending(new Map());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const daysByDate = useMemo(() => {
    const m = new Map<string, FeedingCalendarDay>();
    for (const d of calendar?.days || []) m.set(d.feed_date, d);
    for (const [date, is_feeding] of pending) {
      const prev = m.get(date);
      if (prev) {
        m.set(date, {
          ...prev,
          is_feeding,
          day_type: is_feeding
            ? prev.day_type === 'weekend' || prev.day_type === 'public_holiday'
              ? 'special_feeding'
              : prev.day_type === 'admin_closed' ||
                  prev.day_type === 'school_holiday'
                ? 'school_day'
                : prev.day_type
            : prev.day_type === 'school_day' || prev.day_type === 'special_feeding'
              ? 'admin_closed'
              : prev.day_type,
        });
      }
    }
    return m;
  }, [calendar?.days, pending]);

  const monthGrid = useMemo(() => {
    const first = new Date(year, viewMonth - 1, 1, 12, 0, 0);
    // Monday-first grid
    const startPad = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, viewMonth, 0).getDate();
    const cells: Array<{ date: string | null; day: number | null }> = [];
    for (let i = 0; i < startPad; i++) cells.push({ date: null, day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ date: iso, day: d });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, day: null });
    return cells;
  }, [year, viewMonth]);

  const monthFeeding = useMemo(() => {
    let n = 0;
    for (const c of monthGrid) {
      if (c.date && daysByDate.get(c.date)?.is_feeding) n += 1;
    }
    return n;
  }, [monthGrid, daysByDate]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/schools/feeding-calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, year, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const ensureYear = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const data = await post({ action: 'ensure_year' });
      toast.success(
        data.created
          ? `Created ${year} calendar · ${data.year_feeding_days} feeding days`
          : 'Calendar already exists'
      );
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const saveTerms = async () => {
    if (!canEdit || !calendar) return;
    setSaving(true);
    try {
      await post({
        action: 'save_calendar',
        terms,
        default_weekdays: weekdays,
        notes,
        name: calendar.name,
      });
      toast.success('Terms & settings saved');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async () => {
    if (!canEdit || !calendar) return;
    if (
      !confirm(
        'Regenerate all days from term dates, weekdays, and SA public holidays? Manual day toggles will be reset.'
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const data = await post({
        action: 'regenerate',
        terms,
        default_weekdays: weekdays,
      });
      toast.success(
        `Regenerated · ${data.year_feeding_days} feeding days in ${year}`
      );
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Regenerate failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (date: string) => {
    if (!canEdit || !calendar) return;
    const cur = daysByDate.get(date);
    if (!cur) return;
    setPending((prev) => {
      const next = new Map(prev);
      const base = calendar.days.find((d) => d.feed_date === date);
      const currentFeeding = next.has(date)
        ? Boolean(next.get(date))
        : Boolean(base?.is_feeding);
      const flipped = !currentFeeding;
      // if equals original, remove pending
      if (base && flipped === Boolean(base.is_feeding)) next.delete(date);
      else next.set(date, flipped);
      return next;
    });
  };

  const saveDayEdits = async () => {
    if (!canEdit || !pending.size) return;
    setSaving(true);
    try {
      const days = [...pending.entries()].map(([feed_date, is_feeding]) => {
        const prev = calendar?.days.find((d) => d.feed_date === feed_date);
        return {
          feed_date,
          is_feeding,
          day_type: is_feeding
            ? prev?.day_type === 'weekend' || prev?.day_type === 'public_holiday'
              ? 'special_feeding'
              : 'school_day'
            : prev?.day_type === 'public_holiday'
              ? 'public_holiday'
              : prev?.day_type === 'weekend'
                ? 'weekend'
                : 'admin_closed',
          label: prev?.label,
          term_number: prev?.term_number,
        };
      });
      const data = await post({ action: 'set_days', days });
      toast.success(`Updated ${days.length} day(s) · year total ${data.year_feeding_days}`);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save days failed');
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!canEdit || !calendar) return;
    setSaving(true);
    try {
      if (pending.size) await saveDayEdits();
      const data = await post({ action: 'publish' });
      toast.success(data.message || 'Published');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setSaving(false);
    }
  };

  const unpublish = async () => {
    if (!canEdit || !calendar) return;
    if (!confirm('Unpublish? Schools and SPs will no longer see this calendar.'))
      return;
    setSaving(true);
    try {
      const data = await post({ action: 'unpublish' });
      toast.success(data.message || 'Unpublished');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const updateTerm = (idx: number, patch: Partial<FeedingTerm>) => {
    setTerms((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, ...patch } : t))
    );
  };

  const mode =
    role === 'agency' ? 'agency' : role === 'isp' ? 'isp' : 'school';

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Feeding calendar"
        titleAccent={`${year} · days & terms`}
        mode={mode}
        description={
          role === 'agency'
            ? 'Set exact NSNP feeding days for the year from the school calendar (terms, public holidays, weekends). Publish so schools and SPs plan orders, MPS and claims on the same day counts.'
            : role === 'isp'
              ? 'DBE published feeding days for schools you supply — use for delivery planning and MRP volume.'
              : 'Department feeding days for this year — when NSNP meals are expected.'
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              className="rounded-xl border border-slate-200 px-2 py-1.5 text-sm font-bold hover:bg-slate-50"
              aria-label="Previous year"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-black tabular-nums min-w-[3.5rem] text-center">
              {year}
            </span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              className="rounded-xl border border-slate-200 px-2 py-1.5 text-sm font-bold hover:bg-slate-50"
              aria-label="Next year"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {calendar ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const q = new URLSearchParams({
                      companyId: String(companyId),
                      year: String(year),
                      download: '1',
                    });
                    window.open(
                      `/api/schools/feeding-calendar/pdf?${q}`,
                      '_blank',
                      'noopener,noreferrer'
                    );
                  }}
                  className="btn-primary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                  title="Download annual feeding calendar PDF"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const q = new URLSearchParams({
                      companyId: String(companyId),
                      year: String(year),
                    });
                    window.open(
                      `/api/schools/feeding-calendar/pdf?${q}`,
                      '_blank',
                      'noopener,noreferrer'
                    );
                  }}
                  className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                  title="Open PDF to print"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <Link
              href="/dashboard/schools/recipes"
              className="text-xs font-bold text-[#0077b6] hover:underline px-1"
            >
              MPS / MRP →
            </Link>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading calendar…
        </div>
      ) : !calendar ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-4">
          <CalendarDays className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-800">
            {message || `No feeding calendar for ${year}`}
          </p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {canEdit
              ? 'Create a draft year from SA-style term dates and public holidays, then edit days and publish.'
              : 'Wait for DBE / PEU to publish the annual feeding calendar.'}
          </p>
          {canEdit ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void ensureYear()}
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CalendarDays className="w-4 h-4" />
              )}
              Create {year} feeding calendar
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Status + totals */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Year feeding days"
              value={String(
                summary?.year_feeding_days ??
                  calendar.days.filter((d) => d.is_feeding).length
              )}
              hint={calendar.status === 'published' ? 'Published' : 'Draft'}
            />
            <StatCard
              label="This month"
              value={String(monthFeeding)}
              hint={
                new Date(year, viewMonth - 1, 1).toLocaleString('en-ZA', {
                  month: 'long',
                })
              }
            />
            <StatCard
              label="Terms"
              value={String(terms.length)}
              hint={
                summary?.terms
                  ?.map((t) => `T${t.term}:${t.feeding_days}d`)
                  .join(' · ') || '—'
              }
            />
            <StatCard
              label="Status"
              value={calendar.status === 'published' ? 'Live' : 'Draft'}
              hint={
                calendar.published_at
                  ? `Published ${String(calendar.published_at).slice(0, 10)}`
                  : 'Not visible to schools/SPs until publish'
              }
            />
          </div>

          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveTerms()}
                className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" /> Save terms
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void regenerate()}
                className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Rebuild days from terms
              </button>
              {pending.size > 0 ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveDayEdits()}
                  className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> Save {pending.size} day
                  edit{pending.size === 1 ? '' : 's'}
                </button>
              ) : null}
              {calendar.status !== 'published' ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void publish()}
                  className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" /> Publish to schools & SPs
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void unpublish()}
                  className="btn-secondary !py-2 !px-3 text-xs"
                >
                  Unpublish
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
              Read-only · set by DBE / PEU · used for MPS meal counts and supply
              planning
            </p>
          )}

          {/* Term editor */}
          <div className="rounded-3xl border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-sm font-black">School terms ({year})</p>
            <p className="text-[11px] text-slate-500">
              Feeding days are weekdays inside these term windows, excluding SA
              public holidays. Adjust dates to match the official DBE circular.
            </p>
            <div className="space-y-2">
              {terms.map((t, idx) => (
                <div
                  key={t.term}
                  className="grid sm:grid-cols-4 gap-2 items-end rounded-2xl border border-slate-100 p-2"
                >
                  <label className="text-xs">
                    <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      Term
                    </span>
                    <input
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
                      value={t.name}
                      disabled={!canEdit}
                      onChange={(e) =>
                        updateTerm(idx, { name: e.target.value })
                      }
                    />
                  </label>
                  <label className="text-xs">
                    <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      From
                    </span>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={t.from}
                      disabled={!canEdit}
                      onChange={(e) =>
                        updateTerm(idx, { from: e.target.value })
                      }
                    />
                  </label>
                  <label className="text-xs">
                    <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      To
                    </span>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={t.to}
                      disabled={!canEdit}
                      onChange={(e) => updateTerm(idx, { to: e.target.value })}
                    />
                  </label>
                  <div className="text-xs px-2 py-2">
                    <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      Feeding days
                    </span>
                    <span className="font-black tabular-nums text-sky-800">
                      {summary?.terms?.find((x) => x.term === t.term)
                        ?.feeding_days ?? '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {canEdit ? (
              <div className="flex flex-wrap gap-3 items-center pt-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Feeding weekdays
                </span>
                {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
                  const on = weekdays.includes(wd);
                  return (
                    <button
                      key={wd}
                      type="button"
                      onClick={() =>
                        setWeekdays((prev) =>
                          on
                            ? prev.filter((x) => x !== wd)
                            : [...prev, wd].sort((a, b) => a - b)
                        )
                      }
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold border ${
                        on
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}
                    >
                      {WEEKDAY_LABELS[wd]}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {canEdit ? (
              <label className="block text-xs">
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Notes (visible to schools / SPs when published)
                </span>
                <textarea
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[64px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Aligns with KZN DBE school calendar circular 2026"
                />
              </label>
            ) : notes ? (
              <p className="text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2">
                {notes}
              </p>
            ) : null}
          </div>

          {/* Month summary table */}
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-black">Feeding days per month</p>
              <p className="text-[11px] text-slate-500">
                Click a month to open the day grid
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                    <th className="px-4 py-2">Month</th>
                    <th className="px-3 py-2">Feeding days</th>
                    <th className="px-3 py-2">Non-feeding</th>
                    <th className="px-3 py-2">Terms</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary?.months || []).map((m) => (
                    <tr
                      key={m.month}
                      className={`border-b border-slate-50 cursor-pointer hover:bg-sky-50/50 ${
                        viewMonth === m.month ? 'bg-sky-50/80' : ''
                      }`}
                      onClick={() => setViewMonth(m.month)}
                    >
                      <td className="px-4 py-2 font-semibold">{m.label}</td>
                      <td className="px-3 py-2 tabular-nums font-black text-sky-900">
                        {m.feeding_days}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-500">
                        {m.non_feeding_days}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {m.term_numbers.length
                          ? m.term_numbers.map((t) => `T${t}`).join(', ')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-black">
                    <td className="px-4 py-2">Year total</td>
                    <td className="px-3 py-2 tabular-nums text-sky-900">
                      {summary?.year_feeding_days ?? '—'}
                    </td>
                    <td className="px-3 py-2" colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Month day grid */}
          <div className="rounded-3xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setViewMonth((m) => (m === 1 ? 12 : m - 1))
                  }
                  className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <p className="text-sm font-black min-w-[9rem] text-center">
                  {new Date(year, viewMonth - 1, 1).toLocaleString('en-ZA', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setViewMonth((m) => (m === 12 ? 1 : m + 1))
                  }
                  className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs font-bold text-sky-900">
                {monthFeeding} feeding day{monthFeeding === 1 ? '' : 's'} this
                month
                {canEdit ? ' · click a day to toggle' : ''}
              </p>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-slate-400 mb-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthGrid.map((cell, i) => {
                if (!cell.date) {
                  return <div key={`e-${i}`} className="min-h-[3.25rem]" />;
                }
                const d = daysByDate.get(cell.date);
                const feeding = Boolean(d?.is_feeding);
                const tone = dayTypeTone(
                  d?.day_type || 'school_day',
                  feeding
                );
                return (
                  <button
                    key={cell.date}
                    type="button"
                    disabled={!canEdit}
                    title={
                      d
                        ? `${cell.date} · ${d.day_type}${d.label ? ` · ${d.label}` : ''}${feeding ? ' · FEEDING' : ''}`
                        : cell.date
                    }
                    onClick={() => toggleDay(cell.date!)}
                    className={`min-h-[3.25rem] rounded-xl px-1 py-1.5 text-left transition ${tone} ${
                      canEdit ? 'hover:ring-2 hover:ring-sky-300 cursor-pointer' : 'cursor-default'
                    } ${pending.has(cell.date) ? 'ring-2 ring-amber-400' : ''}`}
                  >
                    <span className="block text-xs font-black tabular-nums">
                      {cell.day}
                    </span>
                    <span className="block text-[9px] leading-tight opacity-90 truncate">
                      {feeding
                        ? 'Feed'
                        : d?.day_type === 'public_holiday'
                          ? 'PH'
                          : d?.day_type === 'school_holiday'
                            ? 'Hol'
                            : d?.day_type === 'weekend'
                              ? ''
                              : 'Off'}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 text-[10px] text-slate-500 pt-1">
              <Legend swatch="bg-sky-600" label="Feeding day" />
              <Legend swatch="bg-rose-100 border border-rose-200" label="Public holiday" />
              <Legend swatch="bg-amber-50 border border-amber-200" label="School holiday" />
              <Legend swatch="bg-slate-50 border border-slate-200" label="Weekend" />
              <Legend swatch="bg-slate-200" label="Admin closed" />
              <Legend swatch="bg-emerald-600" label="Special feeding" />
            </div>
          </div>

          {/* Term totals */}
          {summary?.terms?.length ? (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
              <p className="px-4 py-3 border-b text-sm font-black">
                Feeding days per term
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                    <th className="px-4 py-2">Term</th>
                    <th className="px-3 py-2">Period</th>
                    <th className="px-3 py-2">Feeding days</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.terms.map((t) => (
                    <tr key={t.term} className="border-b border-slate-50">
                      <td className="px-4 py-2 font-semibold">{t.name}</td>
                      <td className="px-3 py-2 text-xs">
                        {t.from} → {t.to}
                      </td>
                      <td className="px-3 py-2 tabular-nums font-black text-sky-900">
                        {t.feeding_days}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}
    </SchoolsPage>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="text-2xl font-black tabular-nums text-slate-900 mt-0.5">
        {value}
      </p>
      {hint ? (
        <p className="text-[11px] text-slate-500 mt-0.5 truncate" title={hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded ${swatch}`} />
      {label}
    </span>
  );
}
