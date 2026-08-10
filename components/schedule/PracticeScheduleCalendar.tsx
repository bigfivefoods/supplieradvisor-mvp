'use client';

/**
 * Day / week / month calendar for gym sessions and clinic appointments.
 * Presentational — parent supplies events, people filter, working hours.
 * Day/week height matches practice open hours for the day.
 */
import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LayoutGrid,
  List,
  Stethoscope,
  Building2,
  User,
} from 'lucide-react';
import {
  hourBounds,
  isClosedOn,
  openCloseOn,
  openDurationMinutes,
  type WorkingHours,
} from '@/lib/schedule/working-hours';

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
  /** Optional role / specialty shown in filter dropdown */
  role?: string;
};

/** Practice = whole diary; person = single clinician/coach diary */
export type DiaryScope = 'practice' | 'person';

type ViewMode = 'day' | 'week' | 'month';

type Props = {
  events: ScheduleEvent[];
  people?: SchedulePerson[];
  /**
   * Label for the people filter — e.g. "Dentist", "Coach", "Practitioner".
   */
  peopleLabel?: string;
  /** Practice / gym working hours (dims closed days, sets day timeline bounds) */
  workingHours?: WorkingHours | null;
  /** Initial date YYYY-MM-DD */
  initialDate?: string;
  /** Controlled person filter (optional) */
  personFilter?: string;
  onPersonFilterChange?: (personId: string) => void;
  /** Controlled diary scope */
  diaryScope?: DiaryScope;
  onDiaryScopeChange?: (scope: DiaryScope) => void;
  /**
   * Show Practice diary vs Clinician/Coach diary toggle.
   * Default true when people are provided.
   */
  showDiaryScopeToggle?: boolean;
  accent?: ScheduleEvent['tone'];
  title?: string;
  emptyLabel?: string;
  onSelectDate?: (date: string) => void;
  onSelectEvent?: (ev: ScheduleEvent) => void;
  /**
   * Click empty time on day/week timeline to schedule (snaps to 15 min).
   * Also fires when a month cell is double-used for date-only via onSelectDate.
   */
  onSelectSlot?: (slot: {
    date: string;
    start_time: string;
    person_id?: string | null;
  }) => void;
  /** Hint under day timeline when slots are selectable */
  slotHint?: string;
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

/** px per minute — day strip height = open duration × this */
const PX_PER_MIN = 1.35;

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
  const [h, m] = String(t || '00:00')
    .slice(0, 5)
    .split(':')
    .map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatDayLabel(date: string, opts?: { weekday?: boolean }) {
  const d = parseIso(date);
  return d.toLocaleDateString(undefined, {
    weekday: opts?.weekday !== false ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

/** Hour labels strictly within [startMinute, endMinute] */
function hourTicks(startMinute: number, endMinute: number): number[] {
  const first = Math.ceil(startMinute / 60);
  const last = Math.floor(endMinute / 60);
  const out: number[] = [];
  for (let h = first; h <= last; h++) out.push(h);
  if (out.length === 0) out.push(Math.floor(startMinute / 60));
  return out;
}

export function PracticeScheduleCalendar({
  events,
  people = [],
  peopleLabel = 'person',
  workingHours,
  initialDate,
  personFilter: personFilterProp,
  onPersonFilterChange,
  diaryScope: diaryScopeProp,
  onDiaryScopeChange,
  showDiaryScopeToggle,
  accent = 'violet',
  title = 'Schedule',
  emptyLabel = 'Nothing scheduled',
  onSelectDate,
  onSelectEvent,
  onSelectSlot,
  slotHint,
}: Props) {
  const today = toIsoDate(new Date());
  const [view, setView] = useState<ViewMode>('week');
  const [cursor, setCursor] = useState(initialDate || today);
  const [personFilterLocal, setPersonFilterLocal] = useState(
    personFilterProp || ''
  );
  const [diaryScopeLocal, setDiaryScopeLocal] = useState<DiaryScope>(
    diaryScopeProp || (personFilterProp ? 'person' : 'practice')
  );

  useEffect(() => {
    if (personFilterProp !== undefined) setPersonFilterLocal(personFilterProp);
  }, [personFilterProp]);

  useEffect(() => {
    if (diaryScopeProp !== undefined) setDiaryScopeLocal(diaryScopeProp);
  }, [diaryScopeProp]);

  const personFilter = personFilterProp ?? personFilterLocal;
  const diaryScope = diaryScopeProp ?? diaryScopeLocal;

  const setPersonFilter = (id: string) => {
    setPersonFilterLocal(id);
    onPersonFilterChange?.(id);
  };

  const setDiaryScope = (scope: DiaryScope) => {
    setDiaryScopeLocal(scope);
    onDiaryScopeChange?.(scope);
    if (scope === 'practice') {
      setPersonFilter('');
    } else if (scope === 'person' && !personFilter && people[0]) {
      setPersonFilter(people[0].id);
    }
  };

  const showScope = showDiaryScopeToggle !== false && people.length > 0;
  const tone = TONE[accent];

  const peopleLabelPlural =
    peopleLabel.endsWith('s') || peopleLabel.toLowerCase() === 'staff'
      ? peopleLabel
      : `${peopleLabel}s`;

  const filtered = useMemo(() => {
    let list = events.filter((e) => e.status !== 'cancelled');
    if (diaryScope === 'person' && personFilter) {
      list = list.filter((e) => String(e.person_id || '') === personFilter);
    } else if (diaryScope === 'practice' && personFilter) {
      // optional filter still allowed inside practice view via dropdown
      list = list.filter((e) => String(e.person_id || '') === personFilter);
    }
    return list;
  }, [events, personFilter, diaryScope]);

  const selectedPerson = people.find((p) => p.id === personFilter);

  const diaryTitle =
    diaryScope === 'person' && selectedPerson
      ? `${peopleLabel} diary · ${selectedPerson.name}`
      : diaryScope === 'person'
        ? `${peopleLabel} diary`
        : title;

  // Day view: exact open–close for cursor date (no pad)
  const dayBounds = useMemo(
    () => hourBounds(workingHours, cursor, { pad: false }),
    [workingHours, cursor]
  );

  // Week view: union of open hours across the week (exact)
  const weekStart = startOfWeek(cursor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekBounds = useMemo(() => {
    // Use overall practice hours (no single date) = union of open days
    return hourBounds(workingHours, undefined, { pad: false });
  }, [workingHours]);

  const monthGrid = useMemo(() => {
    const d = parseIso(cursor);
    const y = d.getFullYear();
    const m = d.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const startPad = first.getDay() === 0 ? 6 : first.getDay() - 1;
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

  /**
   * Timeline whose height matches open–close for `date` exactly.
   * Empty area is clickable → onSelectSlot (15-min snap).
   */
  const HoursTimeline = ({
    date,
    compact,
  }: {
    date: string;
    compact?: boolean;
  }) => {
    const dayEv = eventsOn(date);
    const oc = openCloseOn(workingHours, date);
    const closed = oc.closed;
    const openMin = minutesFromMidnight(oc.open);
    const closeMin = minutesFromMidnight(oc.close);
    const duration = closed
      ? 60
      : Math.max(30, closeMin - openMin);
    const height = duration * (compact ? 0.95 : PX_PER_MIN);
    const ticks = closed ? [] : hourTicks(openMin, closeMin);
    const px = compact ? 0.95 : PX_PER_MIN;
    const canPickSlot = Boolean(onSelectSlot) && !closed;

    const handleSlotClick = (e: MouseEvent<HTMLDivElement>) => {
      if (!canPickSlot) return;
      // Ignore clicks that originated on an event button
      const target = e.target as HTMLElement;
      if (target.closest('[data-schedule-event]')) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const rawMin = openMin + y / px;
      // Snap to 15 minutes within open window
      const snapped =
        Math.round(rawMin / 15) * 15;
      const clamped = Math.max(
        openMin,
        Math.min(closeMin - 15, snapped)
      );
      const hh = Math.floor(clamped / 60);
      const mm = clamped % 60;
      const start_time = `${pad(hh)}:${pad(mm)}`;
      onSelectSlot?.({
        date,
        start_time,
        person_id: personFilter || selectedPerson?.id || null,
      });
    };

    return (
      <div
        className={`relative border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-950 ${
          compact ? 'rounded-xl' : ''
        }`}
      >
        {!compact ? (
          closed ? (
            <div className="px-3 py-2 text-[11px] font-bold text-amber-800 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-200 border-b border-amber-100 dark:border-amber-900">
              Closed today (per working hours)
            </div>
          ) : (
            <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 border-b border-slate-100 dark:border-slate-800">
              Open {oc.open} – {oc.close}
              {selectedPerson && diaryScope === 'person'
                ? ` · ${selectedPerson.name}`
                : ''}
              {canPickSlot ? (
                <span className="text-violet-600 dark:text-violet-300 font-bold">
                  {' '}
                  · click empty time to schedule
                </span>
              ) : (
                <span className="text-slate-400 font-normal">
                  {' '}
                  · height matches working hours
                </span>
              )}
            </div>
          )
        ) : null}
        {closed ? (
          <div
            className="flex items-center justify-center text-[10px] text-slate-400 font-medium bg-slate-50 dark:bg-slate-900/50"
            style={{ height: compact ? 48 : 80 }}
          >
            Closed
          </div>
        ) : (
          <div
            className="grid"
            style={{ gridTemplateColumns: compact ? '2rem 1fr' : '3rem 1fr' }}
          >
            <div className="border-r border-slate-100 dark:border-slate-800 relative">
              {ticks.map((h) => {
                const top = (h * 60 - openMin) * px;
                return (
                  <div
                    key={h}
                    className="absolute right-1 text-[9px] text-slate-400 font-medium tabular-nums"
                    style={{ top: Math.max(0, top - 6) }}
                  >
                    {pad(h)}:00
                  </div>
                );
              })}
              <div style={{ height }} />
            </div>
            <div
              className={`relative ${
                canPickSlot
                  ? 'cursor-crosshair hover:bg-violet-50/40 dark:hover:bg-violet-950/20'
                  : ''
              }`}
              style={{ height }}
              onClick={handleSlotClick}
              title={
                canPickSlot
                  ? 'Click to schedule at this time'
                  : undefined
              }
              role={canPickSlot ? 'button' : undefined}
            >
              {ticks.map((h) => {
                const top = (h * 60 - openMin) * px;
                return (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-slate-100 dark:border-slate-800/80 pointer-events-none"
                    style={{ top }}
                  />
                );
              })}
              {/* 15-min guides when picking */}
              {canPickSlot && !compact
                ? Array.from(
                    { length: Math.floor(duration / 15) },
                    (_, i) => openMin + i * 15
                  ).map((m) => {
                    if (m % 60 === 0) return null;
                    const top = (m - openMin) * px;
                    return (
                      <div
                        key={m}
                        className="absolute left-0 right-0 border-t border-dashed border-slate-100/80 dark:border-slate-800/40 pointer-events-none"
                        style={{ top }}
                      />
                    );
                  })
                : null}
              {dayEv.map((ev) => {
                const start = minutesFromMidnight(ev.start_time);
                const end = minutesFromMidnight(endTime(ev));
                const top = Math.max(0, (start - openMin) * px);
                const h = Math.max(
                  compact ? 18 : 28,
                  Math.min(height - top, (end - start) * px)
                );
                const t = TONE[ev.tone || accent];
                return (
                  <button
                    key={ev.id}
                    type="button"
                    data-schedule-event
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent?.(ev);
                    }}
                    className={`absolute left-0.5 right-0.5 rounded-lg border px-1 py-0.5 text-left overflow-hidden shadow-sm z-[1] ${t.chip}`}
                    style={{ top, height: h, minHeight: compact ? 18 : 28 }}
                  >
                    <div
                      className={`font-black truncate ${
                        compact ? 'text-[9px]' : 'text-[11px]'
                      }`}
                    >
                      {ev.start_time.slice(0, 5)}
                      {!compact ? ` · ${ev.title}` : ''}
                    </div>
                    {!compact && ev.person_name ? (
                      <div className="text-[10px] opacity-80 truncate">
                        {ev.person_name}
                        {ev.subtitle ? ` · ${ev.subtitle}` : ''}
                      </div>
                    ) : compact ? (
                      <div className="text-[8px] font-semibold truncate opacity-90">
                        {ev.title}
                      </div>
                    ) : null}
                  </button>
                );
              })}
              {dayEv.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400 pointer-events-none">
                  {canPickSlot
                    ? compact
                      ? 'Tap to add'
                      : slotHint || 'Click a time to schedule'
                    : emptyLabel}
                </div>
              ) : null}
            </div>
          </div>
        )}
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
              {diaryTitle}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              {rangeLabel} · {filtered.length} event
              {filtered.length === 1 ? '' : 's'}
              {diaryScope === 'person' && selectedPerson
                ? ` · ${selectedPerson.name}`
                : diaryScope === 'practice'
                  ? ` · practice diary`
                  : ''}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showScope ? (
            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-600 p-0.5 bg-slate-50 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setDiaryScope('practice')}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${
                  diaryScope === 'practice'
                    ? `${tone.bar} text-white`
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                }`}
                title="Whole practice diary"
              >
                <Building2 className="w-3 h-3" />
                Practice
              </button>
              <button
                type="button"
                onClick={() => setDiaryScope('person')}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${
                  diaryScope === 'person'
                    ? `${tone.bar} text-white`
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                }`}
                title={`${peopleLabel} diary`}
              >
                <Stethoscope className="w-3 h-3" />
                {peopleLabel}
              </button>
            </div>
          ) : null}

          {people.length > 0 &&
          (diaryScope === 'person' || diaryScope === 'practice') ? (
            <label className="inline-flex items-center gap-1.5 min-w-0">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="sr-only">View calendar for {peopleLabel}</span>
              <select
                className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold max-w-[14rem] sm:max-w-[16rem]"
                value={
                  diaryScope === 'person'
                    ? personFilter || people[0]?.id || ''
                    : personFilter
                }
                onChange={(e) => {
                  const id = e.target.value;
                  if (diaryScope === 'person' && !id && people[0]) {
                    setPersonFilter(people[0].id);
                    return;
                  }
                  setPersonFilter(id);
                  if (id && diaryScope === 'practice') {
                    // keep practice mode but filter optional
                  }
                }}
                title={
                  diaryScope === 'person'
                    ? `Select ${peopleLabel.toLowerCase()}`
                    : `Filter by ${peopleLabel.toLowerCase()} (optional)`
                }
              >
                {diaryScope === 'practice' ? (
                  <option value="">All {peopleLabelPlural}</option>
                ) : null}
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.role ? ` · ${p.role}` : ''}
                  </option>
                ))}
              </select>
            </label>
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
        {view === 'day' && <HoursTimeline date={cursor} />}

        {view === 'week' && (
          <div className="overflow-x-auto">
            <div className="min-w-[720px] grid grid-cols-7 gap-1.5">
              {weekDays.map((date) => {
                const isToday = date === today;
                const isCursor = date === cursor;
                const list = eventsOn(date);
                const closed = isClosedOn(workingHours, date);
                const oc = openCloseOn(workingHours, date);
                const openMins = openDurationMinutes(workingHours, date);
                return (
                  <div
                    key={date}
                    className={`rounded-2xl border flex flex-col ${
                      isToday
                        ? 'border-violet-400 dark:border-violet-500'
                        : 'border-slate-200 dark:border-slate-700'
                    } ${
                      closed
                        ? 'bg-slate-100/80 dark:bg-slate-900/70 opacity-80'
                        : isCursor
                          ? tone.soft
                          : 'bg-slate-50/50 dark:bg-slate-900/40'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => pickDate(date)}
                      className="px-2 py-2 border-b border-slate-100 dark:border-slate-800 text-left hover:bg-white/60 dark:hover:bg-slate-800/50 shrink-0"
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
                        {closed
                          ? 'Closed'
                          : `${oc.open}–${oc.close} · ${list.length}`}
                      </div>
                    </button>
                    <div className="p-1 flex-1">
                      <HoursTimeline date={date} compact />
                    </div>
                    {/* spacer so closed vs open columns don't jump wildly: min height from open mins */}
                    {!closed && openMins > 0 ? null : (
                      <div style={{ minHeight: 8 }} />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-slate-400 font-medium">
              Week columns sized to each day&apos;s working hours
              {weekBounds.startMinute != null
                ? ` · practice window ${pad(Math.floor(weekBounds.startMinute / 60))}:${pad(weekBounds.startMinute % 60)}–${pad(Math.floor(weekBounds.endMinute / 60))}:${pad(weekBounds.endMinute % 60)}`
                : ''}
              .
            </p>
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
                const closed = isClosedOn(workingHours, date);
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => pickDate(date)}
                    className={`min-h-[88px] sm:min-h-[100px] rounded-xl border p-1 text-left transition hover:border-violet-300 dark:hover:border-violet-600 ${
                      inMonth
                        ? closed
                          ? 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/80'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950'
                        : 'border-transparent bg-slate-50/50 dark:bg-slate-900/30 opacity-50'
                    } ${isToday ? 'ring-2 ring-violet-400/60' : ''}`}
                  >
                    <div
                      className={`text-[11px] font-bold mb-0.5 flex items-center justify-between gap-1 ${
                        isToday
                          ? 'text-violet-700 dark:text-violet-300'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <span>{parseIso(date).getDate()}</span>
                      {closed && inMonth ? (
                        <span className="text-[8px] font-black uppercase text-slate-400">
                          off
                        </span>
                      ) : null}
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
