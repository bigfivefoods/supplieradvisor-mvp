'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import {
  deriveFirstRun,
  firstRunDismissStorageKey,
  type FirstRunSignals,
  type FirstRunStep,
} from '@/lib/onboarding/first-run';

type Props = {
  companyId: number;
  signals: FirstRunSignals;
  companyName?: string | null;
  /**
   * Live workspaces remember dismiss in localStorage.
   * The sample page leaves this off so a screenshot never depends on a previous visit.
   */
  rememberDismiss?: boolean;
};

export default function FirstRunChecklist({
  companyId,
  signals,
  companyName,
  rememberDismiss = true,
}: Props) {
  const checklist = deriveFirstRun(signals);
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(!rememberDismiss);

  useEffect(() => {
    if (!rememberDismiss) {
      setDismissed(false);
      setReady(true);
      return;
    }
    try {
      setDismissed(localStorage.getItem(firstRunDismissStorageKey(companyId)) === '1');
    } catch {
      setDismissed(false);
    }
    setReady(true);
  }, [companyId, rememberDismiss]);

  const dismiss = () => {
    setDismissed(true);
    if (!rememberDismiss) return;
    try {
      localStorage.setItem(firstRunDismissStorageKey(companyId), '1');
    } catch {
      /* private mode */
    }
  };

  const restore = () => {
    setDismissed(false);
    if (!rememberDismiss) return;
    try {
      localStorage.removeItem(firstRunDismissStorageKey(companyId));
    } catch {
      /* private mode */
    }
  };

  if (!ready) return null;
  if (!Number.isFinite(companyId) || companyId <= 0) return null;

  const verified = checklist.steps.find((step) => step.id === 'verification');

  if (checklist.complete && (verified?.done || dismissed)) return null;

  if (checklist.complete && verified && !verified.done) {
    return (
      <section
        className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5"
        aria-label="Company setup"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0077b6]">
              SupplierAdvisor®
            </p>
            <h2 className="mt-1 text-base font-black tracking-tight text-slate-900 dark:text-white">
              {companyName ? `${companyName} is set up` : 'This company is set up'}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              The five setup steps are on record. Verification is optional.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={verified.href}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#00b4d8] px-4 text-sm font-bold text-white hover:bg-[#0077b6]"
            >
              {verified.cta}
            </Link>
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex min-h-11 items-center justify-center rounded-full px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (dismissed) {
    const next = checklist.next;
    return (
      <section
        className="mb-6 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"
        aria-label="Company setup"
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <span className="font-bold text-slate-900 dark:text-white">
            Setup {checklist.doneRequired} of {checklist.requiredTotal}.
          </span>{' '}
          {next ? (
            <>
              Next: <span className="font-semibold text-slate-900 dark:text-white">{next.title}</span>
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-2">
          {next ? (
            <Link
              href={next.href}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#00b4d8] px-4 text-sm font-bold text-white hover:bg-[#0077b6]"
            >
              {next.cta}
            </Link>
          ) : null}
          <button
            type="button"
            onClick={restore}
            className="inline-flex min-h-11 items-center justify-center rounded-full px-3 text-sm font-semibold text-slate-700 underline-offset-2 hover:underline dark:text-slate-200"
          >
            Show checklist
          </button>
        </div>
      </section>
    );
  }

  const required = checklist.required;
  const optional = checklist.steps.filter((step) => step.optional);

  return (
    <section
      className="relative mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6"
      aria-label="Company setup"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        aria-label="Dismiss setup checklist"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="pr-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0077b6]">
          SupplierAdvisor® · first run
        </p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
          {companyName ? `Set up ${companyName}` : 'Set up this company'}
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Five steps, in order. SupplierAdvisor® marks a step done only when the record exists.
        </p>
        <p className="mt-3 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
          {checklist.doneRequired} of {checklist.requiredTotal}
          <span className="ml-2 font-medium text-slate-500">{checklist.percent}%</span>
        </p>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={checklist.requiredTotal}
          aria-valuenow={checklist.doneRequired}
          aria-label="Company setup progress"
        >
          <div
            className="h-full rounded-full bg-[#00b4d8]"
            style={{ width: `${checklist.percent}%` }}
          />
        </div>
      </div>

      <ol className="mt-5 space-y-2">
        {required.map((step, index) => (
          <StepRow
            key={step.id}
            step={step}
            index={index + 1}
            current={checklist.next?.id === step.id}
          />
        ))}
      </ol>

      {optional.length > 0 ? (
        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Optional
          </p>
          <ol>
            {optional.map((step) => (
              <StepRow key={step.id} step={step} current={false} />
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

function StepRow({
  step,
  index,
  current,
}: {
  step: FirstRunStep;
  index?: number;
  current: boolean;
}) {
  return (
    <li
      className={`flex flex-col gap-3 rounded-2xl border px-3 py-3 sm:flex-row sm:items-center ${
        step.done
          ? 'border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40'
          : current
            ? 'border-[#00b4d8] bg-[#00b4d8]/5'
            : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
      }`}
      aria-current={current ? 'step' : undefined}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <span
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            step.done
              ? 'bg-emerald-600 text-white'
              : current
                ? 'bg-[#00b4d8] text-white'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
          }`}
          aria-hidden
        >
          {step.done ? <Check className="h-4 w-4" /> : index ?? '·'}
        </span>
        <div className="min-w-0">
          <p
            className={`text-sm font-bold ${
              step.done ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'
            }`}
          >
            {step.title}
            {step.done ? <span className="sr-only">, done</span> : null}
          </p>
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{step.body}</p>
        </div>
      </div>
      <div className="pl-10 sm:pl-0">
        <Link
          href={step.href}
          className={
            current
              ? 'inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#00b4d8] px-4 text-sm font-bold text-white hover:bg-[#0077b6] sm:w-auto'
              : 'inline-flex min-h-11 items-center text-sm font-bold text-[#0077b6] hover:underline'
          }
        >
          {step.cta}
        </Link>
      </div>
    </li>
  );
}
