'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { advisorBrandInk } from '@/lib/advisors/brand-ink';
import { addDaysIso } from '@/lib/schedule/recurrence';
import { weekdayFromIso } from '@/lib/schedule/working-hours';
import {
  DAY_CALENDAR_COLUMNS,
  WEEK_CALENDAR_COLUMNS,
  hourRange,
  layoutDayEvents,
  mondayOf,
  type MemberCalendarEvent,
  weekDays,
  weekRangeLabel,
} from '@/lib/advisors/member-week-calendar';

function clock(t: string) {
  return String(t || '').slice(0, 5);
}

function hourLabel(h: number) {
  return `${String(h).padStart(2, '0')}:00`;
}

function dayLabel(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
  });
}

function toneOf(ev: MemberCalendarEvent): 'mine' | 'full' | 'open' {
  if (ev.my_status) return 'mine';
  if (ev.full) return 'full';
  return 'open';
}

const KIND_FILL: Record<
  NonNullable<MemberCalendarEvent['kind']>,
  { bg: string; fg: string; darkBg: string; darkFg: string; label: string }
> = {
  class: {
    bg: '#E8E830',
    fg: '#0f172a',
    darkBg: '#E8E830',
    darkFg: '#0f172a',
    label: 'Class',
  },
  workout: {
    bg: '#c7d2fe',
    fg: '#312e81',
    darkBg: '#3730a3',
    darkFg: '#e0e7ff',
    label: 'Workout',
  },
  client: {
    bg: '#99f6e4',
    fg: '#115e59',
    darkBg: '#0f766e',
    darkFg: '#ccfbf1',
    label: 'Client',
  },
};

function eventFill(
  ev: MemberCalendarEvent,
  color: string,
  dark: boolean
): { bg: string; fg: string } {
  if (ev.kind === 'class') {
    return { bg: color, fg: advisorBrandInk(color) };
  }
  if (ev.kind && KIND_FILL[ev.kind]) {
    const k = KIND_FILL[ev.kind];
    return dark ? { bg: k.darkBg, fg: k.darkFg } : { bg: k.bg, fg: k.fg };
  }
  const tone = toneOf(ev);
  if (tone === 'mine') return { bg: color, fg: advisorBrandInk(color) };
  if (tone === 'full')
    return dark ? { bg: '#7f1d1d', fg: '#fff' } : { bg: '#fecaca', fg: '#0f172a' };
  return dark
    ? { bg: '#1e293b', fg: '#e2e8f0' }
    : { bg: '#ecfdf5', fg: '#0f172a' };
}

