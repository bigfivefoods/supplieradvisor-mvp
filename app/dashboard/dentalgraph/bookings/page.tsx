'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  LoadingBlock,
  DentalgraphWorkbench,
  useDentalgraph,
} from '@/components/dental/DentalgraphWorkbench';
import { DataTable, FormCard, StatRow, fc } from '@/components/dental/DentalForm';

export default function BookingsPage() {
  const { store, loading, saving, post, summary } = useDentalgraph();
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
    await post({
      entity: 'bookings',
      action: 'upsert',
      record: { ...b, status },
    });
    toast.success(`Marked ${status}`);
  };

  return (
    <DentalgraphWorkbench
      title="Bookings"
      titleAccent="front desk"
      description="Book patients onto diary slots and mark attended or no-show."
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
                label: 'All bookings',
                value: store.bookings.length,
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
              'Source',
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
                  b.source || '—',
                  (
                    <span key="a" className="flex gap-1">
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
        </div>
      )}
    </DentalgraphWorkbench>
  );
}
