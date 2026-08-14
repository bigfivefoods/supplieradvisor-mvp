'use client';

/**
 * Day / week / month calendar for gym sessions and clinic appointments.
 * Presentational — parent supplies events, people filter, working hours.
 * Day/week height matches practice open hours for the day.
 */
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Download,
  LayoutGrid,
  List,
  Printer,
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
  tone?: 'violet' | 'teal' | 'sky' | 'emerald' | 'amber' | 'indigo' | 'yellow';
};

export type SchedulePerson = {
  id: string;
  name: string;
  /** Optional role / specialty shown in filter dropdown */
  role?: string;
};

/** Practice = whole diary; person = single clinician/coach diary */
export type DiaryScope = 'practice' | 'person';

export type ScheduleViewMode = 'day' | 'week' | 'month';

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
  /** Optional brand line on printed A4 calendars */
  printBrand?: string;
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
  /** Highlight the open event (view/edit) on the grid */
  selectedEventId?: string | null;
  /**
   * Fires when day/week/month cursor or view changes — parents can reload
   * sessions for the visible window (coach calendar, etc.).
   */
  onVisibleRangeChange?: (range: {
    cursor: string;
    view: ScheduleViewMode;
    from: string;
    to: string;
  }) => void;
  /** Hide practice/person scope toggle (e.g. single-coach diary) */
  hideScopeToggle?: boolean;
  /**
   * When set, A4 PDF downloads a real file from the server (pdfkit)
   * instead of only opening the browser print dialog.
   */
  pdfExport?: {
    companyId: number | string;
    module:
      | 'fitgraph'
      | 'dentalgraph'
      | 'medicalgraph'
      | 'physiograph'
      | 'psychiatrygraph';
    personId?: string | null;
  };
};

/**
 * Assign side-by-side columns for concurrent events (same time window).
 * Coaches may train in parallel — do not treat overlaps as conflicts.
 */
