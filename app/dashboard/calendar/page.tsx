'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';
import { weekBounds, type CompanyCalendarEvent } from '@/lib/core-os/calendar';

const SOURCE_TONE: Record<string, string> = {
  gym: 'bg-amber-50 text-amber-900 border-amber-100',
  clinic: 'bg-sky-50 text-sky-900 border-sky-100',
  hire: 'bg-violet-50 text-violet-900 border-violet-100',
  leave: 'bg-rose-50 text-rose-900 border-rose-100',
  delivery: 'bg-emerald-50 text-emerald-900 border-emerald-100',
  recall: 'bg-slate-50 text-slate-700 border-slate-200',
};

export default function CompanyCalendarPage() {
  const companyId = getSelectedCompanyId();
  const initial = weekBounds();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [events, setEvents] = useState<CompanyCalendarEvent[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        from,
        to,
      });
      const res = await fetch(`/api/core/company-calendar?${params}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const days = useMemo(() => {
    const out: string[] = [];
    let d = from;
    while (d <= to) {
      out.push(d);
      const n = new Date(`${d}T12:00:00`);
      n.setDate(n.getDate() + 1);
      d = n.toISOString().slice(0, 10);
    }
    return out;
  }, [from, to]);

  const visible = events.filter((e) => filter === 'all' || e.source === filter);

  return (
    <RelationshipPage>
      <RelationshipHeader
        title="Company"
        titleAccent="calendar"
        description="One week across GymAdvisor, clinics, hire, People leave and supplier POs. Leave on a coach blocks their diary."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2 !px-3 text-sm"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        }
      />
      {!companyId ? (
        <p className="text-sm text-slate-500">Select a company first.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <label className="text-[11px] font-bold text-slate-500">
              From
              <input
                type="date"
                className="input mt-1 !py-2 !text-sm"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="text-[11px] font-bold text-slate-500">
              To
              <input
                type="date"
                className="input mt-1 !py-2 !text-sm"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            {['all', 'gym', 'clinic', 'hire', 'leave', 'delivery'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={`rounded-full border px-3 py-1 text-[11px] font-bold ${
                  filter === s
                    ? 'border-slate-800 bg-slate-800 text-white'
                    : 'border-slate-200 bg-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-[#00b4d8]" />
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {days.map((day) => (
                <section
                  key={day}
                  className="rounded-2xl border border-slate-200 bg-white p-3"
                >
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    {day}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {visible
                      .filter((e) => e.date === day)
                      .map((e) => (
                        <li key={e.id}>
                          <Link
                            href={e.href || '/dashboard'}
                            className={`block rounded-xl border px-2 py-1.5 text-[12px] ${SOURCE_TONE[e.source] || SOURCE_TONE.recall}`}
                          >
                            <span className="font-bold">
                              {e.start_time ? `${e.start_time} · ` : ''}
                              {e.title}
                            </span>
                            {e.person_name ? (
                              <span className="block text-[11px] opacity-80">
                                {e.person_name}
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    {!visible.some((e) => e.date === day) ? (
                      <li className="text-[11px] text-slate-400">Clear</li>
                    ) : null}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </RelationshipPage>
  );
}
