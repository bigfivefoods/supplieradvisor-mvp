'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  HeartPulse,
  Loader2,
  Megaphone,
} from 'lucide-react';
import type {
  B2cCareAnnouncement,
  B2cCareBooking,
  B2cCareClinic,
  B2cCareRecord,
} from '@/lib/b2c/care-types';
import EnablePushButton from '@/components/pwa/EnablePushButton';

function formatShare(summary: Record<string, unknown>) {
  const keys = [
    'allergies',
    'current_meds',
    'chronic_conditions',
    'diagnosis_notes',
    'care_notes',
    'progress_notes',
    'treatment_goals',
    'active_scripts',
  ];
  return keys
    .filter((k) => summary[k])
    .slice(0, 4)
    .map((k) => ({
      label: k.replace(/_/g, ' '),
      value: Array.isArray(summary[k])
        ? (summary[k] as unknown[]).join(', ')
        : typeof summary[k] === 'object' && summary[k]
          ? Object.values(summary[k] as Record<string, unknown>)
              .filter(Boolean)
              .join(' · ')
          : String(summary[k]),
    }));
}

export function B2cCarePanel() {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<B2cCareBooking[]>([]);
  const [records, setRecords] = useState<B2cCareRecord[]>([]);
  const [clinics, setClinics] = useState<B2cCareClinic[]>([]);
  const [announcements, setAnnouncements] = useState<B2cCareAnnouncement[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/b2c/care', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setBookings(Array.isArray(data.bookings) ? data.bookings : []);
        setRecords(Array.isArray(data.records) ? data.records : []);
        setClinics(Array.isArray(data.clinics) ? data.clinics : []);
        setAnnouncements(
          Array.isArray(data.announcements) ? data.announcements : []
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-[#0077b6]" />
      </div>
    );
  }
  if (!bookings.length && !records.length && !clinics.length && !announcements.length)
    return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-black text-slate-900">Your care</h2>
      {announcements.length > 0 ? (
        <ul className="space-y-2">
          {announcements.slice(0, 5).map((a) => (
            <li key={`${a.kind}-${a.id}`}>
              <Link
                href={a.cta_href || a.href}
                className="block rounded-2xl border border-amber-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-center gap-2 text-amber-900">
                  <Megaphone className="h-4 w-4" />
                  <p className="text-sm font-black">{a.brand}</p>
                </div>
                <p className="mt-1 text-sm font-black text-slate-900">{a.title}</p>
                {a.body ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                    {a.body}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {bookings.length > 0 ? (
        <ul className="space-y-2">
          {bookings.slice(0, 12).map((b) => (
            <li key={b.id}>
              <Link
                href={b.href}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm active:scale-[0.99]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-slate-900">
                    {b.title}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {b.brand} · {b.when}
                    {b.past ? ' · past visit' : ''}
                  </span>
                  {b.notes ? (
                    <span className="mt-0.5 line-clamp-2 block text-[11px] text-slate-600">
                      {b.notes}
                    </span>
                  ) : null}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                  {b.status}
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {clinics.length > 0 ? (
        <ul className="space-y-2">
          {clinics.map((c) => (
            <li
              key={`${c.kind}-${c.bookHref}`}
              className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <p className="text-sm font-black text-slate-900">{c.brand}</p>
              <p className="text-[11px] capitalize text-slate-500">{c.kind}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href={c.bookHref}
                  className="inline-flex items-center gap-1 rounded-xl bg-[#0077b6] px-3 py-2 text-[11px] font-black text-white"
                >
                  <CalendarDays className="h-3.5 w-3.5" /> Book
                </Link>
                {c.classesHref ? (
                  <Link
                    href={c.classesHref}
                    className="inline-flex items-center gap-1 rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-[11px] font-black text-yellow-950"
                  >
                    <Dumbbell className="h-3.5 w-3.5" /> My classes
                  </Link>
                ) : null}
                {c.progressHref ? (
                  <Link
                    href={c.progressHref}
                    className="inline-flex items-center gap-1 rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-[11px] font-black text-yellow-950"
                  >
                    <Activity className="h-3.5 w-3.5" /> Progress
                  </Link>
                ) : null}
                {c.hasRecords ? (
                  <Link
                    href={c.careHref}
                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-black text-emerald-900"
                  >
                    <HeartPulse className="h-3.5 w-3.5" /> Records
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {records.map((r) => {
        const bits = formatShare(r.summary);
        return (
          <Link
            key={`${r.kind}-${r.brand}-rec`}
            href={r.href}
            className="block rounded-2xl border border-emerald-200 bg-white p-3 shadow-sm"
          >
            <div className="flex items-center gap-2 text-emerald-800">
              <HeartPulse className="h-4 w-4" />
              <p className="text-sm font-black">{r.brand} · records</p>
            </div>
            {r.follow_ups && r.follow_ups.length > 0 ? (
              <div className="mt-2 rounded-xl bg-amber-50 px-2.5 py-2">
                <p className="text-[10px] font-black uppercase text-amber-800">
                  Treatment reminder
                </p>
                <p className="mt-0.5 text-xs font-semibold text-slate-800">
                  {r.follow_ups[0].title || 'Check-in'} · {r.follow_ups[0].remind_on}
                </p>
                <p className="mt-0.5 line-clamp-3 text-xs text-slate-700">
                  {r.follow_ups[0].advice}
                </p>
              </div>
            ) : null}
            {r.advice && r.advice.length > 0 && !r.follow_ups?.length ? (
              <p className="mt-2 line-clamp-3 text-xs text-slate-700">
                {r.advice[0].body}
              </p>
            ) : null}
            {bits.length ? (
              <dl className="mt-2 space-y-1">
                {bits.map((bit) => (
                  <div key={bit.label}>
                    <dt className="text-[10px] font-bold uppercase text-slate-400">
                      {bit.label}
                    </dt>
                    <dd className="truncate text-xs text-slate-800">{bit.value}</dd>
                  </div>
                ))}
              </dl>
            ) : !r.follow_ups?.length && !r.advice?.length ? (
              <p className="mt-1 text-[11px] text-slate-500">
                Open for allergies, scripts, advice and medical aid
              </p>
            ) : null}
          </Link>
        );
      })}

      <EnablePushButton mode="member" compact />
    </section>
  );
}
