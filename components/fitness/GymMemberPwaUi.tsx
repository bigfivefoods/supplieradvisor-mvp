'use client';

import { useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Loader2,
  QrCode,
} from 'lucide-react';
import { AdvisorSharePanel } from '@/components/advisors/AdvisorSharePanel';
import { advisorBrandInk } from '@/lib/advisors/brand-ink';

export function gymFormatDay(date: string, time: string) {
  try {
    const d = new Date(`${date}T12:00:00`);
    return `${d.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })} · ${String(time).slice(0, 5)}`;
  } catch {
    return `${date} · ${String(time).slice(0, 5)}`;
  }
}

export function GymFlash({
  error,
  msg,
}: {
  error?: string | null;
  msg?: string | null;
}) {
  if (!error && !msg) return null;
  return (
    <div
      role="status"
      className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold ${
        error
          ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-100'
          : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100'
      }`}
    >
      {error || msg}
    </div>
  );
}

export function GymSectionTitle({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <h2 className="text-base font-black text-slate-900 dark:text-white">
        {children}
      </h2>
      {hint ? (
        <p className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function GymStat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center dark:border-white/10 dark:bg-neutral-900">
      <p className="text-xl font-black tabular-nums text-slate-900 dark:text-white">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
    </div>
  );
}

export function GymNextUpCard({
  className,
  date,
  startTime,
  location,
  coach,
  rsvp,
  bookingId,
  busy,
  color,
  onOpen,
  onRsvp,
}: {
  className: string;
  date: string;
  startTime: string;
  location?: string;
  coach?: string;
  rsvp?: string | null;
  bookingId: string;
  busy?: boolean;
  color: string;
  onOpen: () => void;
  onRsvp: (coming: boolean) => void;
}) {
  const ink = advisorBrandInk(color);
  return (
    <div
      className="overflow-hidden rounded-3xl p-4 text-left shadow-sm"
      style={{ backgroundColor: color, color: ink }}
    >
      <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
        Next class
      </p>
      <button type="button" onClick={onOpen} className="mt-1 w-full text-left">
        <p className="text-lg font-black leading-tight">{className}</p>
        <p className="mt-1 text-sm font-bold opacity-80">
          {gymFormatDay(date, startTime)}
          {coach ? ` · ${coach}` : ''}
          {location ? ` · ${location}` : ''}
        </p>
      </button>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onRsvp(true)}
          className={`min-h-10 rounded-xl px-3 text-xs font-black ${
            rsvp === 'coming'
              ? 'bg-slate-900 text-white'
              : 'bg-white/80 text-slate-900'
          }`}
        >
          I&apos;m coming
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRsvp(false)}
          className="min-h-10 rounded-xl px-3 text-xs font-bold text-slate-800 underline"
        >
          Can&apos;t make it
        </button>
      </div>
    </div>
  );
}

export function GymCheckinPass({
  brand,
  membership,
  plan,
  paymentOk,
  blocked,
  alert,
  scan,
  onScan,
  onCheckin,
  busy,
  doorHref,
  color,
}: {
  brand: string;
  membership?: string;
  plan?: string | null;
  paymentOk?: boolean;
  blocked?: boolean;
  alert?: string | null;
  scan: string;
  onScan: (v: string) => void;
  onCheckin: () => void;
  busy: boolean;
  doorHref?: string | null;
  color: string;
}) {
  const ink = advisorBrandInk(color);
  return (
    <div className="space-y-3">
      <div
        className="relative overflow-hidden rounded-3xl p-5 shadow-sm"
        style={{ backgroundColor: color, color: ink }}
      >
        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">
          {brand}
        </p>
        <p className="mt-3 text-2xl font-black leading-none">Member pass</p>
        <p className="mt-2 text-sm font-bold opacity-80">
          {[membership, plan].filter(Boolean).join(' · ') || 'Gym member'}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <QrCode className="h-10 w-10 opacity-80" />
          <p className="max-w-[12rem] text-right text-[11px] font-semibold leading-snug opacity-70">
            Show this at the door, or check in with the gym QR.
          </p>
        </div>
      </div>

      {alert || blocked || paymentOk === false ? (
        <div
          className={`rounded-2xl border px-3 py-2 text-xs font-semibold ${
            blocked
              ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-100'
              : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100'
          }`}
        >
          <p className="flex items-start gap-1.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {alert || 'Membership needs attention before training.'}
          </p>
        </div>
      ) : (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100">
          Dues look current — good to train.
        </p>
      )}

      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
        Gym QR or check-in link (optional)
        <input
          className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-mono dark:border-white/10 dark:bg-neutral-900"
          value={scan}
          onChange={(e) => onScan(e.target.value)}
          placeholder="Paste fg_… token or full check-in link"
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={onCheckin}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-black text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        I&apos;m at the gym — check in
      </button>
      {doorHref ? (
        <a
          href={doorHref}
          className="block text-center text-xs font-bold text-slate-600 underline dark:text-slate-300"
        >
          Open gym door page (scan-friendly)
        </a>
      ) : null}
    </div>
  );
}

export function GymClassRateCard({
  className,
  date,
  busy,
  onSubmit,
}: {
  className: string;
  date?: string;
  busy?: boolean;
  onSubmit: (v: {
    feeling: number;
    intensity: number;
    enjoyment: number;
    comment: string;
  }) => void | Promise<void>;
}) {
  const [feeling, setFeeling] = useState(4);
  const [intensity, setIntensity] = useState(5);
  const [enjoyment, setEnjoyment] = useState(4);
  const [comment, setComment] = useState('');
  return (
    <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-950/40">
      <p className="text-sm font-black text-amber-950 dark:text-amber-100">
        Rate {className}
        {date ? ` · ${date}` : ''}
      </p>
      <p className="text-[11px] text-amber-900/80 dark:text-amber-100/80">
        Optional. Your coach and the gym owner both see this.
      </p>
      <label className="block text-[10px] font-black uppercase text-amber-900">
        How it felt · {feeling}/5
        <input
          type="range"
          min={1}
          max={5}
          value={feeling}
          onChange={(e) => setFeeling(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>
      <label className="block text-[10px] font-black uppercase text-amber-900">
        Effort · {intensity}/10
        <input
          type="range"
          min={1}
          max={10}
          value={intensity}
          onChange={(e) => setIntensity(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>
      <label className="block text-[10px] font-black uppercase text-amber-900">
        Enjoyment · {enjoyment}/5
        <input
          type="range"
          min={1}
          max={5}
          value={enjoyment}
          onChange={(e) => setEnjoyment(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>
      <textarea
        className="min-h-16 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-500/40 dark:bg-neutral-900"
        placeholder="Anything the coach should know? (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void onSubmit({ feeling, intensity, enjoyment, comment: comment.trim() })
        }
        className="min-h-10 w-full rounded-xl bg-slate-900 text-sm font-black text-white disabled:opacity-50"
      >
        Send to coach &amp; gym
      </button>
    </div>
  );
}

export function GymCalendarLink({
  date,
  start,
  title,
}: {
  date: string;
  start: string;
  title: string;
}) {
  return (
    <a
      className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 underline dark:text-slate-300"
      href={`/api/public/advisor/ics?module=fitgraph&date=${encodeURIComponent(date)}&start=${encodeURIComponent(start)}&title=${encodeURIComponent(title)}&duration=45`}
    >
      <CalendarPlus className="h-3.5 w-3.5" />
      Add to calendar
    </a>
  );
}

export function GymSharePanel({
  brand,
  bio,
  phone,
  email,
  color,
}: {
  brand: string;
  bio?: string;
  phone?: string;
  email?: string;
  color: string;
}) {
  return (
    <AdvisorSharePanel
      brand={brand}
      bio={bio}
      phone={phone}
      email={email}
      color={color}
      productLine="GymAdvisor®"
      hint="Send this gym to a friend on WhatsApp, socials, or copy the link."
      lead={`Train with ${brand} on GymAdvisor®`}
      emailSubject={`Train at ${brand}`}
      copiedOk="Gym details copied"
    />
  );
}
