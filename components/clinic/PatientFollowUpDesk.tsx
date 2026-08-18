'use client';

/**
 * Schedule a post-treatment reminder and lasting advice on the patient record.
 */
import { useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PatientFollowUp } from '@/lib/clinic/patient-follow-up';

export function PatientFollowUpDesk({
  patientId,
  followUps = [],
  post,
  saving,
  accentClass = 'border-teal-200',
}: {
  patientId: string;
  followUps?: PatientFollowUp[];
  post: (body: Record<string, unknown>) => Promise<unknown>;
  saving?: boolean;
  accentClass?: string;
}) {
  const addDays = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const [title, setTitle] = useState('After your visit');
  const [advice, setAdvice] = useState('');
  const [message, setMessage] = useState('');
  const [remindOn, setRemindOn] = useState(addDays(7));
  const [busy, setBusy] = useState(false);

  const save = async (sendNow: boolean) => {
    if (!advice.trim()) {
      toast.error('Write the treatment advice first');
      return;
    }
    setBusy(true);
    try {
      const data = (await post({
        action: 'upsert_follow_up',
        patient_id: patientId,
        send_now: sendNow,
        notify_parties: true,
        follow_up: {
          title: title.trim() || undefined,
          advice: advice.trim(),
          message: message.trim() || undefined,
          remind_on: remindOn,
          status: sendNow ? 'sent' : 'scheduled',
        },
      })) as { message?: string };
      toast.success(data.message || 'Saved on the patient record');
      setAdvice('');
      setMessage('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (row: PatientFollowUp, status: PatientFollowUp['status']) => {
    setBusy(true);
    try {
      await post({
        action: 'upsert_follow_up',
        patient_id: patientId,
        follow_up: { ...row, status },
      });
      toast.success(status === 'done' ? 'Marked done' : 'Updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update');
    } finally {
      setBusy(false);
    }
  };

  const inp =
    'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900';

  return (
    <section
      className={`rounded-2xl border ${accentClass} bg-white p-4 space-y-3 dark:bg-neutral-950`}
    >
      <div className="flex items-start gap-2">
        <Bell className="mt-0.5 h-4 w-4 text-slate-500" />
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">
            Post-treatment reminder
          </h3>
          <p className="text-[11px] text-slate-500">
            Advice stays on this chart and on the member’s SA Member / portal
            profile. A check-in notifies the practice desk and the member PWA.
          </p>
        </div>
      </div>

      <input
        className={inp}
        placeholder="Title (e.g. After your filling)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className={inp + ' min-h-[88px]'}
        placeholder="Treatment advice the patient should keep (ice, rest, exercises, what to watch for…)"
        value={advice}
        onChange={(e) => setAdvice(e.target.value)}
      />
      <textarea
        className={inp + ' min-h-[56px]'}
        placeholder="Optional extra message on their profile"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <label className="block text-[10px] font-black uppercase text-slate-400">
        Remind on
        <input
          className={inp + ' mt-0.5'}
          type="date"
          value={remindOn}
          onChange={(e) => setRemindOn(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || saving}
          onClick={() => void save(false)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black disabled:opacity-50"
        >
          {busy ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : null}{' '}
          Save on record
        </button>
        <button
          type="button"
          disabled={busy || saving}
          onClick={() => void save(true)}
          className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
        >
          Notify both now
        </button>
      </div>

      {followUps.length > 0 ? (
        <ul className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          {followUps.map((f) => (
            <li
              key={f.id}
              className="rounded-xl border border-slate-100 px-3 py-2 text-[12px] dark:border-slate-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-slate-800 dark:text-slate-100">
                  {f.title || 'Advice'} · {f.remind_on}
                </p>
                <span className="text-[10px] font-black uppercase text-slate-400">
                  {f.status}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                {f.advice}
              </p>
              {f.message ? (
                <p className="mt-1 text-slate-500">Message: {f.message}</p>
              ) : null}
              {f.status === 'scheduled' || f.status === 'sent' ? (
                <button
                  type="button"
                  className="mt-1 text-[10px] font-bold text-emerald-700"
                  onClick={() => void setStatus(f, 'done')}
                >
                  Mark done
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
