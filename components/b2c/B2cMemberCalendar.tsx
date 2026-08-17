'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import {
  downloadMemberCalendarIcs,
  downloadMemberEventIcs,
  type CalendarLinkEvent,
} from '@/lib/b2c/calendar-links';

export type MemberCalEvent = CalendarLinkEvent & {
  source: 'hire' | 'gym' | 'clinic';
  brand: string;
  status?: string;
  google_url?: string;
  outlook_url?: string;
};

function monthMatrix(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  const p = (n: number) => String(n).padStart(2, '0');
  for (let d = 1; d <= days; d++) {
    cells.push(`${year}-${p(month + 1)}-${p(d)}`);
  }
  while (cells.length % 7) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function sourceTone(source: string) {
  if (source === 'hire') return 'bg-cyan-600';
  if (source === 'gym') return 'bg-[#E8E830] text-slate-900';
  return 'bg-teal-600';
}

function groupByDate(events: MemberCalEvent[]) {
  const map = new Map<string, MemberCalEvent[]>();
  for (const e of events) {
    const start = e.date.slice(0, 10);
    const end = (e.end_date || e.date).slice(0, 10);
    let d = start;
    let guard = 0;
    while (d <= end && guard < 120) {
      const list = map.get(d) || [];
      list.push(e);
      map.set(d, list);
      const [y, m, day] = d.split('-').map(Number);
      const next = new Date(y, m - 1, day + 1);
      const p = (n: number) => String(n).padStart(2, '0');
      d = `${next.getFullYear()}-${p(next.getMonth() + 1)}-${p(next.getDate())}`;
      guard += 1;
    }
  }
  return map;
}

export function B2cDiaryView({
  events,
  compact,
  preview,
  onOpenFull,
}: {
  events: MemberCalEvent[];
  compact?: boolean;
  preview?: boolean;
  onOpenFull?: () => void;
}) {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const [cursor, setCursor] = useState({
    y: today.getFullYear(),
    m: today.getMonth(),
  });
  const [picked, setPicked] = useState(todayIso);

  const byDate = useMemo(() => groupByDate(events), [events]);
  const weeks = monthMatrix(cursor.y, cursor.m);
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleString('en-ZA', {
    month: 'long',
    year: 'numeric',
  });
  const dayEvents = byDate.get(picked) || [];
  const upcoming = events.filter((e) => e.date >= todayIso);

  if (preview) {
    return (
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900">Your diary</h2>
          <div className="flex items-center gap-2">
            {events.length > 0 ? (
              <button
                type="button"
                onClick={() => downloadMemberCalendarIcs(events)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0077b6]"
              >
                <Download className="h-3.5 w-3.5" /> All .ics
              </button>
            ) : null}
            {onOpenFull ? (
              <button
                type="button"
                onClick={onOpenFull}
                className="text-[11px] font-bold text-[#0077b6]"
              >
                Open
              </button>
            ) : null}
          </div>
        </div>
        {upcoming.length === 0 ? (
          <button
            type="button"
            onClick={onOpenFull}
            className="w-full rounded-3xl border border-dashed border-sky-200 bg-white px-4 py-4 text-left shadow-sm"
          >
            <p className="text-sm font-black text-slate-900">Nothing booked</p>
            <p className="mt-1 text-[12px] text-slate-500">
              Class times, clinic visits and hire dates land here. Add them to
              Google or Outlook from the diary.
            </p>
          </button>
        ) : (
          <ul className="space-y-2">
            {upcoming.slice(0, 3).map((e) => (
              <li key={`pv-${e.id}`}>
                <EventRow ev={e} />
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black text-slate-900">
          {compact ? 'This month' : 'Your diary'}
        </h2>
        {events.length > 0 ? (
          <button
            type="button"
            onClick={() => downloadMemberCalendarIcs(events)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0077b6]"
          >
            <Download className="h-3.5 w-3.5" /> All .ics
          </button>
        ) : null}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() =>
              setCursor((c) =>
                c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }
              )
            }
            className="rounded-full p-1.5 text-slate-600 hover:bg-slate-100"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-black text-slate-900">{monthLabel}</p>
          <button
            type="button"
            onClick={() =>
              setCursor((c) =>
                c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }
              )
            }
            className="rounded-full p-1.5 text-slate-600 hover:bg-slate-100"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <span key={`${d}-${i}`}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {weeks.flat().map((iso, i) => {
            if (!iso) return <span key={`e-${i}`} />;
            const n = Number(iso.slice(8, 10));
            const has = (byDate.get(iso) || []).length > 0;
            const sel = iso === picked;
            const isToday = iso === todayIso;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setPicked(iso)}
                className={`relative flex h-9 items-center justify-center rounded-xl text-[12px] font-bold ${
                  sel
                    ? 'bg-[#0077b6] text-white'
                    : isToday
                      ? 'bg-sky-50 text-[#0077b6]'
                      : 'text-slate-800 hover:bg-slate-50'
                }`}
              >
                {n}
                {has ? (
                  <span
                    className={`absolute bottom-1 h-1 w-1 rounded-full ${
                      sel ? 'bg-white' : 'bg-cyan-600'
                    }`}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="px-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
          {picked} · {dayEvents.length || 'nothing'} booked
        </p>
        {dayEvents.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-[12px] text-slate-500">
            Free day. Book a class, clinic visit or hire from Places.
          </p>
        ) : (
          dayEvents.map((e) => <EventRow key={`${e.id}-${picked}`} ev={e} />)
        )}
      </div>

      {!compact && upcoming.length > 0 ? (
        <div>
          <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
            Coming up
          </p>
          <ul className="space-y-2">
            {upcoming.slice(0, 8).map((e) => (
              <li key={`up-${e.id}`}>
                <EventRow ev={e} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {events.length === 0 ? (
        <p className="text-center text-[12px] text-slate-500">
          Link a gym, clinic or hire brand — bookings appear here and can go
          to Google, Outlook or Apple Calendar.
        </p>
      ) : null}
    </section>
  );
}

export function B2cMemberCalendar({
  compact,
  preview,
  onOpenFull,
}: {
  compact?: boolean;
  preview?: boolean;
  onOpenFull?: () => void;
}) {
  const [events, setEvents] = useState<MemberCalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/b2c/calendar', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setEvents(Array.isArray(data.events) ? data.events : []);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <p className="rounded-2xl bg-white px-3 py-4 text-center text-sm text-slate-500">
        Loading your diary…
      </p>
    );
  }

  return (
    <B2cDiaryView
      events={events}
      compact={compact}
      preview={preview}
      onOpenFull={onOpenFull}
    />
  );
}

function EventRow({ ev }: { ev: MemberCalEvent }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 rounded-full px-2 py-0.5 text-[9px] font-black uppercase text-white ${sourceTone(ev.source)}`}
        >
          {ev.source}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-900">{ev.title}</p>
          <p className="truncate text-[11px] text-slate-500">
            {ev.brand}
            {ev.start_time ? ` · ${ev.start_time}` : ev.all_day ? ' · all day' : ''}
            {ev.end_date && ev.end_date !== ev.date ? ` → ${ev.end_date}` : ''}
            {ev.status ? ` · ${ev.status}` : ''}
          </p>
        </div>
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-300" />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {ev.href ? (
          <Link
            href={ev.href}
            className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-white"
          >
            Open
          </Link>
        ) : null}
        {ev.google_url ? (
          <a
            href={ev.google_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-700"
          >
            Google
          </a>
        ) : null}
        {ev.outlook_url ? (
          <a
            href={ev.outlook_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-700"
          >
            Outlook
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => downloadMemberEventIcs(ev)}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-700"
        >
          <Download className="h-3 w-3" /> Apple / .ics
        </button>
      </div>
    </article>
  );
}