export function MemberPortalWeekCalendar({
  events,
  color = '#0f172a',
  allowBooking = true,
  busyId,
  emptyLabel = 'Nothing scheduled this week.',
  theme = 'light',
  onSelect,
  hourStart: hourStartProp,
  hourEnd: hourEndProp,
  weekStart: weekStartProp,
  onWeekChange,
  hideNav = false,
  hideDayHeader = false,
  hidePeek = false,
  columns = 'week',
  selectedDay,
  onSelectedDay,
  kindLegend = false,
  closedWeekdays = [],
  hoursHint,
}: {
  events: MemberCalendarEvent[];
  color?: string;
  allowBooking?: boolean;
  busyId?: string | null;
  emptyLabel?: string;
  theme?: 'light' | 'dark';
  onSelect?: (ev: MemberCalendarEvent) => void;
  hourStart?: number;
  hourEnd?: number;
  weekStart?: string;
  onWeekChange?: (iso: string) => void;
  hideNav?: boolean;
  hideDayHeader?: boolean;
  hidePeek?: boolean;
  columns?: 'week' | 'day';
  selectedDay?: string;
  onSelectedDay?: (iso: string) => void;
  kindLegend?: boolean;
  /** JS weekday indexes (0 = Sun) to dim as closed. */
  closedWeekdays?: number[];
  hoursHint?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [weekStartLocal, setWeekStartLocal] = useState(
    () => weekStartProp || mondayOf(today)
  );
  const weekStart = weekStartProp || weekStartLocal;
  const setWeekStart = (iso: string) => {
    setWeekStartLocal(iso);
    onWeekChange?.(iso);
  };
  const [picked, setPicked] = useState<MemberCalendarEvent | null>(null);
  const week = useMemo(() => weekDays(weekStart), [weekStart]);
  const focusDay = selectedDay || today;
  const days = columns === 'day' ? [focusDay] : week;
  const weekEvents = useMemo(
    () =>
      columns === 'day'
        ? events.filter((e) => e.date === focusDay)
        : events.filter((e) => e.date >= week[0] && e.date <= week[6]),
    [events, columns, focusDay, week]
  );
  const range = hourRange(weekEvents);
  const hourStart = hourStartProp ?? range.start;
  const hourEnd = hourEndProp ?? range.end;
  const hours = Array.from(
    { length: Math.max(1, hourEnd - hourStart) },
    (_, i) => hourStart + i
  );
  const hourCount = hours.length;
  const hourPx = hourCount > 12 ? 34 : hourCount > 10 ? 38 : 44;
  const height = hourCount * hourPx;
  const dark = theme === 'dark';
  const colTemplate =
    columns === 'day' ? DAY_CALENDAR_COLUMNS : WEEK_CALENDAR_COLUMNS;
  const thisWeek = week[0] <= today && today <= week[6];
  const closedSet = useMemo(() => new Set(closedWeekdays), [closedWeekdays]);

  const goPrev = () => {
    if (columns === 'day') {
      const next = addDaysIso(focusDay, -1);
      onSelectedDay?.(next);
      setWeekStart(mondayOf(next));
    } else {
      setWeekStart(addDaysIso(weekStart, -7));
    }
  };
  const goNext = () => {
    if (columns === 'day') {
      const next = addDaysIso(focusDay, 1);
      onSelectedDay?.(next);
      setWeekStart(mondayOf(next));
    } else {
      setWeekStart(addDaysIso(weekStart, 7));
    }
  };

  const inkMuted = dark ? 'text-slate-400' : 'text-slate-500';
  const line = dark ? 'border-white/10' : 'border-slate-200';
  const hair = dark ? 'border-white/5' : 'border-slate-100';

  return (
    <div className="space-y-2">
      {hideNav ? null : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
              dark
                ? 'border-white/15 text-white hover:bg-white/10'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            onClick={goPrev}
            aria-label={columns === 'day' ? 'Previous day' : 'Previous week'}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p
              className={`text-sm font-black tabular-nums ${
                dark ? 'text-white' : 'text-slate-900'
              }`}
            >
              {columns === 'day'
                ? new Date(`${focusDay}T12:00:00`).toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })
                : weekRangeLabel(weekStart)}
            </p>
            <p className={`truncate text-[10px] font-semibold ${inkMuted}`}>
              {hoursHint ||
                (thisWeek
                  ? columns === 'day'
                    ? "Today's hours"
                    : 'This week'
                  : 'Clinic hours')}
            </p>
          </div>
          <button
            type="button"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
              dark
                ? 'border-white/15 text-white hover:bg-white/10'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            onClick={goNext}
            aria-label={columns === 'day' ? 'Next day' : 'Next week'}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {thisWeek ? null : (
            <button
              type="button"
              className={`shrink-0 rounded-full px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide ${
                dark ? 'bg-white/10 text-white' : 'bg-slate-900 text-white'
              }`}
              onClick={() => {
                onSelectedDay?.(today);
                setWeekStart(mondayOf(today));
              }}
            >
              Today
            </button>
          )}
        </div>
      )}

      <div
        className={`overflow-hidden rounded-2xl border shadow-sm ${
          dark ? 'border-white/10 bg-slate-950' : 'border-slate-200 bg-white'
        }`}
      >
        <div
          className="grid w-full"
          style={{ gridTemplateColumns: colTemplate }}
        >
          {hideDayHeader ? null : (
            <>
              <div className={`border-b ${line}`} />
              {days.map((d) => {
                const isToday = d === today;
                const closed = closedSet.has(weekdayFromIso(d));
                const on =
                  columns === 'day' ||
                  (selectedDay ? d === selectedDay : isToday);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onSelectedDay?.(d)}
                    className={`min-w-0 border-b border-l px-0.5 py-1.5 text-center leading-none ${line} ${
                      on
                        ? 'bg-[#E8E830] text-slate-950'
                        : closed
                          ? dark
                            ? 'bg-white/5 text-slate-600'
                            : 'bg-slate-50 text-slate-400'
                          : isToday
                            ? dark
                              ? 'text-white'
                              : 'text-slate-900'
                            : dark
                              ? 'text-slate-400'
                              : 'text-slate-500'
                    }`}
                  >
                    <span className="block text-[9px] font-black uppercase tracking-wide">
                      {dayLabel(d)}
                    </span>
                    <span className="mt-0.5 block text-[13px] font-black tabular-nums">
                      {Number(d.slice(8, 10))}
                    </span>
                    {closed ? (
                      <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-wider opacity-70">
                        Closed
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </>
          )}

          <div className="relative min-w-0" style={{ height }}>
            {hours.map((h, i) => (
              <div
                key={h}
                className={`absolute inset-x-0 ${i === 0 ? '' : `border-t ${hair}`}`}
                style={{ top: i * hourPx, height: hourPx }}
              >
                <span
                  className={`absolute right-0.5 top-0 text-[8px] font-bold tabular-nums leading-none ${
                    dark ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  {hourLabel(h)}
                </span>
              </div>
            ))}
          </div>

          {days.map((d) => {
            const closed = closedSet.has(weekdayFromIso(d));
            const isToday = d === today;
            const laid = layoutDayEvents(
              weekEvents.filter((e) => e.date === d)
            );
            return (
              <div
                key={d}
                className={`relative min-w-0 overflow-hidden border-l ${
                  dark ? 'border-white/10' : 'border-slate-100'
                } ${
                  closed
                    ? dark
                      ? 'bg-white/[0.03]'
                      : 'bg-slate-50/80'
                    : isToday
                      ? dark
                        ? 'bg-white/[0.04]'
                        : 'bg-amber-50/40'
                      : ''
                }`}
                style={{ height }}
              >
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className={`absolute inset-x-0 ${i === 0 ? '' : `border-t ${hair}`}`}
                    style={{ top: i * hourPx, height: hourPx }}
                  />
                ))}
                {laid.map((row) => {
                  const fill = eventFill(row.ev, color, dark);
                  const top =
                    ((row.startMin - hourStart * 60) / 60) * hourPx;
                  const h = Math.max(
                    18,
                    ((row.endMin - row.startMin) / 60) * hourPx - 2
                  );
                  const width = `calc(${100 / row.colCount}% - 2px)`;
                  const left = `calc(${(row.col * 100) / row.colCount}% + 1px)`;
                  return (
                    <button
                      key={row.ev.id}
                      type="button"
                      disabled={busyId === row.ev.id}
                      onClick={() => {
                        setPicked(row.ev);
                        onSelect?.(row.ev);
                      }}
                      className="absolute overflow-hidden rounded px-0.5 py-px text-left shadow-sm"
                      style={{
                        top,
                        height: h,
                        width,
                        left,
                        backgroundColor: fill.bg,
                        color: fill.fg,
                      }}
                    >
                      <p className="truncate text-[8px] font-black leading-tight">
                        {clock(row.ev.start_time)}
                      </p>
                      <p className="truncate text-[8px] font-bold leading-tight opacity-90">
                        {row.ev.title}
                      </p>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold ${inkMuted}`}
      >
        {kindLegend ? (
          (['class', 'workout', 'client'] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-sm"
                style={{ backgroundColor: KIND_FILL[k].bg }}
              />
              {KIND_FILL[k].label}
            </span>
          ))
        ) : (
          <>
            <span className="inline-flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-sm"
                style={{ backgroundColor: color }}
              />
              Yours
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-emerald-100 ring-1 ring-emerald-300" />
              Open
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-rose-200" />
              Full
            </span>
          </>
        )}
      </div>

      {weekEvents.length === 0 ? (
        <p className={`text-center text-xs ${inkMuted}`}>{emptyLabel}</p>
      ) : null}

      {picked && !hidePeek ? (
        <div
          className={`rounded-2xl border p-3 ${
            dark
              ? 'border-white/10 bg-white/5 text-white'
              : 'border-slate-200 bg-white'
          }`}
        >
          <p className="text-sm font-black">
            {clock(picked.start_time)}
            {picked.end_time ? `–${clock(picked.end_time)}` : ''} · {picked.title}
          </p>
          <p className={`mt-0.5 text-xs ${inkMuted}`}>
            {picked.date}
            {picked.person ? ` · ${picked.person}` : ''}
            {picked.location ? ` · ${picked.location}` : ''}
          </p>
          <p className="mt-1 text-[11px] font-bold">
            {picked.my_status
              ? `You are ${picked.my_status}`
              : picked.full
                ? 'Full — waitlist if the desk allows'
                : allowBooking
                  ? 'Open slot'
                  : 'View only'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
