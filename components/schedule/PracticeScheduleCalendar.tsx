'use client';

/**
 * Day / week / month calendar for gym sessions and clinic appointments.
 * Presentational — parent supplies normalized events and optional filters.
 */
import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LayoutGrid,
  List,
} from 'lucide-react';

export type ScheduleEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time?: string | null;
  duration_min?: number | null;
  title: string;
  subtitle?: string;
  person_id?: string | null;
  person_name?: string;
  status?: string;
  public?: boolean;
  meta?: string;
  /** Tailwind-ish tone key */
  tone?: 'violet' | 'teal' | 'sky' | 'emerald' | 'amber' | 'indigo';
};

export type SchedulePerson = {
  id: string;
  name: string;
};

type ViewMode = 'day' | 'week' | 'month';

type Props = {
  events: ScheduleEvent[];
  people?: SchedulePerson[];
  /** Initial date YYYY-MM-DD */
  initialDate?: string;
  accent?: ScheduleEvent['tone'];
  title?: string;
  emptyLabel?: string;
  onSelectDate?: (date: string) => void;
  onSelectEvent?: (ev: ScheduleEvent) => void;
};

const TONE: Record<
  NonNullable<ScheduleEvent['tone']>,
  { chip: string; bar: string; soft: string }
> = {
  violet: {
    chip: 'bg-violet-100 text-violet-900 border-violet-200 dark:bg-violet-950 dark:text-violet-100 dark:border-violet-800',
    bar: 'bg-violet-500',
    soft: 'bg-violet-50/80 dark:bg-violet-950/30',
  },
  teal: {
    chip: 'bg-teal-100 text-teal-900 border-teal-200 dark:bg-teal-950 dark:text-teal-100 dark:border-teal-800',
    bar: 'bg-teal-500',
    soft: 'bg-teal-50/80 dark:bg-teal-950/30',
  },
  sky: {
    chip: 'bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-950 dark:text-sky-100 dark:border-sky-800',
    bar: 'bg-sky-500',
    soft: 'bg-sky-50/80 dark:bg-sky-950/30',
  },
  emerald: {
    chip: 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-800',
    bar: 'bg-emerald-500',
    soft: 'bg-emerald-50/80 dark:bg-emerald-950/30',
  },
  amber: {
    chip: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800',
    bar: 'bg-amber-500',
    soft: 'bg-amber-50/80 dark:bg-amber-950/30',
  },
  indigo: {
    chip: 'bg-indigo-100 text-indigo-900 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-100 dark:border-indigo-800',
    bar: 'bg-indigo-500',
    soft: 'bg-indigo-50/80 dark:bg-indigo-950/30',
  },
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIso(date: string): Date {
  const [y, m, day] = date.split('-').map(Number);
  return new Date(y, (m || 1) - 1, day || 1);
}

function addDays(date: string, n: number): string {
  const d = parseIso(date);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

/** Monday-start week */
function startOfWeek(date: string): string {
  const d = parseIso(date);
  const day = d.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toIsoDate(d);
}

function endTime(ev: ScheduleEvent): string {
  if (ev.end_time) return ev.end_time.slice(0, 5);
  const min = Number(ev.duration_min) || 45;
  const [h, m] = ev.start_time.split(':').map(Number);
  const total = (h || 0) * 60 + (m || 0) + min;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
}

function minutesFromMidnight(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

const HOUR_START = 6;
const HOUR_END = 21;
const HOURS = Array.from(
  { length: HOUR_END - HOUR_START + 1 },
  (_, i) => HOUR_START + i
);

function formatDayLabel(date: string, opts?: { weekday?: boolean }) {
  const d = parseIso(date);
  return d.toLocaleDateString(undefined, {
    weekday: opts?.weekday !== false ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

export function PracticeScheduleCalendar({
  events,
  people = [],
  initialDate,
  accent = 'violet',
  title = 'Schedule',
  emptyLabel = 'Nothing scheduled',
  onSelectDate,
  onSelectEvent,
}: Props) {
  const today = toIsoDate(new Date());
  const [view, setView] = useState<ViewMode>('week');
  const [cursor, setCursor] = useState(initialDate || today);
  const [personFilter, setPersonFilter] = useState('');

  const tone = TONE[accent];

  const filtered = useMemo(() => {
    let list = events.filter((e) => e.status !== 'cancelled');
    if (personFilter) {
      list = list.filter((e) => String(e.person_id || '') === personFilter);
    }
    return list;
  }, [events, personFilter]);

  const weekStart = startOfWeek(cursor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const monthGrid = useMemo(() => {
    const d = parseIso(cursor);
    const y = d.getFullYear();
    const m = d.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    // pad Monday-start
    let startPad = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const cells: string[] = [];
    for (let i = 0; i < startPad; i++) {
      cells.push(addDays(toIsoDate(first), i - startPad));
    }
    for (let day = 1; day <= last.getDate(); day++) {
      cells.push(toIsoDate(new Date(y, m, day)));
    }
    while (cells.length % 7 !== 0) {
      cells.push(addDays(cells[cells.length - 1], 1));
    }
    return cells;
  }, [cursor]);

  const eventsOn = (date: string) =>
    filtered
      .filter((e) => e.date === date)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const rangeLabel = useMemo(() => {
    if (view === 'day') return formatDayLabel(cursor, { weekday: true });
    if (view === 'week') {
      return `${formatDayLabel(weekDays[0])} – ${formatDayLabel(weekDays[6])}`;
    }
    const d = parseIso(cursor);
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [view, cursor, weekDays]);

  const shift = (dir: -1 | 1) => {
    if (view === 'day') setCursor(addDays(cursor, dir));
    else if (view === 'week') setCursor(addDays(cursor, dir * 7));
    else {
      const d = parseIso(cursor);
      d.setMonth(d.getMonth() + dir);
      setCursor(toIsoDate(d));
    }
  };

  const goToday = () => setCursor(today);

  const pickDate = (date: string) => {
    setCursor(date);
    onSelectDate?.(date);
    if (view === 'month') setView('day');
  };

  const EventChip = ({
    ev,
    dense,
  }: {
    ev: ScheduleEvent;
    dense?: boolean;
  }) => {
    const t = TONE[ev.tone || accent];
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelectEvent?.(ev);
        }}
        className={`w-full text-left rounded-lg border px-1.5 py-1 ${t.chip} hover:opacity-90 transition ${
          dense ? 'text-[10px] leading-tight' : 'text-[11px]'
        }`}
        title={`${ev.start_time} ${ev.title}${ev.person_name ? ` · ${ev.person_name}` : ''}`}
      >
        <span className="font-bold tabular-nums">{ev.start_time.slice(0, 5)}</span>
        {!dense ? (
          <span className="text-[9px] opacity-70">–{endTime(ev)}</span>
        ) : null}{' '}
        <span className="font-semibold">{ev.title}</span>
        {ev.person_name && !dense ? (
          <span className="block text-[10px] opacity-80 truncate">
            {ev.person_name}
            {ev.meta ? ` · ${ev.meta}` : ''}
          </span>
        ) : null}
      </button>
    );
  };

  const DayTimeline = ({ date }: { date: string }) => {
    const dayEv = eventsOn(date);
    const pxPerMin = 1.1;
    const totalMin = (HOUR_END - HOUR_START) * 60;
    const height = totalMin * pxPerMin;

    return (
      <div className="relative border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-950">
        <div className="grid" style={{ gridTemplateColumns: '3rem 1fr' }}>
          <div className="border-r border-slate-100 dark:border-slate-800">
            {HOURS.map((h) => (
              <div
                key={h}
                className="text-[10px] text-slate-400 pr-1 text-right font-medium"
                style={{ height: 60 * pxPerMin }}
              >
                {pad(h)}:00
              </div>
            ))}
          </div>
          <div className="relative" style={{ height }}>
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-slate-100 dark:border-slate-800/80"
                style={{ top: (h - HOUR_START) * 60 * pxPerMin }}
              />
            ))}
            {dayEv.map((ev) => {
              const start = minutesFromMidnight(ev.start_time);
              const end = minutesFromMidnight(endTime(ev));
              const top = Math.max(0, (start - HOUR_START * 60) * pxPerMin);
              const h = Math.max(28, (end - start) * pxPerMin);
              const t = TONE[ev.tone || accent];
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onSelectEvent?.(ev)}
                  className={`absolute left-1 right-1 rounded-xl border px-2 py-1 text-left overflow-hidden shadow-sm ${t.chip}`}
                  style={{ top, height: h, minHeight: 28 }}
                >
                  <div className="text-[11px] font-black truncate">
                    {ev.start_time.slice(0, 5)} · {ev.title}
                  </div>
                  {ev.person_name ? (
                    <div className="text-[10px] opacity-80 truncate">
                      {ev.person_name}
                      {ev.subtitle ? ` · ${ev.subtitle}` : ''}
                    </div>
                  ) : null}
                  {ev.meta ? (
                    <div className="text-[10px] opacity-70 truncate">{ev.meta}</div>
                  ) : null}
                </button>
              );
            })}
            {dayEv.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                {emptyLabel}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden ${tone.soft}`}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-950/80 px-3 sm:px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="w-4 h-4 text-slate-500 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-black text-slate-900 dark:text-white truncate">
              {title}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              {rangeLabel} · {filtered.length} event
              {filtered.length === 1 ? '' : 's'}
              {personFilter ? ' (filtered)' : ''}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {people.length > 0 ? (
            <select
              className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold max-w-[10rem]"
              value={personFilter}
              onChange={(e) => setPersonFilter(e.target.value)}
            >
              <option value="">Everyone</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : null}
          <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-600 p-0.5 bg-slate-50 dark:bg-slate-900">
            {(
              [
                ['day', 'Day', List],
                ['week', 'Week', CalendarDays],
                ['month', 'Month', LayoutGrid],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${
                  view === id
                    ? `${tone.bar} text-white`
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => shift(-1)}
              className="rounded-xl border border-slate-200 dark:border-slate-600 p-2 hover:bg-slate-50 dark:hover:bg-slate-800"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="rounded-xl border border-slate-200 dark:border-slate-600 px-2.5 py-1.5 text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => shift(1)}
              className="rounded-xl border border-slate-200 dark:border-slate-600 p-2 hover:bg-slate-50 dark:hover:bg-slate-800"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4 bg-white dark:bg-slate-950">
        {view === 'day' && <DayTimeline date={cursor} />}

        {view === 'week' && (
          <div className="overflow-x-auto">
            <div className="min-w-[640px] grid grid-cols-7 gap-1.5">
              {weekDays.map((date) => {
                const isToday = date === today;
                const isCursor = date === cursor;
                const list = eventsOn(date);
                return (
                  <div
                    key={date}
                    className={`rounded-2xl border min-h-[220px] flex flex-col ${
                      isToday
                        ? 'border-violet-400 dark:border-violet-500'
                        : 'border-slate-200 dark:border-slate-700'
                    } ${isCursor ? tone.soft : 'bg-slate-50/50 dark:bg-slate-900/40'}`}
                  >
                    <button
                      type="button"
                      onClick={() => pickDate(date)}
                      className="px-2 py-2 border-b border-slate-100 dark:border-slate-800 text-left hover:bg-white/60 dark:hover:bg-slate-800/50"
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {parseIso(date).toLocaleDateString(undefined, {
                          weekday: 'short',
                        })}
                      </div>
                      <div
                        className={`text-sm font-black ${
                          isToday ? 'text-violet-700 dark:text-violet-300' : ''
                        }`}
                      >
                        {parseIso(date).getDate()}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {list.length} slot{list.length === 1 ? '' : 's'}
                      </div>
                    </button>
                    <div className="flex-1 p-1 space-y-1 overflow-y-auto max-h-[320px]">
                      {list.length === 0 ? (
                        <p className="text-[10px] text-slate-400 px-1 py-2">—</p>
                      ) : (
                        list.map((ev) => (
                          <EventChip key={ev.id} ev={ev} dense />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === 'month' && (
          <div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div
                  key={d}
                  className="text-center text-[10px] font-black uppercase tracking-wider text-slate-400 py-1"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthGrid.map((date) => {
                const inMonth =
                  parseIso(date).getMonth() === parseIso(cursor).getMonth();
                const isToday = date === today;
                const list = eventsOn(date);
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => pickDate(date)}
                    className={`min-h-[88px] sm:min-h-[100px] rounded-xl border p-1 text-left transition hover:border-violet-300 dark:hover:border-violet-600 ${
                      inMonth
                        ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950'
                        : 'border-transparent bg-slate-50/50 dark:bg-slate-900/30 opacity-50'
                    } ${isToday ? 'ring-2 ring-violet-400/60' : ''}`}
                  >
                    <div
                      className={`text-[11px] font-bold mb-0.5 ${
                        isToday
                          ? 'text-violet-700 dark:text-violet-300'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {parseIso(date).getDate()}
                    </div>
                    <div className="space-y-0.5">
                      {list.slice(0, 3).map((ev) => (
                        <div
                          key={ev.id}
                          className={`truncate rounded px-1 py-0.5 text-[9px] font-semibold border ${
                            TONE[ev.tone || accent].chip
                          }`}
                        >
                          {ev.start_time.slice(0, 5)} {ev.title}
                        </div>
                      ))}
                      {list.length > 3 ? (
                        <div className="text-[9px] font-bold text-slate-400 px-0.5">
                          +{list.length - 3} more
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
