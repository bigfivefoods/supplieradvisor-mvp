'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Link2 } from 'lucide-react';
import {
  LoadingBlock,
  PsychiatrygraphWorkbench,
  usePsychiatrygraph,
} from '@/components/clinic/PsychiatrygraphWorkbench';
import { DataTable, FormCard, StatRow, fc } from '@/components/clinic/PsychiatryForm';
import { buildPublicFeedbackPath } from '@/lib/services/booking-feedback';

export default function BookingsPage() {
  const { companyId, store, loading, saving, post, summary } = usePsychiatrygraph();
  const [form, setForm] = useState({
    appointment_id: '',
    patient_id: '',
  });

  const add = async () => {
    if (!form.appointment_id || !form.patient_id) {
      toast.error('Pick appointment and patient');
      return;
    }
    await post({
      entity: 'bookings',
      action: 'upsert',
      record: {
        appointment_id: form.appointment_id,
        patient_id: form.patient_id,
        status: 'booked',
        source: 'desk',
      },
    });
    toast.success('Booking saved');
  };

  const mark = async (id: string, status: string) => {
    const b = store?.bookings.find((x) => x.id === id);
    if (!b) return;
    const data = await post({
      entity: 'bookings',
      action: 'upsert',
      record: { ...b, status },
    });
    if (status === 'attended') {
      const updated = (data?.store?.bookings || []).find(
        (x: { id: string }) => x.id === id
      ) as { feedback_token?: string } | undefined;
      const tok = updated?.feedback_token;
      if (tok) {
        const path = buildPublicFeedbackPath('psychiatrygraph', companyId, tok);
        const url =
          typeof window !== 'undefined'
            ? `${window.location.origin}${path}`
            : path;
        try {
          await navigator.clipboard.writeText(url);
          toast.success('Attended — feedback link copied for the patient');
        } catch {
          toast.success('Attended — share the feedback link from the table');
        }
        return;
      }
    }
    toast.success(`Marked ${status}`);
  };

  const copyFeedback = async (token: string) => {
    const path = buildPublicFeedbackPath('psychiatrygraph', companyId, token);
    const url = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(url);
    toast.success('Feedback link copied');
  };

  const pending =
    store?.bookings.filter(
      (b) =>
        b.status === 'attended' &&
        b.feedback_token &&
        !b.feedback_submitted_at
    ).length || 0;

  return (
    <PsychiatrygraphWorkbench
      title="Bookings"
      titleAccent="front desk"
      description="Book patients onto diary slots. When you mark attended, a feedback link is issued so the patient can rate the visit."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            items={[
              {
                label: 'Open bookings',
                value: Number(summary?.bookingsOpen) || 0,
              },
              {
                label: 'Feedback pending',
                value: Number(summary?.pendingFeedback) || pending,
              },
              {
                label: 'Feedback received',
                value: Number(summary?.feedbackCount) || 0,
              },
            ]}
          />
          <FormCard title="Book patient" onSubmit={() => void add()} saving={saving}>
            <select
              className={fc()}
              value={form.appointment_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, appointment_id: e.target.value }))
              }
            >
              <option value="">Appointment…</option>
              {store.appointments
                .filter((a) => a.status === 'scheduled')
                .map((a) => {
                  const svc = store.services.find((s) => s.id === a.service_id);
                  return (
                    <option key={a.id} value={a.id}>
                      {a.date} {a.start_time} · {svc?.name || 'Service'}
                    </option>
                  );
                })}
            </select>
            <select
              className={fc()}
              value={form.patient_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, patient_id: e.target.value }))
              }
            >
              <option value="">Patient…</option>
              {store.patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </FormCard>
          <DataTable
            headers={[
              'When',
              'Service',
              'Patient',
              'Status',
              'Feedback',
              'Actions',
            ]}
            rows={store.bookings.map((b) => {
              const apt = store.appointments.find(
                (a) => a.id === b.appointment_id
              );
              const svc = store.services.find((s) => s.id === apt?.service_id);
              const pat = store.patients.find((p) => p.id === b.patient_id);
              return {
                id: b.id,
                cells: [
                  apt ? `${apt.date} ${apt.start_time}` : '—',
                  svc?.name || '—',
                  pat?.name || '—',
                  b.status,
                  b.feedback_submitted_at ? (
                    <span
                      key="fb"
                      className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
                    >
                      Received
                    </span>
                  ) : b.feedback_token && b.status === 'attended' ? (
                    <button
                      key="fb"
                      type="button"
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300"
                      onClick={() => void copyFeedback(b.feedback_token!)}
                    >
                      <Copy className="w-3 h-3" /> Send link
                    </button>
                  ) : (
                    '—'
                  ),
                  (
                    <span key="a" className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
                        onClick={() => void mark(b.id, 'attended')}
                      >
                        Attended
                      </button>
                      <button
                        type="button"
                        className="text-[10px] font-bold text-rose-600 dark:text-rose-300"
                        onClick={() => void mark(b.id, 'no_show')}
                      >
                        No-show
                      </button>
                    </span>
                  ),
                ],
              };
            })}
            onDelete={(id) =>
              void post({ entity: 'bookings', action: 'delete', id })
            }
          />
          {pending > 0 ? (
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <Link2 className="w-3.5 h-3.5" />
              {pending} patient(s) still need feedback — copy and send their
              link (SMS / WhatsApp / email).
            </p>
          ) : null}
        </div>
      )}
    </PsychiatrygraphWorkbench>
  );
}
