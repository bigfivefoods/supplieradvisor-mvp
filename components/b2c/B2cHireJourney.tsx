'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import type { B2cHireJourney } from '@/lib/b2c/hire-journeys';

function money(n?: number | null) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return `R${Number(n).toLocaleString('en-ZA')}`;
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
            {journey.start_date
              ? ` · ${String(journey.start_date).slice(0, 10)}`
              : ''}
          </span>
          <span className="mt-1.5 block text-[11px] font-semibold text-[#0077b6]">
            {journey.next_action}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-700">
          {journey.status_label}
        </span>
      </button>

      {/* Compact golden path */}
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
          <span>Request</span>
          <span>Docs</span>
          <span>OK</span>
          <span>Pay</span>
          <span>Out</span>
          <span>Back</span>
          <span>Done</span>
        </div>
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
            Your hire path
          </p>
          <ol className="space-y-2">
            {steps.map((step) => (
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
                  {step.current ? (
                    <span className="block text-[11px] text-slate-500">
                      {journey.next_action}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>

          {(journey.customer_pays_zar != null || journey.deposit_zar != null) && (
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-[11px]">
              <span className="text-slate-500">You pay</span>
              <span className="text-right font-black text-slate-900">
                {money(journey.customer_pays_zar) || '—'}
              </span>
              <span className="text-slate-500">Deposit</span>
              <span className="text-right font-bold text-slate-800">
                {money(journey.deposit_zar) || '—'}
              </span>
              <span className="text-slate-500">Platform fee</span>
              <span className="text-right font-bold text-emerald-700">Free</span>
            </div>
          )}

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

          <Link
            href={journey.portal_path}
            className="flex items-center justify-center gap-1 rounded-2xl bg-[#0077b6] py-3 text-sm font-black text-white"
          >
            Open hire portal <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </article>
  );
}

export function B2cHireJourneyList({
  journeys,
}: {
  journeys: B2cHireJourney[];
}) {
  const [openId, setOpenId] = useState<string | null>(
    journeys.find((j) => j.open)?.id || journeys[0]?.id || null
  );
  if (!journeys.length) return null;
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
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
    </section>
  );
}