function layoutConcurrentEvents(
  events: ScheduleEvent[]
): Array<{ ev: ScheduleEvent; col: number; colCount: number }> {
  if (!events.length) return [];
  const sorted = [...events].sort((a, b) => {
    const t = a.start_time.localeCompare(b.start_time);
    if (t !== 0) return t;
    return (a.person_name || a.title).localeCompare(b.person_name || b.title);
  });

  type Active = { endMin: number; col: number };
  const colEnds: Active[] = [];
  const assigned: Array<{ ev: ScheduleEvent; col: number; startMin: number; endMin: number }> =
    [];

  for (const ev of sorted) {
    const startMin = minutesFromMidnight(ev.start_time);
    const endMin = minutesFromMidnight(endTime(ev));
    // Free columns whose events have ended
    for (let i = colEnds.length - 1; i >= 0; i--) {
      if (colEnds[i].endMin <= startMin) colEnds.splice(i, 1);
    }
    const used = new Set(colEnds.map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;
    colEnds.push({ endMin, col });
    assigned.push({ ev, col, startMin, endMin });
  }

  // For each event, colCount = max concurrent cluster width among overlaps
  return assigned.map((a) => {
    let maxCol = a.col;
    for (const b of assigned) {
      if (a.startMin < b.endMin && b.startMin < a.endMin) {
        maxCol = Math.max(maxCol, b.col);
      }
    }
    return { ev: a.ev, col: a.col, colCount: maxCol + 1 };
  });
}

const TONE: Record<
  NonNullable<ScheduleEvent['tone']>,
  {
    chip: string;
    bar: string;
    soft: string;
    hint: string;
    slotHover: string;
    todayBorder: string;
    todayText: string;
    todayRing: string;
    monthHover: string;
    printBar: string;
    printBg: string;
  }
> = {
  violet: {
    chip: 'bg-violet-100 text-violet-900 border-violet-200 dark:bg-violet-950 dark:text-violet-100 dark:border-violet-800',
    bar: 'bg-violet-500',
    soft: 'bg-violet-50/80 dark:bg-violet-950/30',
    hint: 'text-violet-600 dark:text-violet-300',
    slotHover: 'hover:bg-violet-50/40 dark:hover:bg-violet-950/20',
    todayBorder: 'border-violet-400 dark:border-violet-500',
    todayText: 'text-violet-700 dark:text-violet-300',
    todayRing: 'ring-2 ring-violet-400/60',
    monthHover: 'hover:border-violet-300 dark:hover:border-violet-600',
    printBar: '#7c3aed',
    printBg: '#f5f3ff',
  },
  teal: {
    chip: 'bg-teal-100 text-teal-900 border-teal-200 dark:bg-teal-950 dark:text-teal-100 dark:border-teal-800',
    bar: 'bg-teal-500',
    soft: 'bg-teal-50/80 dark:bg-teal-950/30',
    hint: 'text-teal-600 dark:text-teal-300',
    slotHover: 'hover:bg-teal-50/40 dark:hover:bg-teal-950/20',
    todayBorder: 'border-teal-400 dark:border-teal-500',
    todayText: 'text-teal-700 dark:text-teal-300',
    todayRing: 'ring-2 ring-teal-400/60',
    monthHover: 'hover:border-teal-300 dark:hover:border-teal-600',
    printBar: '#14b8a6',
    printBg: '#f0fdfa',
  },
  sky: {
    chip: 'bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-950 dark:text-sky-100 dark:border-sky-800',
    bar: 'bg-sky-500',
    soft: 'bg-sky-50/80 dark:bg-sky-950/30',
    hint: 'text-sky-600 dark:text-sky-300',
    slotHover: 'hover:bg-sky-50/40 dark:hover:bg-sky-950/20',
    todayBorder: 'border-sky-400 dark:border-sky-500',
    todayText: 'text-sky-700 dark:text-sky-300',
    todayRing: 'ring-2 ring-sky-400/60',
    monthHover: 'hover:border-sky-300 dark:hover:border-sky-600',
    printBar: '#0284c7',
    printBg: '#f0f9ff',
  },
  emerald: {
    chip: 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-800',
    bar: 'bg-emerald-500',
    soft: 'bg-emerald-50/80 dark:bg-emerald-950/30',
    hint: 'text-emerald-600 dark:text-emerald-300',
    slotHover: 'hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20',
    todayBorder: 'border-emerald-400 dark:border-emerald-500',
    todayText: 'text-emerald-700 dark:text-emerald-300',
    todayRing: 'ring-2 ring-emerald-400/60',
    monthHover: 'hover:border-emerald-300 dark:hover:border-emerald-600',
    printBar: '#059669',
    printBg: '#ecfdf5',
  },
  amber: {
    chip: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800',
    bar: 'bg-amber-500',
    soft: 'bg-amber-50/80 dark:bg-amber-950/30',
    hint: 'text-amber-700 dark:text-amber-300',
    slotHover: 'hover:bg-amber-50/40 dark:hover:bg-amber-950/20',
    todayBorder: 'border-amber-400 dark:border-amber-500',
    todayText: 'text-amber-800 dark:text-amber-300',
    todayRing: 'ring-2 ring-amber-400/60',
    monthHover: 'hover:border-amber-300 dark:hover:border-amber-600',
    printBar: '#d97706',
    printBg: '#fffbeb',
  },
  indigo: {
    chip: 'bg-indigo-100 text-indigo-900 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-100 dark:border-indigo-800',
    bar: 'bg-indigo-500',
    soft: 'bg-indigo-50/80 dark:bg-indigo-950/30',
    hint: 'text-indigo-600 dark:text-indigo-300',
    slotHover: 'hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20',
    todayBorder: 'border-indigo-400 dark:border-indigo-500',
    todayText: 'text-indigo-700 dark:text-indigo-300',
    todayRing: 'ring-2 ring-indigo-400/60',
    monthHover: 'hover:border-indigo-300 dark:hover:border-indigo-600',
    printBar: '#4f46e5',
    printBg: '#eef2ff',
  },
  yellow: {
    chip: 'bg-yellow-100 text-yellow-950 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-100 dark:border-yellow-700',
    bar: 'bg-[#E8E830]',
    soft: 'bg-yellow-50/80 dark:bg-yellow-950/30',
    hint: 'text-yellow-800 dark:text-yellow-300',
    slotHover: 'hover:bg-yellow-50/40 dark:hover:bg-yellow-950/20',
    todayBorder: 'border-yellow-400 dark:border-yellow-500',
    todayText: 'text-yellow-800 dark:text-yellow-300',
    todayRing: 'ring-2 ring-yellow-400/60',
    monthHover: 'hover:border-yellow-300 dark:hover:border-yellow-600',
    printBar: '#E8E830',
    printBg: '#fefce8',
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

function openA4Print(opts: {
  title: string;
  brand?: string;
  rangeLabel: string;
  hoursNote?: string;
  orientation: 'landscape' | 'portrait';
  contentHtml: string;
  eventBar?: string;
  eventBg?: string;
}) {
  const w = window.open('', '_blank');
  if (!w) {
    window.alert('Pop-up blocked — allow pop-ups to print the calendar.');
    return;
  }
  const pageSize =
    opts.orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait';
  const safeTitle = opts.title.replace(/</g, '');
  w.document.open();
  w.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="light only" />
  <title>${safeTitle}</title>
  <style>
    @page { size: ${pageSize}; margin: 10mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      background: #ffffff !important;
      color: #0f172a !important;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      font-size: 11px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 10px 12px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .toolbar button {
      font: inherit;
      font-weight: 700;
      font-size: 12px;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid #cbd5e1;
      background: #0f172a;
      color: #fff;
      cursor: pointer;
    }
    .toolbar button.secondary {
      background: #fff;
      color: #0f172a;
    }
    .sheet { padding: 16px; background: #fff; color: #0f172a; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    h1 { font-size: 16px; margin: 0; }
    .meta { font-size: 11px; color: #475569; margin-top: 2px; }
    .brand { font-size: 12px; font-weight: 800; text-align: right; }
    .hours { font-size: 10px; color: #64748b; margin: 0 0 10px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td {
      border: 1px solid #cbd5e1;
      vertical-align: top;
      padding: 4px 5px;
    }
    th {
      background: #f1f5f9;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .day-num { font-weight: 800; font-size: 12px; }
    .closed { background: #f8fafc; color: #94a3b8; }
    .ev {
      border-left: 3px solid ${opts.eventBar || '#7c3aed'};
      background: ${opts.eventBg || '#f5f3ff'};
      margin: 2px 0;
      padding: 2px 4px;
      border-radius: 3px;
      font-size: 9px;
      line-height: 1.25;
      page-break-inside: avoid;
    }
    .ev .t { font-weight: 700; }
    .footer {
      margin-top: 10px;
      font-size: 9px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      .no-print { display: none !important; }
      html, body { background: #ffffff !important; }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button type="button" onclick="window.print()">Print / Save as PDF</button>
    <button type="button" class="secondary" onclick="window.close()">Close</button>
    <span style="font-size:11px;color:#64748b">Preview below · light page (not a blank tab)</span>
  </div>
  <div class="sheet">
    <header>
      <div>
        <h1>${safeTitle}</h1>
        <div class="meta">${opts.rangeLabel.replace(/</g, '')}</div>
      </div>
      <div class="brand">${(opts.brand || 'SupplierAdvisor').replace(/</g, '')}<div class="meta">A4 ${opts.orientation}</div></div>
    </header>
    ${opts.hoursNote ? `<p class="hours">${opts.hoursNote.replace(/</g, '')}</p>` : ''}
    ${opts.contentHtml}
    <div class="footer">
      <span>Generated ${new Date().toLocaleString()}</span>
      <span class="no-print">Click “Print / Save as PDF” above when ready</span>
    </div>
  </div>
</body>
</html>`);
  w.document.close();
  try {
    w.focus();
  } catch {
    /* ignore */
  }
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
  printBrand,
  emptyLabel = 'Nothing scheduled',
  onSelectDate,
  onSelectEvent,
  onSelectSlot,
  slotHint,
  selectedEventId = null,
  onVisibleRangeChange,
  hideScopeToggle = false,
  pdfExport,
}: Props) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const today = toIsoDate(new Date());
  const [view, setView] = useState<ScheduleViewMode>('week');
  const [cursor, setCursor] = useState(initialDate || today);
  const [personFilterLocal, setPersonFilterLocal] = useState(
    personFilterProp || ''
  );
  const [diaryScopeLocal, setDiaryScopeLocal] = useState<DiaryScope>(
    diaryScopeProp || (personFilterProp ? 'person' : 'practice')
  );
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [printMenuPos, setPrintMenuPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const printBtnRef = useRef<HTMLButtonElement>(null);
  const printMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (personFilterProp !== undefined) setPersonFilterLocal(personFilterProp);
  }, [personFilterProp]);

  /** Fixed menu must sit above app sidebar (z-20) + sticky rails */
  useEffect(() => {
    if (!printMenuOpen) return;
    const place = () => {
      const btn = printBtnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const menuW = 220;
      const pad = 8;
      let left = r.right - menuW;
      if (left < pad) left = pad;
      if (left + menuW > window.innerWidth - pad) {
        left = Math.max(pad, window.innerWidth - menuW - pad);
      }
      let top = r.bottom + 6;
      const approxH = 150;
      if (top + approxH > window.innerHeight - pad) {
        top = Math.max(pad, r.top - approxH - 6);
      }
      setPrintMenuPos({ top, left });
    };
    place();
    const onScroll = () => place();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPrintMenuOpen(false);
    };
    const onPointer = (e: Event) => {
      const t = e.target as Node | null;
      if (
        printMenuRef.current?.contains(t) ||
        printBtnRef.current?.contains(t)
      ) {
        return;
      }
      setPrintMenuOpen(false);
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('keydown', onKey);
    // delay so the opening click does not immediately close
    const tid = window.setTimeout(() => {
      document.addEventListener('pointerdown', onPointer, true);
    }, 0);
    return () => {
      window.clearTimeout(tid);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, [printMenuOpen]);

  useEffect(() => {
    if (diaryScopeProp !== undefined) setDiaryScopeLocal(diaryScopeProp);
  }, [diaryScopeProp]);

  /** Keep grid on the day the parent opens (e.g. after selecting an event) */
  useEffect(() => {
    if (initialDate) setCursor(initialDate);
  }, [initialDate]);

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

  const showScope =
    !hideScopeToggle &&
    showDiaryScopeToggle !== false &&
    people.length > 0;
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

  const visibleFromTo = useMemo(() => {
    if (view === 'day') return { from: cursor, to: cursor };
    if (view === 'week') return { from: weekDays[0], to: weekDays[6] };
    return {
      from: monthGrid[0],
      to: monthGrid[monthGrid.length - 1],
    };
  }, [view, cursor, weekDays, monthGrid]);

  useEffect(() => {
    onVisibleRangeChange?.({
      cursor,
      view,
      from: visibleFromTo.from,
      to: visibleFromTo.to,
    });
  }, [cursor, view, visibleFromTo.from, visibleFromTo.to, onVisibleRangeChange]);

  const hoursNote = useMemo(() => {
    if (!workingHours) return 'Operating hours not set — showing default day window.';
    if (view === 'day') {
      const oc = openCloseOn(workingHours, cursor);
      return oc.closed
        ? `Closed on ${formatDayLabel(cursor, { weekday: true })} (per operating hours).`
        : `Operating hours ${oc.open}–${oc.close} on ${formatDayLabel(cursor, { weekday: true })}.`;
    }
    if (view === 'week') {
      const parts = weekDays.map((d) => {
        const oc = openCloseOn(workingHours, d);
        const wd = parseIso(d).toLocaleDateString(undefined, { weekday: 'short' });
        return oc.closed ? `${wd} closed` : `${wd} ${oc.open}–${oc.close}`;
      });
      return `Operating hours: ${parts.join(' · ')}`;
    }
    if (weekBounds.startMinute != null) {
      const o = `${pad(Math.floor(weekBounds.startMinute / 60))}:${pad(weekBounds.startMinute % 60)}`;
      const c = `${pad(Math.floor(weekBounds.endMinute / 60))}:${pad(weekBounds.endMinute % 60)}`;
      return `Practice window (open days): ${o}–${c}. Closed days marked “off”.`;
    }
    return '';
  }, [workingHours, view, cursor, weekDays, weekBounds]);

  const printCalendar = (orientation: 'landscape' | 'portrait') => {
    setPrintMenuOpen(false);
    const esc = (s: string) =>
      String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const eventCell = (date: string) => {
      const list = eventsOn(date);
      const oc = openCloseOn(workingHours, date);
      if (oc.closed) {
        return `<div class="day-num">${parseIso(date).getDate()}</div><div>Closed</div>`;
      }
      const items = list
        .map((ev) => {
          const meta = [ev.person_name, ev.subtitle, ev.meta]
            .filter(Boolean)
            .join(' · ');
          return `<div class="ev"><span class="t">${esc(ev.start_time.slice(0, 5))} ${esc(ev.title)}</span>${
            meta ? `<br/>${esc(meta)}` : ''
          }</div>`;
        })
        .join('');
      return `<div class="day-num">${parseIso(date).getDate()}</div>${items || '<div style="color:#94a3b8">—</div>'}`;
    };

    let contentHtml = '';
    if (view === 'day') {
      const list = eventsOn(cursor);
      const oc = openCloseOn(workingHours, cursor);
      contentHtml = `<table><thead><tr><th style="width:18%">Time</th><th>Event</th><th style="width:28%">Detail</th></tr></thead><tbody>`;
      if (oc.closed) {
        contentHtml += `<tr class="closed"><td colspan="3">Closed · ${esc(formatDayLabel(cursor, { weekday: true }))}</td></tr>`;
      } else if (!list.length) {
        contentHtml += `<tr><td colspan="3">${esc(emptyLabel)}</td></tr>`;
      } else {
        for (const ev of list) {
          contentHtml += `<tr><td>${esc(ev.start_time.slice(0, 5))}${
            ev.end_time ? `–${esc(String(ev.end_time).slice(0, 5))}` : ''
          }</td><td><strong>${esc(ev.title)}</strong>${
            ev.person_name ? `<br/><span style="color:#64748b">${esc(ev.person_name)}</span>` : ''
          }</td><td>${esc([ev.subtitle, ev.meta, ev.status].filter(Boolean).join(' · '))}</td></tr>`;
        }
      }
      contentHtml += `</tbody></table>`;
    } else if (view === 'week') {
      contentHtml = `<table><thead><tr>`;
      for (const d of weekDays) {
        const wd = parseIso(d).toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });
        contentHtml += `<th>${esc(wd)}</th>`;
      }
      contentHtml += `</tr></thead><tbody><tr>`;
      for (const d of weekDays) {
        const closed = isClosedOn(workingHours, d);
        contentHtml += `<td class="${closed ? 'closed' : ''}">${eventCell(d)}</td>`;
      }
      contentHtml += `</tr></tbody></table>`;
    } else {
      contentHtml = `<table><thead><tr>${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        .map((d) => `<th>${d}</th>`)
        .join('')}</tr></thead><tbody>`;
      for (let i = 0; i < monthGrid.length; i += 7) {
        contentHtml += '<tr>';
        for (let j = 0; j < 7; j++) {
          const d = monthGrid[i + j];
          const inMonth =
            parseIso(d).getMonth() === parseIso(cursor).getMonth();
          const closed = isClosedOn(workingHours, d);
          contentHtml += `<td class="${closed || !inMonth ? 'closed' : ''}" style="${
            inMonth ? '' : 'opacity:0.45'
          }">${eventCell(d)}</td>`;
        }
        contentHtml += '</tr>';
      }
      contentHtml += '</tbody></table>';
    }

    openA4Print({
      title: diaryTitle,
      brand: printBrand,
      rangeLabel: `${rangeLabel} · ${view} view · ${filtered.length} event${
        filtered.length === 1 ? '' : 's'
      }`,
      hoursNote,
      orientation,
      contentHtml,
      eventBar: tone.printBar,
      eventBg: tone.printBg,
    });
  };

  const downloadServerPdf = async (
    orientation: 'landscape' | 'portrait'
  ) => {
    if (!pdfExport?.companyId) {
      printCalendar(orientation);
      return;
    }
    setPdfBusy(true);
    try {
      const q = new URLSearchParams({
        companyId: String(pdfExport.companyId),
        module: pdfExport.module,
        kind: 'calendar',
        view,
        from: visibleFromTo.from,
        to: visibleFromTo.to,
        orientation,
      });
      if (pdfExport.personId) q.set('personId', String(pdfExport.personId));
      // Open tab immediately (gesture) so popup blockers do not blank the viewer
      const preview = window.open('about:blank', '_blank');
      const res = await fetch(`/api/schedule/practice-pdf?${q.toString()}`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/pdf' },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        preview?.close();
        throw new Error(
          (err as { error?: string }).error || 'Could not build PDF'
        );
      }
      const buf = await res.arrayBuffer();
      // Force PDF MIME — wrong type yields a blank black/white viewer tab
      const blob = new Blob([buf], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const filename =
        res.headers
          .get('Content-Disposition')
          ?.match(/filename="?([^";]+)"?/)?.[1]
          ?.trim() || `schedule-${view}-${orientation}.pdf`;

      if (preview && !preview.closed) {
        preview.location.href = url;
      } else {
        // Popup blocked — force download instead of a blank tab
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      // Keep blob alive while the PDF viewer loads (revoking early = blank page)
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
      setPrintMenuOpen(false);
    } catch (e) {
      console.error(e);
      // Fall back to printable HTML (never a blank tab)
      printCalendar(orientation);
    } finally {
      setPdfBusy(false);
    }
  };

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
    const selected = selectedEventId === ev.id;
    return (
      <button
        type="button"
        data-schedule-event
        onClick={(e) => {
          e.stopPropagation();
          onSelectEvent?.(ev);
        }}
        className={`w-full text-left rounded-lg border px-1.5 py-1 ${t.chip} hover:opacity-90 transition ${
          dense ? 'text-[10px] leading-tight' : 'text-[11px]'
        } ${
          selected
            ? 'ring-2 ring-offset-1 ring-slate-900 dark:ring-white dark:ring-offset-slate-900 shadow-md'
            : ''
        }`}
        title={`${ev.start_time} ${ev.title}${ev.person_name ? ` · ${ev.person_name}` : ''} — click to open`}
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
                <span className={`${tone.hint} font-bold`}>
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
                  ? `cursor-crosshair ${tone.slotHover}`
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
              {/*
                Concurrent sessions (e.g. multiple coaches training at once)
                are laid out in side-by-side columns — gyms are large enough
                that same-time schedules are normal, not conflicts.
              */}
              {layoutConcurrentEvents(dayEv).map((placed) => {
                const { ev, col, colCount } = placed;
                const start = minutesFromMidnight(ev.start_time);
                const end = minutesFromMidnight(endTime(ev));
                const top = Math.max(0, (start - openMin) * px);
                const h = Math.max(
                  compact ? 18 : 28,
                  Math.min(height - top, (end - start) * px)
                );
                const t = TONE[ev.tone || accent];
                const widthPct = 100 / colCount;
                const leftPct = col * widthPct;
                const selected = selectedEventId === ev.id;
                return (
                  <button
                    key={ev.id}
                    type="button"
                    data-schedule-event
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent?.(ev);
                    }}
                    className={`absolute rounded-lg border px-1 py-0.5 text-left overflow-hidden shadow-sm z-[1] ${t.chip} ${
                      selected
                        ? 'ring-2 ring-offset-1 ring-slate-900 dark:ring-white dark:ring-offset-slate-900 z-[2]'
                        : ''
                    }`}
                    title={`${ev.start_time} ${ev.title} — click to open`}
                    style={{
                      top,
                      height: h,
                      minHeight: compact ? 18 : 28,
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                    }}
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
      ref={rootRef}
      className={`rounded-3xl border border-slate-200 dark:border-slate-700 ${tone.soft}`}
    >
      {/* Toolbar — overflow visible so menus are not clipped */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-950/80 px-3 sm:px-4 py-3 rounded-t-3xl">
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
            {hoursNote ? (
              <div className="text-[10px] text-slate-400 font-medium mt-0.5 line-clamp-2 max-w-xl">
                {hoursNote}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              ref={printBtnRef}
              type="button"
              onClick={() => setPrintMenuOpen((o) => !o)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-600 px-2.5 py-1.5 text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
              title="Download / print A4 calendar"
              aria-expanded={printMenuOpen}
              aria-haspopup="menu"
            >
              <Download className="w-3.5 h-3.5" />
              A4 PDF
            </button>
            {printMenuOpen && printMenuPos ? (
              <div
                ref={printMenuRef}
                role="menu"
                className="fixed z-[400] w-[14.5rem] rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-2xl p-1"
                style={{ top: printMenuPos.top, left: printMenuPos.left }}
              >
                <p className="px-2.5 pt-1.5 pb-0.5 text-[9px] font-black uppercase tracking-wide text-slate-400">
                  Download PDF
                </p>
                <button
                  type="button"
                  role="menuitem"
                  disabled={pdfBusy}
                  className="w-full text-left rounded-lg px-2.5 py-2 text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-2 disabled:opacity-50"
                  onClick={() => void downloadServerPdf('landscape')}
                >
                  <Download className="w-3.5 h-3.5" />
                  A4 landscape PDF
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={pdfBusy}
                  className="w-full text-left rounded-lg px-2.5 py-2 text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-2 disabled:opacity-50"
                  onClick={() => void downloadServerPdf('portrait')}
                >
                  <Download className="w-3.5 h-3.5" />
                  A4 portrait PDF
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                <p className="px-2.5 pt-0.5 pb-0.5 text-[9px] font-black uppercase tracking-wide text-slate-400">
                  Browser print
                </p>
                <button
                  type="button"
                  role="menuitem"
                  className="w-full text-left rounded-lg px-2.5 py-2 text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-2"
                  onClick={() => printCalendar('landscape')}
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print landscape
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="w-full text-left rounded-lg px-2.5 py-2 text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-2"
                  onClick={() => printCalendar('portrait')}
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print portrait
                </button>
                <p className="px-2.5 py-1.5 text-[9px] text-slate-500 leading-snug">
                  PDF uses this day / week / month view, events, and operating
                  hours. Print opens the system dialog (Save as PDF also works
                  there).
                </p>
              </div>
            ) : null}
          </div>
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

      <div className="p-3 sm:p-4 bg-white dark:bg-slate-950 rounded-b-3xl overflow-hidden">
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
                        ? tone.todayBorder
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
                          isToday ? tone.todayText : ''
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
                    className={`min-h-[88px] sm:min-h-[100px] rounded-xl border p-1 text-left transition ${tone.monthHover} ${
                      inMonth
                        ? closed
                          ? 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/80'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950'
                        : 'border-transparent bg-slate-50/50 dark:bg-slate-900/30 opacity-50'
                    } ${isToday ? tone.todayRing : ''}`}
                  >
                    <div
                      className={`text-[11px] font-bold mb-0.5 flex items-center justify-between gap-1 ${
                        isToday
                          ? tone.todayText
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
