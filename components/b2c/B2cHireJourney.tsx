'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Check, ChevronRight, Download } from 'lucide-react';
import {
  HIRE_PROCESS_STEPS,
  hireJourneyCalendarEvent,
  type B2cHireJourney,
} from '@/lib/b2c/hire-journeys';
import {
  downloadMemberEventIcs,
  googleCalendarUrl,
  outlookCalendarUrl,
} from '@/lib/b2c/calendar-links';

function money(n?: number | null) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return `R${Number(n).toLocaleString('en-ZA')}`;
}

function dateRange(start?: string | null, end?: string | null) {
  const a = String(start || '').slice(0, 10);
  const b = String(end || '').slice(0, 10);
  if (!a && !b) return null;
  if (a && b && a !== b) return `${a} → ${b}`;
  return a || b;
}

export function B2cHireHowItWorks({ compact }: { compact?: boolean }) {
  return (
    <section className="rounded-3xl border border-cyan-100 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wide text-cyan-700">
        How hiring works
      </p>
      <p className="mt-0.5 text-sm font-black text-slate-900">
        Request → docs → desk OK → pay → out → back → done
      </p>
      {!compact ? (
        <ol className="mt-3 grid grid-cols-2 gap-2">
          {HIRE_PROCESS_STEPS.map((step, i) => (
            <li key={step.id} className="flex items-start gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-[10px] font-black text-white">
                {i + 1}
              </span>
              <span>
                <span className="block text-[12px] font-black text-slate-800">
                  {step.label}
                </span>
                <span className="block text-[11px] text-slate-500">
                  {step.hint}
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-1 text-[11px] text-slate-500">
          Pay the rental and a refundable deposit. Collect or we deliver. Return
          on the end date and the deposit is settled.
        </p>
      )}
    </section>
  );
}

export function B2cHireJourneyCard({
  journey,
  expanded,
  onToggle,
}: {
  journey: B2cHireJourney;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const steps = journey.timeline.filter(
    (s) => s.id !== 'cancelled' && s.id !== 'disputed'
  );
  const range = dateRange(journey.start_date, journey.end_date);
  const cal = hireJourneyCalendarEvent(journey);

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-800 text-[10px] font-black text-white">
          Hire
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black text-slate-900">
            {journey.item_title}
          </span>
          <span className="block truncate text-[11px] text-slate-500">
            {journey.brand}
            {range ? ` · ${range}` : journey.duration_label ? ` · ${journey.duration_label}` : ''}
          </span>
          <span className="mt-1.5 block text-[11px] font-semibold text-[#0077b6]">
            {journey.next_action}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-700">
          {journey.status_label}
        </span>
      </button>

      <div className="px-4 pb-3">
        <ol className="flex items-center gap-0.5">
          {steps.map((step, i) => (
            <li key={step.id} className="flex min-w-0 flex-1 items-center">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${
                  step.done
                    ? 'bg-cyan-600 text-white'
                    : step.current
                      ? 'bg-[#0077b6] text-white ring-4 ring-sky-100'
                      : 'bg-slate-100 text-slate-400'
                }`}
                title={step.label}
              >
                {step.done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {i < steps.length - 1 ? (
                <span
                  className={`mx-0.5 h-0.5 min-w-0 flex-1 rounded-full ${
                    step.done ? 'bg-cyan-500' : 'bg-slate-200'
                  }`}
                />
              ) : null}
            </li>
          ))}
        </ol>
        <div className="mt-1.5 flex justify-between text-[8px] font-bold uppercase tracking-wide text-slate-400">
          {HIRE_PROCESS_STEPS.map((s) => (
            <span key={s.id}>{s.label}</span>
          ))}
        </div>
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
            Your hire path
          </p>
          <ol className="space-y-2">
            {steps.map((step) => {
              const hint = HIRE_PROCESS_STEPS.find((s) => s.id === step.id);
              return (
                <li key={step.id} className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${
                      step.done
                        ? 'bg-cyan-600 text-white'
                        : step.current
                          ? 'bg-[#0077b6] text-white'
                          : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {step.done ? <Check className="h-3 w-3" /> : ''}
                  </span>
                  <span>
                    <span
                      className={`block text-xs font-black ${
                        step.current ? 'text-[#0077b6]' : 'text-slate-800'
                      }`}
                    >
                      {step.label}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {step.current ? journey.next_action : hint?.hint}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-2xl bg-slate-50 px-3 py-2 text-[11px]">
            {range ? (
              <>
                <dt className="text-slate-500">Dates</dt>
                <dd className="text-right font-bold text-slate-900">{range}</dd>
              </>
            ) : null}
            {journey.duration_label ? (
              <>
                <dt className="text-slate-500">Duration</dt>
                <dd className="text-right font-bold text-slate-900">
                  {journey.duration_label}
                </dd>
              </>
            ) : null}
            {journey.fulfillment_label ? (
              <>
                <dt className="text-slate-500">How you get it</dt>
                <dd className="text-right font-bold text-slate-900">
                  {journey.fulfillment_label}
                </dd>
              </>
            ) : null}
            {journey.location ? (
              <>
                <dt className="text-slate-500">Where</dt>
                <dd className="text-right font-bold text-slate-900">
                  {journey.location}
                </dd>
              </>
            ) : null}
            {journey.collect_hours ? (
              <>
                <dt className="text-slate-500">Hours</dt>
                <dd className="text-right font-bold text-slate-900">
                  {journey.collect_hours}
                </dd>
              </>
            ) : null}
            <dt className="text-slate-500">You pay</dt>
            <dd className="text-right font-black text-slate-900">
              {money(journey.customer_pays_zar) || '—'}
            </dd>
            <dt className="text-slate-500">Deposit</dt>
            <dd className="text-right font-bold text-slate-800">
              {money(journey.deposit_zar) || '—'}
            </dd>
            <dt className="text-slate-500">Platform fee</dt>
            <dd className="text-right font-bold text-emerald-700">Free</dd>
          </dl>

          {journey.includes ? (
            <p className="text-[11px] text-slate-600">
              <span className="font-black text-slate-800">Included: </span>
              {journey.includes}
            </p>
          ) : null}
          {journey.excludes ? (
            <p className="text-[11px] text-slate-600">
              <span className="font-black text-slate-800">Bring yourself: </span>
              {journey.excludes}
            </p>
          ) : null}
          {journey.specs ? (
            <p className="text-[11px] text-slate-600">
              <span className="font-black text-slate-800">Specs: </span>
              {journey.specs}
            </p>
          ) : null}
          {journey.cancellation_note ? (
            <p className="text-[11px] text-slate-600">
              <span className="font-black text-slate-800">Cancel: </span>
              {journey.cancellation_note}
            </p>
          ) : null}
          {journey.deposit_note ? (
            <p className="text-[11px] text-slate-600">{journey.deposit_note}</p>
          ) : null}

          {journey.docs_pending.length > 0 ? (
            <div>
              <p className="text-[11px] font-black text-amber-900">
                Documents still needed
              </p>
              <ul className="mt-1 flex flex-wrap gap-1">
                {journey.docs_pending.map((d) => (
                  <li
                    key={d.key}
                    className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-950"
                  >
                    {d.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {cal ? (
            <div>
              <p className="mb-1.5 flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-slate-400">
                <CalendarDays className="h-3.5 w-3.5" /> Add to your calendar
              </p>
              <div className="flex flex-wrap gap-1.5">
                <a
                  href={googleCalendarUrl(cal)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-700"
                >
                  Google
                </a>
                <a
                  href={outlookCalendarUrl(cal)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-700"
                >
                  Outlook
                </a>
                <button
                  type="button"
                  onClick={() => downloadMemberEventIcs(cal)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-700"
                >
                  <Download className="h-3 w-3" /> Apple / .ics
                </button>
              </div>
            </div>
          ) : null}

          <Link
            href={`${journey.portal_path}${journey.can_extend ? '?tab=hires' : ''}`}
            className="flex items-center justify-center gap-1 rounded-2xl bg-[#0077b6] py-3 text-sm font-black text-white"
          >
            {journey.can_extend
              ? 'Extend or manage this hire'
              : 'Open hire portal'}{' '}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </article>
  );
}

export function B2cHireJourneyList({
  journeys,
  showHow,
}: {
  journeys: B2cHireJourney[];
  showHow?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(
    journeys.find((j) => j.open)?.id || journeys[0]?.id || null
  );
  if (!journeys.length && !showHow) return null;
  return (
    <section className="space-y-2.5">
      {showHow ? <B2cHireHowItWorks compact={journeys.length > 0} /> : null}
      {journeys.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900">Your hire path</h2>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {journeys.filter((j) => j.open).length} open
            </span>
          </div>
          <ul className="space-y-2.5">
            {journeys.map((j) => (
              <li key={j.id}>
                <B2cHireJourneyCard
                  journey={j}
                  expanded={openId === j.id}
                  onToggle={() =>
                    setOpenId((cur) => (cur === j.id ? null : j.id))
                  }
                />
              </li>
            ))}
          </ul>
        </>
      ) : showHow ? (
        <p className="px-1 text-[12px] text-slate-500">
          No hire on the book yet. Open a hire place or Shop to request gear.
        </p>
      ) : null}
    </section>
  );
}
