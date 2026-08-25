'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { advisorBrandInk } from '@/lib/advisors/brand-ink';
import { addDaysIso } from '@/lib/schedule/recurrence';
import {
  hourRange,
  layoutDayEvents,
  mondayOf,
  type MemberCalendarEvent,
  weekDays,
} from '@/lib/advisors/member-week-calendar';

const HOUR_PX = 48;

function clock(t: string) {
  return String(t || '').slice(0, 5);
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
  const height = hours.length * HOUR_PX;
  const dark = theme === 'dark';
  const colTemplate =
    columns === 'day'
      ? 'grid-cols-[44px_minmax(0,1fr)]'
      : 'grid-cols-[44px_repeat(7,minmax(0,1fr))]';

  return (
    <div className="space-y-3">
      <div
        className={`overflow-x-auto rounded-2xl border ${
          dark ? 'border-white/10 bg-slate-950' : 'border-slate-200 bg-white'
        }`}
      >
        <div className={columns === 'day' ? '' : 'min-w-[640px]'}>
          {hideDayHeader ? null : (
          <div className="flex items-stretch border-b border-black/5 dark:border-white/10">
            {hideNav ? null : (
              <button
                type="button"
                className={`flex w-8 shrink-0 items-center justify-center ${
                  dark ? 'text-white' : 'text-slate-700'
                }`}
                onClick={() => {
                  if (columns === 'day') {
                    const next = addDaysIso(focusDay, -1);
                    onSelectedDay?.(next);
                    setWeekStart(mondayOf(next));
                  } else {
                    setWeekStart(addDaysIso(weekStart, -7));
                  }
                }}
                aria-label={columns === 'day' ? 'Previous day' : 'Previous week'}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div
              className={`grid min-w-0 flex-1 ${
                columns === 'day' ? 'grid-cols-1' : 'grid-cols-7'
              }`}
            >
              {days.map((d) => {
                const isToday = d === today;
                const on =
                  columns === 'day' ||
                  (selectedDay ? d === selectedDay : isToday);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onSelectedDay?.(d)}
                    className={`px-1 py-2 text-center text-[10px] font-black uppercase ${
                      on
                        ? 'bg-[#E8E830] text-slate-950'
                        : isToday
                          ? dark
                            ? 'text-white'
                            : 'text-slate-900'
                          : dark
                            ? 'text-slate-400'
                            : 'text-slate-500'
                    }`}
                  >
                    {dayLabel(d)}
                    <div className="text-sm tabular-nums">
                      {Number(d.slice(8, 10))}
                    </div>
                  </button>
                );
              })}
            </div>
            {hideNav ? null : (
              <button
                type="button"
                className={`flex w-8 shrink-0 items-center justify-center ${
                  dark ? 'text-white' : 'text-slate-700'
                }`}
                onClick={() => {
                  if (columns === 'day') {
                    const next = addDaysIso(focusDay, 1);
                    onSelectedDay?.(next);
                    setWeekStart(mondayOf(next));
                  } else {
                    setWeekStart(addDaysIso(weekStart, 7));
                  }
                }}
                aria-label={columns === 'day' ? 'Next day' : 'Next week'}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
          )}
          <div className={`grid ${colTemplate}`}>
            <div className="relative" style={{ height }}>
              {hours.map((h, i) => (
                <div
                  key={h}
                  className={`absolute left-0 right-0 pr-1 text-right text-[9px] font-bold ${
                    dark ? 'text-slate-500' : 'text-slate-400'
                  }`}
                  style={{ top: i * HOUR_PX - 6 }}
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>
            {days.map((d) => {
              const laid = layoutDayEvents(
                weekEvents.filter((e) => e.date === d)
              );
              return (
                <div
                  key={d}
                  className={`relative border-l ${
                    dark ? 'border-white/10' : 'border-slate-100'
                  }`}
                  style={{ height }}
                >
                  {hours.map((h, i) => (
                    <div
                      key={h}
                      className={`absolute inset-x-0 border-t ${
                        dark ? 'border-white/5' : 'border-slate-100'
                      }`}
                      style={{ top: i * HOUR_PX, height: HOUR_PX }}
                    />
                  ))}
                  {laid.map((row) => {
                    const fill = eventFill(row.ev, color, dark);
                    const top =
                      ((row.startMin - hourStart * 60) / 60) * HOUR_PX;
                    const h = Math.max(
                      22,
                      ((row.endMin - row.startMin) / 60) * HOUR_PX - 2
                    );
                    const width = `calc(${100 / row.colCount}% - 3px)`;
                    const left = `calc(${(row.col * 100) / row.colCount}% + 1px)`;
                    const bg = fill.bg;
                    const fg = fill.fg;
                    return (
                      <button
                        key={row.ev.id}
                        type="button"
                        disabled={busyId === row.ev.id}
                        onClick={() => {
                          setPicked(row.ev);
                          onSelect?.(row.ev);
                        }}
                        className="absolute overflow-hidden rounded-md px-1 py-0.5 text-left shadow-sm"
                        style={{
                          top,
                          height: h,
                          width,
                          left,
                          backgroundColor: bg,
                          color: fg,
                        }}
                      >
                        <p className="truncate text-[9px] font-black leading-tight">
                          {clock(row.ev.start_time)} {row.ev.title}
                        </p>
                        {row.ev.person ? (
                          <p className="truncate text-[8px] opacity-80">
                            {row.ev.person}
                          </p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className={`flex flex-wrap gap-2 text-[10px] font-bold ${
          dark ? 'text-slate-400' : 'text-slate-500'
        }`}
      >
        {kindLegend ? (
          (['class', 'workout', 'client'] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: KIND_FILL[k].bg }}
              />
              {KIND_FILL[k].label}
            </span>
          ))
        ) : (
          <>
            <span className="inline-flex items-center gap-1">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: color }}
              />
              Yours
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-100 ring-1 ring-emerald-300" />
              Open / free
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-200" />
              Full
            </span>
          </>
        )}
      </div>

      {weekEvents.length === 0 ? (
        <p
          className={`rounded-2xl border border-dashed px-4 py-8 text-center text-sm ${
            dark
              ? 'border-white/15 text-slate-400'
              : 'border-slate-300 text-slate-500'
          }`}
        >
          {emptyLabel}
        </p>
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
          <p
            className={`mt-0.5 text-xs ${
              dark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
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
