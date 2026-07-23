'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { CalendarRange, ChevronDown, SlidersHorizontal } from 'lucide-react';
import {
  DEFAULT_FY_START_MONTH,
  fiscalYearLabel,
  fiscalYearMonths,
  fiscalYearQuarters,
  normalizeFyStartMonth,
  resolvePeriodPreset,
  type PeriodPreset,
} from '@/lib/accounting/fiscal';
import { Panel } from '@/components/relationship/RelationshipChrome';

export type PeriodSlicerValue = {
  from: string;
  to: string;
  label: string;
  /** Tracks how the range was last set */
  preset: PeriodPreset | 'trailing';
  /** Multi-select month keys = month `from` (YYYY-MM-DD) */
  selectedMonthFroms: string[];
  /** Multi-select fiscal quarters 1–4 */
  selectedQuarters: number[];
  /** Trailing history window (for trends/forecast) */
  historyMonths?: number;
};

const HISTORY_OPTIONS = [3, 6, 12, 18, 24, 36] as const;

export function initialPeriodSlicerValue(
  preset: Exclude<PeriodPreset, 'custom'> = 'this_month',
  fyStartMonth: number = DEFAULT_FY_START_MONTH
): PeriodSlicerValue {
  const sm = normalizeFyStartMonth(fyStartMonth);
  const range = resolvePeriodPreset(preset, new Date(), sm);
  const months = fiscalYearMonths(new Date(), sm);
  const quarters = fiscalYearQuarters(new Date(), sm);
  const match = months.find((m) => m.from === range.from && m.to === range.to);
  const qMatch = quarters.find((q) => q.from === range.from && q.to === range.to);
  const monthFroms = match
    ? [match.from]
    : qMatch
      ? months
          .filter((m) => {
            const start = (qMatch.quarter - 1) * 3;
            return m.monthIndex >= start && m.monthIndex < start + 3;
          })
          .map((m) => m.from)
      : range.preset === 'ytd' || range.preset === 'full_fy'
        ? months.filter((m) => m.from >= range.from && m.from <= range.to).map((m) => m.from)
        : [];
  return {
    from: range.from,
    to: range.to,
    label: range.label,
    preset: range.preset,
    selectedMonthFroms: monthFroms,
    selectedQuarters: qMatch ? [qMatch.quarter] : [],
    historyMonths: 12,
  };
}

function labelForMonths(
  selected: Array<{ from: string; to: string; label: string }>
): string {
  if (!selected.length) return 'Custom period';
  if (selected.length === 1) {
    const m = selected[0];
    return `${m.label} ${m.from.slice(0, 4)}`;
  }
  const first = selected[0];
  const last = selected[selected.length - 1];
  const y0 = first.from.slice(0, 4);
  const y1 = last.to.slice(0, 4);
  const yearBit = y0 === y1 ? y0 : `${y0}/${y1.slice(2)}`;
  if (selected.length <= 4) {
    return `${selected.map((s) => s.label).join(' + ')} ${yearBit}`;
  }
  return `${selected.length} months · ${first.label}–${last.label} ${yearBit}`;
}

function rangeFromSelectedMonths(
  monthFroms: string[],
  allMonths: ReturnType<typeof fiscalYearMonths>
): { from: string; to: string; label: string } | null {
  const selected = allMonths
    .filter((m) => monthFroms.includes(m.from))
    .sort((a, b) => a.from.localeCompare(b.from));
  if (!selected.length) return null;
  return {
    from: selected[0].from,
    to: selected[selected.length - 1].to,
    label: labelForMonths(selected),
  };
}

function monthsInQuarter(
  q: number,
  allMonths: ReturnType<typeof fiscalYearMonths>
): string[] {
  // FY: Q1 Mar–May (0–2), Q2 Jun–Aug (3–5), Q3 Sep–Nov (6–8), Q4 Dec–Feb (9–11)
  const start = (q - 1) * 3;
  return allMonths.filter((m) => m.monthIndex >= start && m.monthIndex < start + 3).map((m) => m.from);
}

