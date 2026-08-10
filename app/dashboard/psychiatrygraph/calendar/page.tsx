'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  LoadingBlock,
  PsychiatrygraphWorkbench,
  usePsychiatrygraph,
} from '@/components/clinic/PsychiatrygraphWorkbench';
import { DataTable, FormCard, StatRow, fc } from '@/components/clinic/PsychiatryForm';
import {
  PracticeScheduleCalendar,
  type DiaryScope,
  type ScheduleEvent,
} from '@/components/schedule/PracticeScheduleCalendar';
import { WorkingHoursEditor } from '@/components/schedule/WorkingHoursEditor';
import { normalizeWorkingHours } from '@/lib/schedule/working-hours';

export default function CalendarPage() {
  const { store, loading, saving, post, summary } = usePsychiatrygraph();
  const [personFilter, setPersonFilter] = useState('');
  const [diaryScope, setDiaryScope] = useState<DiaryScope>('practice');
  const [form, setForm] = useState({
    service_id: '',
    practitioner_id: '',
    date: new Date().toISOString().slice(0, 10),
    start_time: '09:00',
    duration_min: '45',
    location: '',
    public: true,
  });

  const events: ScheduleEvent[] = useMemo(() => {
    if (!store) return [];
    return store.appointments.map((a) => {
      const svc = store.services.find((s) => s.id === a.service_id);
      const prac = store.practitioners.find((p) => p.id === a.practitioner_id);
      const booked = store.bookings.filter(
        (b) =>
          b.appointment_id === a.id &&
          b.status !== 'cancelled' &&
          b.patient_id
      );
      const patients = booked
        .map((b) => store.patients.find((p) => p.id === b.patient_id)?.name)
        .filter(Boolean)
        .join(', ');
      return {
        id: a.id,
        date: a.date,
        start_time: a.start_time,
        end_time: a.end_time,
        duration_min: a.duration_min ?? svc?.default_duration_min ?? 45,
        title: svc?.name || 'Appointment',
        subtitle: a.location || undefined,
        person_id: a.practitioner_id || null,
        person_name: prac?.name,
        status: a.status,
        public: a.public === true,
        meta: patients
          ? patients
          : a.public
            ? 'Open public slot'
            : undefined,
        tone: 'indigo' as const,
      };
    });
  }, [store]);

  const people = useMemo(
    () =>
      (store?.practitioners || [])
        .filter((p) => p.active !== false)
        .map((p) => ({
          id: p.id,
          name: p.name,
          role: (p.disciplines || [])
            .slice(0, 2)
            .join(', ') || undefined,
        })),
    [store]
  );

  const workingHours = useMemo(
    () => normalizeWorkingHours(store?.settings?.working_hours),
    [store?.settings?.working_hours]
  );

  const saveHours = async (hours: typeof workingHours) => {
    await post({
      action: 'update_settings',
      settings: {
        ...(store?.settings || {}),
        working_hours: hours,
      },
    });
    toast.success('Working hours saved');
  };

  const add = async () => {
    if (!form.service_id) {
      toast.error('Pick a service');
      return;
    }
    if (!form.practitioner_id) {
      toast.error('Assign a practitioner');
      return;
    }
    await post({
      entity: 'appointments',
      action: 'upsert',
      record: {
        service_id: form.service_id,
        practitioner_id: form.practitioner_id,
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
    <PsychiatrygraphWorkbench
      title="Calendar"
      titleAccent="practice diary"
      description="Day, week and month views — set working hours, filter by practitioner. Schedule new slots below."
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
              {
                label: 'On board',
                value: events.filter((e) => e.status === 'scheduled').length,
              },
            ]}
          />

          <WorkingHoursEditor
            value={workingHours}
            defaultCollapsed
            onSave={saveHours}
            saving={saving}
            title="Clinic working hours"
            description="Open days and times for this practice. Closed days are dimmed; day view uses your open window."
            accentClass="border-indigo-200 dark:border-indigo-800"
          />

          <PracticeScheduleCalendar
            title="Clinic schedule"
            accent="indigo"
            events={events}
            people={people}
            peopleLabel="Practitioner"
            workingHours={workingHours}
            diaryScope={diaryScope}
            onDiaryScopeChange={(scope) => {
              setDiaryScope(scope);
              if (scope === 'practice') setPersonFilter('');
            }}
            showDiaryScopeToggle
            personFilter={personFilter}
            onPersonFilterChange={(id) => {
              setPersonFilter(id);
              if (id) setForm((f) => ({ ...f, practitioner_id: id }));
            }}
            initialDate={form.date}
            emptyLabel="No appointments"
            slotHint="Click empty time to add appointment"
            onSelectDate={(date) => setForm((f) => ({ ...f, date }))}
            onSelectSlot={(slot) => {
              setForm((f) => ({
                ...f,
                date: slot.date,
                start_time: slot.start_time.slice(0, 5),
                practitioner_id:
                  slot.person_id || f.practitioner_id || personFilter || '',
              }));
              toast.message('Time selected', {
                description: `${slot.date} at ${slot.start_time.slice(0, 5)} — finish details below`,
              });
            }}
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
              value={form.practitioner_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, practitioner_id: e.target.value }))
              }
            >
              <option value="">Practitioner…</option>
              {store.practitioners.map((p) => (
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
              'Practitioner',
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
                const prac = store.practitioners.find((p) => p.id === a.practitioner_id);
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
    </PsychiatrygraphWorkbench>
  );
}
