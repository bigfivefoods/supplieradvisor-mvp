'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  LoadingBlock,
  DentalgraphWorkbench,
  useDentalgraph,
} from '@/components/dental/DentalgraphWorkbench';
import { DataTable, FormCard, StatRow, fc } from '@/components/dental/DentalForm';

export default function CalendarPage() {
  const { store, loading, saving, post, summary } = useDentalgraph();
  const [form, setForm] = useState({
    service_id: '',
    staff_id: '',
    date: new Date().toISOString().slice(0, 10),
    start_time: '09:00',
    duration_min: '45',
    location: '',
    public: true,
  });

  const add = async () => {
    if (!form.service_id) {
      toast.error('Pick a service');
      return;
    }
    if (!form.staff_id) {
      toast.error('Assign a clinician');
      return;
    }
    await post({
      entity: 'appointments',
      action: 'upsert',
      record: {
        service_id: form.service_id,
        staff_id: form.staff_id,
        date: form.date,
        start_time: form.start_time,
        duration_min: Number(form.duration_min) || 45,
        location: form.location,
        public: form.public,
        status: 'scheduled',
      },
    });
    toast.success('Appointment scheduled');
  };

  return (
    <DentalgraphWorkbench
      title="Calendar"
      titleAccent="diary"
      description="Schedule assessments and treatments — assign staff and optional public slots."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            items={[
              {
                label: 'Today',
                value: Number(summary?.appointmentsToday) || 0,
              },
              {
                label: 'Upcoming',
                value: Number(summary?.appointmentsUpcoming) || 0,
              },
            ]}
          />
          <FormCard
            title="Schedule appointment"
            onSubmit={() => void add()}
            saving={saving}
            submitLabel="Schedule"
          >
            <select
              className={fc()}
              value={form.service_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, service_id: e.target.value }))
              }
            >
              <option value="">Service…</option>
              {store.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name}
                </option>
              ))}
            </select>
            <select
              className={fc()}
              value={form.staff_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, staff_id: e.target.value }))
              }
            >
              <option value="">Clinician…</option>
              {store.staff.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              className={fc()}
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
            <input
              className={fc()}
              type="time"
              value={form.start_time}
              onChange={(e) =>
                setForm((f) => ({ ...f, start_time: e.target.value }))
              }
            />
            <input
              className={fc()}
              type="number"
              min={5}
              placeholder="Duration min"
              value={form.duration_min}
              onChange={(e) =>
                setForm((f) => ({ ...f, duration_min: e.target.value }))
              }
            />
            <input
              className={fc()}
              placeholder="Location / room"
              value={form.location}
              onChange={(e) =>
                setForm((f) => ({ ...f, location: e.target.value }))
              }
            />
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.public}
                onChange={(e) =>
                  setForm((f) => ({ ...f, public: e.target.checked }))
                }
              />
              Public slot
            </label>
          </FormCard>
          <DataTable
            headers={[
              'Date',
              'Time',
              'Service',
              'Clinician',
              'Status',
              'Public',
            ]}
            rows={[...store.appointments]
              .sort((a, b) =>
                a.date === b.date
                  ? a.start_time.localeCompare(b.start_time)
                  : b.date.localeCompare(a.date)
              )
              .map((a) => {
                const svc = store.services.find((s) => s.id === a.service_id);
                const prac = store.staff.find(
                  (p) => p.id === a.staff_id
                );
                return {
                  id: a.id,
                  cells: [
                    a.date,
                    a.start_time,
                    svc?.name || '—',
                    prac?.name || '—',
                    a.status,
                    a.public ? 'Yes' : 'No',
                  ],
                };
              })}
            onDelete={(id) =>
              void post({ entity: 'appointments', action: 'delete', id })
            }
          />
        </div>
      )}
    </DentalgraphWorkbench>
  );
}