type Props = {
  value: PeriodSlicerValue;
  onChange: (next: PeriodSlicerValue) => void;
  /** Show trailing 3–36m chips (reports trends/forecast) */
  showTrailing?: boolean;
  /** Extra block under the slicer (forecast variables, pipeline toggle, etc.) */
  footer?: ReactNode;
  className?: string;
  /** Start expanded (default collapsed to free vertical space) */
  defaultOpen?: boolean;
  /**
   * Financial year start month (1–12). Defaults to March (SA).
   * Load from accounting_settings.fiscal_year_start_month.
   */
  fyStartMonth?: number;
};

/**
 * Shared accounting period slicer — expandable slice-and-dice control.
 * When open: months + quarters + FY shortcuts (multi-select).
 * Collapsed header always shows active period label and range.
 */
export default function PeriodSlicer({
  value,
  onChange,
  showTrailing = false,
  footer,
  className = 'mb-6',
  defaultOpen = false,
  fyStartMonth = DEFAULT_FY_START_MONTH,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const sm = normalizeFyStartMonth(fyStartMonth);
  const fyLabel = useMemo(() => fiscalYearLabel(new Date(), sm), [sm]);
  const fyMonths = useMemo(() => fiscalYearMonths(new Date(), sm), [sm]);
  const fyQuarters = useMemo(() => fiscalYearQuarters(new Date(), sm), [sm]);

  const applyPreset = (p: Exclude<PeriodPreset, 'custom'>) => {
    const range = resolvePeriodPreset(p, new Date(), sm);
    const match = fyMonths.find((m) => m.from === range.from && m.to === range.to);
    const qMatch = fyQuarters.find((q) => q.from === range.from && q.to === range.to);
    onChange({
      ...value,
      from: range.from,
      to: range.to,
      label: range.label,
      preset: range.preset,
      selectedMonthFroms: match
        ? [match.from]
        : qMatch
          ? monthsInQuarter(qMatch.quarter, fyMonths)
          : range.preset === 'ytd' || range.preset === 'full_fy'
            ? fyMonths
                .filter((m) => m.from >= range.from && m.to <= range.to)
                .map((m) => m.from)
            : [],
      selectedQuarters: qMatch ? [qMatch.quarter] : [],
    });
  };

  const applyCustomRange = (from: string, to: string, label: string) => {
    onChange({
      ...value,
      from,
      to,
      label,
      preset: 'custom',
      selectedMonthFroms: [],
      selectedQuarters: [],
    });
  };

  const toggleMonth = (monthFrom: string) => {
    const has = value.selectedMonthFroms.includes(monthFrom);
    let nextKeys: string[];
    if (has) {
      nextKeys = value.selectedMonthFroms.filter((k) => k !== monthFrom);
      // Keep at least one month if clearing would empty — switch to single re-add? allow empty → fall back this month
      if (!nextKeys.length) {
        applyPreset('this_month');
        return;
      }
    } else {
      nextKeys = [...value.selectedMonthFroms, monthFrom].sort();
    }
    const range = rangeFromSelectedMonths(nextKeys, fyMonths);
    if (!range) return;

    // Derive which quarters are fully covered
    const selectedSet = new Set(nextKeys);
    const fullQs = ([1, 2, 3, 4] as const).filter((q) => {
      const keys = monthsInQuarter(q, fyMonths);
      return keys.length > 0 && keys.every((k) => selectedSet.has(k));
    });

    onChange({
      ...value,
      from: range.from,
      to: range.to,
      label: range.label,
      preset: 'custom',
      selectedMonthFroms: nextKeys,
      selectedQuarters: fullQs,
    });
  };

  const toggleQuarter = (q: number) => {
    const qKeys = monthsInQuarter(q, fyMonths);
    const fullySelected = qKeys.every((k) => value.selectedMonthFroms.includes(k));
    let nextKeys: string[];
    if (fullySelected) {
      // Deselect months in this quarter
      nextKeys = value.selectedMonthFroms.filter((k) => !qKeys.includes(k));
      if (!nextKeys.length) {
        applyPreset('this_month');
        return;
      }
    } else {
      // Add all months in quarter (multi)
      nextKeys = Array.from(new Set([...value.selectedMonthFroms, ...qKeys])).sort();
    }
    const range = rangeFromSelectedMonths(nextKeys, fyMonths);
    if (!range) return;
    const selectedSet = new Set(nextKeys);
    const fullQs = ([1, 2, 3, 4] as const).filter((qq) => {
      const keys = monthsInQuarter(qq, fyMonths);
      return keys.every((k) => selectedSet.has(k));
    });
    onChange({
      ...value,
      from: range.from,
      to: range.to,
      label: range.label,
      preset: 'custom',
      selectedMonthFroms: nextKeys,
      selectedQuarters: fullQs,
    });
  };

  const chip = (
    active: boolean,
    onClick: () => void,
    label: string,
    opts?: { title?: string; current?: boolean }
  ) => (
    <button
      type="button"
      onClick={onClick}
      title={opts?.title}
      className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
          : opts?.current
            ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900'
            : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <Panel className={`${className} overflow-hidden ${open ? 'ring-1 ring-[#00b4d8]/15 shadow-sm' : ''}`}>
      {/* Collapsed / expanded header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 sm:py-4 text-left hover:bg-sky-50/40 transition-colors"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-100 bg-gradient-to-br from-sky-50 to-cyan-50 text-[#0077b6]">
          <SlidersHorizontal className="w-4.5 h-4.5 w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
              Slice &amp; dice
            </span>
            {value.selectedMonthFroms.length > 1 && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-cyan-100 bg-cyan-50 text-[#0077b6]">
                {value.selectedMonthFroms.length} months
              </span>
            )}
            {value.historyMonths != null && showTrailing && (
              <span className="text-[10px] font-semibold text-neutral-400">
                · trail {value.historyMonths}m
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 min-w-0">
            <CalendarRange className="w-3.5 h-3.5 text-[#00b4d8] shrink-0 hidden sm:inline" />
            <span className="font-bold text-slate-900 text-sm truncate">{value.label}</span>
            <span className="text-xs text-neutral-400 tabular-nums whitespace-nowrap">
              {value.from} → {value.to}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            FY {fyLabel}
          </span>
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-500 transition-transform duration-200 ${
              open ? 'rotate-180 text-[#00b4d8] border-cyan-200' : ''
            }`}
          >
            <ChevronDown className="w-4 h-4" />
          </span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-4 pt-1 space-y-4 border-t border-neutral-100 bg-white/80">
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
            <p className="text-[11px] text-neutral-500">
              Expand months / quarters / presets to change the reporting window.
            </p>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              FY {fyLabel} · Mar–Feb
            </div>
          </div>

          {/* Quick presets */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">
              Quick presets
            </div>
            <div className="flex flex-wrap gap-2">
              {chip(value.preset === 'this_month' && value.selectedMonthFroms.length <= 1, () => applyPreset('this_month'), 'This month')}
              {chip(value.preset === 'last_month' && value.selectedMonthFroms.length <= 1, () => applyPreset('last_month'), 'Last month')}
              {chip(value.preset === 'this_quarter', () => applyPreset('this_quarter'), 'This quarter')}
              {chip(value.preset === 'last_quarter', () => applyPreset('last_quarter'), 'Last quarter')}
              {chip(value.preset === 'ytd', () => applyPreset('ytd'), 'YTD')}
              {chip(value.preset === 'full_fy', () => applyPreset('full_fy'), `Full FY ${fyLabel}`)}
              {chip(value.label.startsWith('Full FY') && value.preset === 'custom' && value.selectedMonthFroms.length === 0, () => {
                const currentStart = resolvePeriodPreset('full_fy').from;
                const [y, m, d] = currentStart.split('-').map(Number);
                const lastDayPrior = new Date(y, m - 1, d);
                lastDayPrior.setDate(lastDayPrior.getDate() - 1);
                const prior = resolvePeriodPreset('full_fy', lastDayPrior);
                applyCustomRange(prior.from, prior.to, prior.label);
              }, 'Prior FY')}
              {chip(value.label.startsWith('Calendar'), () => {
                const y = new Date().getFullYear();
                applyCustomRange(`${y}-01-01`, `${y}-12-31`, `Calendar ${y}`);
              }, `Calendar ${new Date().getFullYear()}`)}
            </div>
          </div>

          {/* Months — multi-select */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Months in FY {fyLabel} · multi-select
              </div>
              {value.selectedMonthFroms.length > 0 && (
                <button
                  type="button"
                  onClick={() => applyPreset('this_month')}
                  className="text-[10px] font-semibold text-[#00b4d8] hover:underline"
                >
                  Clear multi → this month
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {fyMonths.map((m) => {
                const active = value.selectedMonthFroms.includes(m.from);
                return (
                  <button
                    key={m.from}
                    type="button"
                    onClick={() => toggleMonth(m.from)}
                    title={`${m.from} → ${m.to} · click to toggle`}
                    className={`min-w-[3rem] text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition-colors ${
                      active
                        ? 'border-[#00b4d8] bg-[#00b4d8]/15 text-[#0077b6] ring-1 ring-[#00b4d8]/30'
                        : m.isCurrent
                          ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900'
                          : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/40'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-neutral-400">
              Click multiple months to combine (e.g. Mar + Apr + May). Range uses earliest → latest.
            </p>
          </div>

          {/* Quarters — multi-select */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">
              Quarters in FY {fyLabel} · multi-select
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {fyQuarters.map((q) => {
                const active = value.selectedQuarters.includes(q.quarter);
                const partial =
                  !active &&
                  monthsInQuarter(q.quarter, fyMonths).some((k) =>
                    value.selectedMonthFroms.includes(k)
                  );
                return (
                  <button
                    key={q.quarter}
                    type="button"
                    onClick={() => toggleQuarter(q.quarter)}
                    className={`text-left rounded-2xl border px-3 py-3 transition-colors ${
                      active
                        ? 'border-[#00b4d8] bg-[#00b4d8]/10 shadow-sm ring-1 ring-[#00b4d8]/25'
                        : partial
                          ? 'border-cyan-200 bg-cyan-50/40'
                          : q.isCurrent
                            ? 'border-emerald-200 bg-emerald-50/40'
                            : 'border-neutral-200 bg-white hover:border-[#00b4d8]/40'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">{q.label}</div>
                    <div className="text-[10px] text-neutral-400 mt-1 tabular-nums">
                      {q.from} → {q.to}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Trailing history — optional */}
          {showTrailing && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                Trailing history (trends & forecast)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {HISTORY_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...value,
                        historyMonths: n,
                        preset: 'trailing',
                        label: `Trailing ${n} months`,
                      })
                    }
                    className={`min-w-[3rem] text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition-colors ${
                      value.historyMonths === n && value.preset === 'trailing'
                        ? 'border-[#00b4d8] bg-[#00b4d8]/10 text-[#0077b6]'
                        : value.historyMonths === n
                          ? 'border-cyan-200 bg-cyan-50/50 text-[#0077b6]'
                          : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/40'
                    }`}
                  >
                    {n}m
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-neutral-400">
                Used by Trends and Forecast as the look-back window (independent of month multi-select).
              </p>
            </div>
          )}

          {/* Custom dates */}
          <div className="flex flex-wrap gap-3 items-end pt-1 border-t border-neutral-100">
            <label className="text-xs font-semibold text-neutral-600">
              From
              <input
                type="date"
                value={value.from}
                onChange={(e) =>
                  onChange({
                    ...value,
                    from: e.target.value,
                    label: 'Custom period',
                    preset: 'custom',
                    selectedMonthFroms: [],
                    selectedQuarters: [],
                  })
                }
                className="mt-1 block rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-neutral-600">
              To
              <input
                type="date"
                value={value.to}
                onChange={(e) =>
                  onChange({
                    ...value,
                    to: e.target.value,
                    label: 'Custom period',
                    preset: 'custom',
                    selectedMonthFroms: [],
                    selectedQuarters: [],
                  })
                }
                className="mt-1 block rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          {footer}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-neutral-500 hover:text-[#0077b6] px-3 py-1.5 rounded-full border border-neutral-200 bg-white hover:border-[#00b4d8]/40"
            >
              Collapse slicer
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
