'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

type Slot = {
  id: string;
  date: string;
  start_time: string;
  end_time?: string;
  service_name: string;
  practitioner_name?: string | null;
  full: boolean;
  virtual?: boolean;
};

type Calendar = {
  company_id: number;
  kind: string;
  brand: string;
  shared: boolean;
  join_status?: string;
  require_accept?: boolean;
  slots: Slot[];
};

export function B2cAdvisorBook({
  companyId,
  kind,
  onNeedJoin,
}: {
  companyId: number;
  kind: string;
  onNeedJoin?: () => void;
}) {
  const [cals, setCals] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needJoin, setNeedJoin] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const today = new Date();
  const [cursor, setCursor] = useState({
    y: today.getFullYear(),
    m: today.getMonth(),
  });
  const [picked, setPicked] = useState(today.toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNeedJoin(false);
    try {
      const q = new URLSearchParams({
        company: String(companyId),
        kind,
      });
      const res = await fetch(`/api/b2c/advisor-calendar?${q}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 404 && data.code === 'need_join') {
        setNeedJoin(true);
        setCals([]);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Could not load diary');
      setCals(Array.isArray(data.calendars) ? data.calendars : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load diary');
    } finally {
      setLoading(false);
    }
  }, [companyId, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const cal = cals[0];
  const slots = cal?.slots || [];
  const byDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const list = map.get(s.date) || [];
      list.push(s);
      map.set(s.date, list);
    }
    return map;
  }, [slots]);

  const weeks = monthMatrix(cursor.y, cursor.m);
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleString('en-ZA', {
    month: 'long',
    year: 'numeric',
  });
  const daySlots = (byDate.get(picked) || []).filter((s) => !s.full);

  const book = async (slotId: string) => {
    setBusyId(slotId);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch('/api/b2c/advisor-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: companyId,
          kind,
          slot_id: slotId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not book');
      setMsg(data.message || 'Booked');
      void load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not book');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-[#0077b6]" />
      </div>
    );
  }

  if (needJoin) {
    return (
      <div className="rounded-3xl border border-sky-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-black text-slate-900">
          Link this practice first
        </p>
        <p className="mt-1 text-[12px] text-slate-500">
          Accept the join so they can see you on their desk, then book from
          their shared diary.
        </p>
        {onNeedJoin ? (
          <button
            type="button"
            onClick={onNeedJoin}
            className="mt-3 w-full rounded-2xl bg-[#0077b6] py-3 text-sm font-black text-white"
          >
            Join & continue
          </button>
        ) : null}
      </div>
    );
  }

  if (!cal) {
    return (
      <p className="rounded-2xl bg-white px-3 py-4 text-center text-sm text-slate-500">
        No advisor diary on this account.
      </p>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
          Book with
        </p>
        <h2 className="text-lg font-black text-slate-900">{cal.brand}</h2>
        {!cal.shared ? (
          <p className="mt-1 text-[12px] text-amber-800">
            This practice has not shared a bookable diary yet.
          </p>
        ) : cal.require_accept && cal.join_status === 'pending' ? (
          <p className="mt-1 text-[12px] text-amber-800">
            Waiting for the practice to accept you — then you can book.
          </p>
        ) : (
          <p className="mt-1 text-[12px] text-slate-500">
            Open times from their calendar. Personal time is hidden.
          </p>
        )}
      </div>

      {error ? (
        <p className="rounded-2xl bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
          {error}
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
          {msg}
        </p>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() =>
              setCursor((c) =>
                c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }
              )
            }
            className="rounded-full p-1.5 text-slate-600"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-black">{monthLabel}</p>
          <button
            type="button"
            onClick={() =>
              setCursor((c) =>
                c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }
              )
            }
            className="rounded-full p-1.5 text-slate-600"
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
            const has = (byDate.get(iso) || []).some((s) => !s.full);
            const sel = iso === picked;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setPicked(iso)}
                className={`relative flex h-9 items-center justify-center rounded-xl text-[12px] font-bold ${
                  sel
                    ? 'bg-[#0077b6] text-white'
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
          {picked} · {daySlots.length || 'no'} open
        </p>
        {daySlots.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-[12px] text-slate-500">
            No free times this day. Try another date.
          </p>
        ) : (
          daySlots.map((s) => (
            <article
              key={s.id}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                <CalendarDays className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-slate-900">
                  {s.start_time}
                  {s.end_time ? `–${s.end_time}` : ''} · {s.service_name}
                </span>
                <span className="block text-[11px] text-slate-500">
                  {s.practitioner_name || cal.brand}
                </span>
              </span>
              <button
                type="button"
                disabled={Boolean(busyId) || cal.join_status === 'pending'}
                onClick={() => void book(s.id)}
                className="rounded-full bg-[#0077b6] px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-50"
              >
                {busyId === s.id ? '…' : 'Book'}
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

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
