'use client';

import { useMemo, useState } from 'react';
import { CalendarPlus, ClipboardList, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { TreatmentPlan } from '@/lib/services/advisor-clinical';
import { planBookPreview } from '@/lib/services/advisor-clinical';

type ServiceOpt = { id: string; name: string };
type Appt = {
  id: string;
  service_id?: string;
  date: string;
  start_time: string;
  status: string;
};
type Booking = {
  appointment_id?: string;
  session_id?: string;
  status: string;
};

type Props = {
  personId: string;
  personLabel?: string;
  plans: TreatmentPlan[];
  services?: ServiceOpt[];
  appointments: Appt[];
  bookings: Booking[];
  /** Fit uses sessions + session_id */
  useSessionId?: boolean;
  post: (body: Record<string, unknown>) => Promise<unknown>;
  onRefresh?: () => void;
  accentClass?: string;
};

/**
 * Care / treatment plans with one-click book of the next open diary slot.
 */
export function AdvisorTreatmentPlanPanel({
  personId,
  personLabel,
  plans,
  services = [],
  appointments,
  bookings,
  useSessionId,
  post,
  onRefresh,
  accentClass = 'border-teal-200',
}: Props) {
  const [title, setTitle] = useState('Care plan');
  const [goals, setGoals] = useState('');
  const [stepTitle, setStepTitle] = useState('');
  const [stepService, setStepService] = useState('');
  const [sessions, setSessions] = useState('4');
  const [busy, setBusy] = useState<string | null>(null);

  const mine = useMemo(
    () =>
      (plans || [])
        .filter((p) => p.person_id === personId)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [plans, personId]
  );

  const create = async () => {
    if (!personId || !title.trim()) {
      toast.error('Title required');
      return;
    }
    setBusy('create');
    try {
      const steps = stepTitle.trim()
        ? [
            {
              title: stepTitle.trim(),
              service_id: stepService || undefined,
              sessions_planned: Number(sessions) || 1,
            },
          ]
        : undefined;
      await post({
        action: 'upsert_treatment_plan',
        person_id: personId,
        title: title.trim(),
        goals: goals.trim() || undefined,
        steps,
      });
      toast.success('Treatment plan saved');
      setStepTitle('');
      setGoals('');
      onRefresh?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(null);
    }
  };

  const bookNext = async (plan: TreatmentPlan) => {
    setBusy(plan.id);
    try {
      const res = (await post({
        action: 'book_from_treatment_plan',
        plan_id: plan.id,
        person_id: personId,
      })) as { message?: string; error?: string };
      if (res?.error) throw new Error(res.error);
      toast.success(res?.message || 'Next session booked');
      onRefresh?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Book failed');
    } finally {
      setBusy(null);
    }
  };

  if (!personId) return null;

  return (
    <div
      className={`rounded-3xl border ${accentClass} bg-white dark:bg-slate-950 p-4 sm:p-5 space-y-4`}
    >
      <div className="flex items-start gap-2">
        <ClipboardList className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-black text-slate-900 dark:text-white">
            Treatment / care plans
          </p>
          <p className="text-[11px] text-slate-500">
            {personLabel || personId} — plan steps, then one-click book the next
            open diary slot.
          </p>
        </div>
      </div>

      {mine.length === 0 ? (
        <p className="text-sm text-slate-500">No care plans yet.</p>
      ) : (
        <ul className="space-y-2">
          {mine.map((plan) => {
            const preview = planBookPreview(plan, appointments, bookings, {
              useSessionId,
            });
            const svcName = preview.step?.service_id
              ? services.find((s) => s.id === preview.step!.service_id)?.name
              : null;
            return (
              <li
                key={plan.id}
                className="rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-2.5 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {plan.title}{' '}
                      <span className="text-[10px] font-semibold uppercase text-slate-400">
                        {plan.status}
                      </span>
                    </p>
                    {plan.goals ? (
                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {plan.goals}
                      </p>
                    ) : null}
                    {preview.step ? (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                        Next: {preview.step.title}
                        {svcName ? ` · ${svcName}` : ''}
                        {preview.step.sessions_planned
                          ? ` · ${preview.step.sessions_done || 0}/${preview.step.sessions_planned} sessions`
                          : ''}
                      </p>
                    ) : (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-1">
                        All steps complete
                      </p>
                    )}
                  </div>
                  {preview.step ? (
                    <button
                      type="button"
                      disabled={busy === plan.id || !preview.appointmentId}
                      onClick={() => void bookNext(plan)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 text-white px-3 py-1.5 text-[11px] font-bold disabled:opacity-40 shrink-0"
                      title={
                        preview.appointmentId
                          ? 'Book next open slot'
                          : 'No open diary slot available'
                      }
                    >
                      {busy === plan.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CalendarPlus className="w-3.5 h-3.5" />
                      )}
                      Book next
                    </button>
                  ) : null}
                </div>
                {plan.steps?.length ? (
                  <ol className="text-[10px] text-slate-500 space-y-0.5 pl-3 list-decimal">
                    {plan.steps.map((s) => (
                      <li key={s.id}>
                        {s.title} · {s.status}
                        {s.sessions_planned
                          ? ` (${s.sessions_done || 0}/${s.sessions_planned})`
                          : ''}
                      </li>
                    ))}
                  </ol>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
          New plan
        </p>
        <input
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm"
          placeholder="Plan title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm min-h-[56px]"
          placeholder="Goals (optional)"
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
        />
        <div className="grid sm:grid-cols-3 gap-2">
          <input
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm sm:col-span-1"
            placeholder="First step title"
            value={stepTitle}
            onChange={(e) => setStepTitle(e.target.value)}
          />
          <select
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm"
            value={stepService}
            onChange={(e) => setStepService(e.target.value)}
          >
            <option value="">Any service</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm"
            placeholder="Sessions"
            value={sessions}
            onChange={(e) => setSessions(e.target.value)}
          />
        </div>
        <button
          type="button"
          disabled={busy === 'create'}
          onClick={() => void create()}
          className="rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2 text-xs font-bold disabled:opacity-50 inline-flex items-center gap-2"
        >
          {busy === 'create' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : null}
          Save plan
        </button>
      </div>
    </div>
  );
}
