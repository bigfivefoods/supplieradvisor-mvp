'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  LoadingBlock,
  MedicalgraphWorkbench,
  useMedicalgraph,
} from '@/components/clinic/MedicalgraphWorkbench';
import { DataTable, FormCard, StatRow, fc } from '@/components/clinic/MedicalForm';
import {
  PracticeScheduleCalendar,
  type DiaryScope,
  type ScheduleEvent,
} from '@/components/schedule/PracticeScheduleCalendar';
import { WorkingHoursEditor } from '@/components/schedule/WorkingHoursEditor';
import { PracticeProfilePdfButton } from '@/components/schedule/PracticeProfilePdfButton';
import { ScheduleEventPeek } from '@/components/schedule/ScheduleEventPeek';
import {
  RecurrenceFields,
  emptyRecurrenceForm,
  recurrenceApiPayload,
  validateRecurrenceForm,
  type RecurrenceFormValue,
} from '@/components/schedule/RecurrenceFields';
import { normalizeWorkingHours } from '@/lib/schedule/working-hours';
import { AdvisorWaitlistDesk } from '@/components/services/AdvisorWaitlistDesk';
import {
  buildDeskQueueRows,
  buildDeskSlotWaitlist,
} from '@/lib/services/advisor-waitlist-desk';
import { ClinicDiaryKindFields } from '@/components/clinic/ClinicDiaryKindFields';
import { ClinicAppointmentVisitDesk } from '@/components/clinic/ClinicAppointmentVisitDesk';
import { appointmentVisitPatients } from '@/lib/clinic/appointment-visit';
import {
  appointmentKindLabel,
  appointmentKindOf,
  clinicAppointmentSaveFields,
  consultServices,
  patchFormForAppointmentKind,
  type ClinicAppointmentKind,
  type ClinicPersonalReason,
} from '@/lib/clinic/appointment-kind';

export default function CalendarPage() {
  const { companyId, store, loading, saving, post, summary, load } =
    useMedicalgraph();
  const [personFilter, setPersonFilter] = useState('');
  const [diaryScope, setDiaryScope] = useState<DiaryScope>('practice');
  /** null = create mode; set = open appointment for view/edit (main practice diary) */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState({
    appointment_kind: 'consult' as ClinicAppointmentKind,
    personal_reason: 'personal' as ClinicPersonalReason,
    notes: '',
    service_id: '',
    practitioner_id: '',
    date: new Date().toISOString().slice(0, 10),
    start_time: '09:00',
    end_time: '09:45',
    duration_min: '45',
    location: '',
    public: true,
    status: 'scheduled',
    patient_id: '',
    family_member_id: '',
  });
  const [recurrence, setRecurrence] = useState<RecurrenceFormValue>(
    emptyRecurrenceForm
  );

  const closeEditor = () => {
    setEditorOpen(false);
    setSelectedId(null);
  };

  const openAppointment = (id: string) => {
    const a = store?.appointments.find((x) => x.id === id);
    if (!a) {
      toast.error('Appointment not found');
      return;
    }
    const svc = store?.services.find((s) => s.id === a.service_id);
    const kind = appointmentKindOf(a, store?.services || []);
    setSelectedId(a.id);
    setRecurrence(emptyRecurrenceForm());
    setForm({
      appointment_kind: kind,
      personal_reason: (a.personal_reason as ClinicPersonalReason) || 'personal',
      notes: a.notes || '',
      service_id: a.service_id || '',
      practitioner_id: a.practitioner_id || '',
      date: a.date,
      start_time: String(a.start_time || '09:00').slice(0, 5),
      end_time: String(a.end_time || '').slice(0, 5),
      duration_min: String(
        a.duration_min ?? svc?.default_duration_min ?? 45
      ),
      location: a.location || '',
      public: kind === 'personal' ? false : a.public === true,
      status: a.status || 'scheduled',
      patient_id: '',
      family_member_id: '',
    });
    setEditorOpen(true);
  };

  const startCreate = (partial?: {
    date?: string;
    start_time?: string;
    practitioner_id?: string;
  }) => {
    setSelectedId(null);
    setRecurrence(emptyRecurrenceForm());
    setForm((f) => ({
      ...f,
      appointment_kind: 'consult',
      personal_reason: 'personal',
      notes: '',
      service_id: f.service_id,
      practitioner_id:
        partial?.practitioner_id || personFilter || f.practitioner_id || '',
      date: partial?.date || f.date,
      start_time: partial?.start_time || '09:00',
      end_time: f.end_time || '09:45',
      duration_min: f.duration_min || '45',
      location: '',
      public: true,
      status: 'scheduled',
      patient_id: '',
      family_member_id: '',
    }));
    setEditorOpen(true);
  };

  const events: ScheduleEvent[] = useMemo(() => {
    if (!store) return [];
    return store.appointments.map((a) => {
      const kind = appointmentKindOf(a, store.services);
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
      const personalTitle = appointmentKindLabel(kind, a.personal_reason);
      return {
        id: a.id,
        date: a.date,
        start_time: a.start_time,
        end_time: a.end_time,
        duration_min: a.duration_min ?? svc?.default_duration_min ?? 45,
        title:
          kind === 'personal'
            ? a.notes?.split('\n')[0] || personalTitle
            : svc?.name || 'Appointment',
        subtitle: a.location || undefined,
        person_id: a.practitioner_id || null,
        person_name: prac?.name,
        status: a.status,
        public: a.public === true,
        meta:
          kind === 'personal'
            ? personalTitle
            : patients
              ? patients
              : a.public
                ? 'Open public slot'
                : undefined,
        tone: kind === 'personal' ? ('indigo' as const) : ('emerald' as const),
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

  const deskQueue = useMemo(() => {
    if (!store) return [];
    return buildDeskQueueRows(
      store.waitlist_queue,
      store.patients,
      store.practitioners
    );
  }, [store]);

  const deskSlotWaitlist = useMemo(() => {
    if (!store) return [];
    return buildDeskSlotWaitlist({
      bookings: store.bookings,
      appointments: store.appointments,
      people: store.patients,
      services: store.services,
      clinicians: store.practitioners,
    });
  }, [store]);

  const rosterOnSelected = useMemo(() => {
    if (!store || !selectedId) return [];
    return store.bookings.filter(
      (b) =>
        b.appointment_id === selectedId &&
        b.status !== 'cancelled' &&
        b.patient_id
    );
  }, [store, selectedId]);

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

  const selectedPatientFamily = useMemo(() => {
    if (!store || !form.patient_id) return [];
    const p = store.patients.find((x) => x.id === form.patient_id);
    return (p?.family || []).filter((m) => m.active !== false);
  }, [store, form.patient_id]);


  const deleteSelected = async () => {
    if (!selectedId || !store) return;
    const prev = store.appointments.find((x) => x.id === selectedId);
    if (!prev) {
      toast.error('Appointment not found');
      return;
    }
    const seriesCount = prev.series_id
      ? store.appointments.filter((a) => a.series_id === prev.series_id).length
      : 0;
    if (
      !confirm(
        `Delete this appointment on ${prev.date} at ${String(prev.start_time).slice(0, 5)}? Bookings on it will be removed.`
      )
    ) {
      return;
    }
    let deleteSeries = false;
    if (seriesCount > 1) {
      deleteSeries = confirm(
        `This appointment is part of a series (${seriesCount}). OK = delete the entire series, Cancel = delete only this date.`
      );
    }
    try {
      const data = await post({
        entity: 'appointments',
        action: 'delete',
        id: selectedId,
        delete_series: deleteSeries,
      });
      toast.success(
        (data as { message?: string })?.message ||
          (deleteSeries ? 'Series deleted' : 'Appointment deleted')
      );
      setSelectedId(null);
      setRecurrence(emptyRecurrenceForm());
      setEditorOpen(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not delete appointment'
      );
    }
  };

  const save = async () => {
    const personal = form.appointment_kind === 'personal';
    if (!personal && !form.service_id) {
      toast.error('Pick a service');
      return;
    }
    if (!form.practitioner_id) {
      toast.error('Assign a practitioner');
      return;
    }
    const fields = clinicAppointmentSaveFields({
      kind: form.appointment_kind,
      reason: form.personal_reason,
      notes: form.notes,
      start_time: form.start_time,
      end_time: form.end_time,
      duration_min: form.duration_min,
      service_id: form.service_id,
      public: form.public,
      services: store?.services || [],
    });

    if (!selectedId && recurrence.frequency !== 'none') {
      const recErr = validateRecurrenceForm(recurrence);
      if (recErr) {
        toast.error(recErr);
        return;
      }
      const payload = recurrenceApiPayload(recurrence, form.date);
      try {
        const data = await post({
          action: 'create_appointment_series',
          service_id: fields.service_id,
          practitioner_id: form.practitioner_id,
          date: form.date,
          start_time: fields.start_time,
          end_time: fields.end_time,
          duration_min: fields.duration_min,
          location: form.location || undefined,
          public: fields.public,
          appointment_kind: fields.appointment_kind,
          personal_reason: fields.personal_reason,
          notes: fields.notes,
          patient_id: personal ? undefined : form.patient_id || undefined,
          family_member_id: personal ? null : form.family_member_id || null,
          ...payload,
        });
        const appointments = (data.appointments || []) as Array<{ id: string }>;
        const firstId = appointments[0]?.id || null;
        toast.success(
          data.message ||
            (form.patient_id
              ? 'Series scheduled and patient booked'
              : 'Series scheduled')
        );
        setRecurrence(emptyRecurrenceForm());
        if (firstId) {
          setSelectedId(firstId);
          setForm((f) => ({ ...f, patient_id: '', family_member_id: '' }));
        }
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : 'Could not schedule series'
        );
      }
      return;
    }

    const { findClinicianDiaryConflict } = await import(
      '@/lib/schedule/clinician-diary'
    );
    const conflict = findClinicianDiaryConflict({
      appointments: store?.appointments || [],
      clinicianId: form.practitioner_id,
      clinicianField: 'practitioner_id',
      date: form.date,
      start_time: fields.start_time,
      end_time: fields.end_time,
      duration_min: fields.duration_min,
      excludeId: selectedId || undefined,
    });
    if (conflict.conflict) {
      toast.error(conflict.message);
      return;
    }

    const appointmentId =
      selectedId ||
      `apt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const prev = selectedId
      ? store?.appointments.find((x) => x.id === selectedId)
      : null;

    try {
      await post({
        entity: 'appointments',
        action: 'upsert',
        record: {
          ...(prev || {}),
          id: appointmentId,
          service_id: fields.service_id,
          practitioner_id: form.practitioner_id,
          date: form.date,
          start_time: fields.start_time,
          end_time: fields.end_time,
          duration_min: fields.duration_min,
          location: form.location,
          public: fields.public,
          appointment_kind: fields.appointment_kind,
          personal_reason: fields.personal_reason,
          notes: fields.notes,
          status: form.status || 'scheduled',
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save appointment');
      return;
    }

    if (!personal && form.patient_id) {
      await post({
        entity: 'bookings',
        action: 'upsert',
        record: {
          appointment_id: appointmentId,
          patient_id: form.patient_id,
          family_member_id: form.family_member_id || null,
          status: 'booked',
          source: 'desk',
        },
      });
      toast.success(
        selectedId
          ? form.family_member_id
            ? 'Appointment updated — family member booked'
            : 'Appointment updated and patient booked'
          : form.family_member_id
            ? 'Appointment scheduled — family member booked'
            : 'Appointment scheduled and patient booked'
      );
    } else {
      toast.success(
        selectedId ? 'Appointment updated' : 'Appointment scheduled'
      );
    }

    setSelectedId(appointmentId);
    setForm((f) => ({ ...f, patient_id: '', family_member_id: '' }));
  };

  return (
    <MedicalgraphWorkbench
      title="Calendar"
      titleAccent="main practice diary"
      description="Main medical diary: click an appointment to open (view/edit · book patient). Click empty time to schedule. Desk waitlist is on this page and under Desk · bookings. Exclusive clinician books — no double-booking."
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
                label: 'Waitlist queue',
                value: deskQueue.length,
              },
              {
                label: 'On board',
                value: events.filter((e) => e.status === 'scheduled').length,
              },
            ]}
          />

          <AdvisorWaitlistDesk
            queue={deskQueue}
            slotWaitlist={deskSlotWaitlist}
            accentClass="border-emerald-200"
            post={async (body) => {
              await post(body);
            }}
            onRefresh={() => {
              void load();
            }}
            calendarHref="/dashboard/medicalgraph/calendar"
          />

          <p className="text-xs text-slate-500 -mt-2">
            Front desk tools:{' '}
            <Link
              href="/dashboard/medicalgraph/bookings"
              className="font-bold text-emerald-700 underline"
            >
              Desk · bookings
            </Link>{' '}
            (mark attended, feedback links) · this calendar is the main diary.
          </p>

          <WorkingHoursEditor
            value={workingHours}
            defaultCollapsed
            onSave={saveHours}
            saving={saving}
            title="Clinic working hours"
            description="Open days and times for this medical practice. Closed days are dimmed; day view uses your open window."
            accentClass="border-emerald-200 dark:border-emerald-800"
          />

          <div className="flex flex-wrap items-center gap-2 -mt-2">
            <PracticeProfilePdfButton
              companyId={companyId}
              module="medicalgraph"
              label="Download practice PDF"
            />
            <span className="text-[11px] text-slate-500">
              Practice sheet (hours, team, services). Schedule PDFs: A4 PDF on the calendar.
            </span>
          </div>

          <PracticeScheduleCalendar
            title="Clinic schedule"
            printBrand={
              store.settings?.brand_name || 'MedicalAdvisor · SupplierAdvisor'
            }
            pdfExport={{
              companyId,
              module: 'medicalgraph',
              personId: personFilter || null,
            }}
            accent="emerald"
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
            slotHint="Click empty time to add · click an appointment to open"
            selectedEventId={selectedId}
            onSelectDate={(date) => setForm((f) => ({ ...f, date }))}
            onSelectSlot={(slot) => {
              startCreate({
                date: slot.date,
                start_time: slot.start_time.slice(0, 5),
                practitioner_id:
                  slot.person_id || personFilter || undefined,
              });
              toast.message('New appointment slot', {
                description: `${slot.date} at ${slot.start_time.slice(0, 5)} — finish details in the pop-out`,
              });
            }}
            onSelectEvent={(ev) => {
              openAppointment(ev.id);
              toast.message('Appointment open', {
                description: `${ev.start_time.slice(0, 5)} · ${ev.title} — edit in the pop-out`,
              });
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 -mt-2">
            <p className="text-xs text-slate-500">
              Click an appointment to edit it in a pop-out. Expand the calendar
              to fill the screen. Use the month name to jump months.
            </p>
            <button
              type="button"
              className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-800"
              onClick={() => startCreate({ date: form.date })}
            >
              + New appointment
            </button>
          </div>

          <ScheduleEventPeek
            open={editorOpen}
            title={
              selectedId
                ? `Open appointment · ${form.date} ${form.start_time}`
                : 'Schedule appointment'
            }
            subtitle={
              selectedId
                ? 'Edit this slot, book a patient, then complete notes, script, invoice or claim'
                : 'New appointment on the diary'
            }
            onClose={closeEditor}
          >
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                {selectedId
                  ? 'Viewing / editing open appointment. Save changes, or book another patient onto this slot.'
                  : 'Create a new appointment, or click an existing one on the calendar to open it.'}
              </p>
              {selectedId ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800"
                    onClick={() => startCreate({ date: form.date })}
                  >
                    + New appointment
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                    onClick={() => void deleteSelected()}
                  >
                    Delete appointment
                  </button>
                </div>
              ) : null}
            </div>

            <FormCard
              title={
                selectedId
                  ? `Open appointment · ${form.date} ${form.start_time}`
                  : 'Schedule appointment'
              }
              onSubmit={() => void save()}
              saving={saving}
              submitLabel={
                selectedId
                  ? 'Save changes'
                  : recurrence.frequency !== 'none'
                    ? 'Schedule series'
                    : 'Schedule'
              }
            >
              <ClinicDiaryKindFields
                kind={form.appointment_kind}
                reason={form.personal_reason}
                notes={form.notes}
                endTime={form.end_time}
                inputClass={fc()}
                peopleWord="practitioner"
                onKind={(kind) =>
                  setForm((f) =>
                    patchFormForAppointmentKind(f, kind, store.services)
                  )
                }
                onReason={(reason) =>
                  setForm((f) =>
                    patchFormForAppointmentKind(
                      { ...f, personal_reason: reason },
                      'personal',
                      store.services
                    )
                  )
                }
                onNotes={(notes) => setForm((f) => ({ ...f, notes }))}
                onEndTime={(end_time) => setForm((f) => ({ ...f, end_time }))}
              />
              {form.appointment_kind !== 'personal' ? (
              <select
                className={fc()}
                value={form.service_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, service_id: e.target.value }))
                }
              >
                <option value="">Service…</option>
                {consultServices(store.services).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
              ) : null}
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
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
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
              {(store.settings?.rooms || []).length > 0 ? (
                <select
                  className={fc()}
                  value={form.location}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, location: e.target.value }))
                  }
                >
                  <option value="">Room / resource…</option>
                  {(store.settings?.rooms || []).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  {form.location &&
                  !(store.settings?.rooms || []).includes(form.location) ? (
                    <option value={form.location}>{form.location}</option>
                  ) : null}
                </select>
              ) : (
                <input
                  className={fc()}
                  placeholder="Location / room (set list under Website)"
                  value={form.location}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, location: e.target.value }))
                  }
                />
              )}
              {selectedId ? (
                <select
                  className={fc()}
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value }))
                  }
                >
                  <option value="scheduled">Status: scheduled</option>
                  <option value="completed">Status: completed</option>
                  <option value="cancelled">Status: cancelled</option>
                </select>
              ) : (
                <RecurrenceFields
                  value={recurrence}
                  onChange={setRecurrence}
                  startDate={form.date}
                  inputClass={fc()}
                  accent="emerald"
                  unitLabel="appointments"
                />
              )}
              {form.appointment_kind !== 'personal' ? (
              <>
              <select
                className={fc()}
                value={form.patient_id}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    patient_id: e.target.value,
                    family_member_id: '',
                  }))
                }
              >
                <option value="">
                  {selectedId
                    ? 'Book another patient (desk)…'
                    : 'Book patient (optional)…'}
                </option>
                {store.patients
                  .filter((p) => p.active !== false)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.booking_soft_block ? ' ⚠ no-shows' : ''}
                      {p.email ? ` · ${p.email}` : ''}
                    </option>
                  ))}
              </select>
              {form.patient_id && selectedPatientFamily.length > 0 ? (
                <select
                  className={fc()}
                  value={form.family_member_id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      family_member_id: e.target.value,
                    }))
                  }
                >
                  <option value="">Attendee: account holder</option>
                  {selectedPatientFamily.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.relationship ? ` · ${m.relationship}` : ''}
                      {m.is_minor ? ' (child)' : ''}
                    </option>
                  ))}
                </select>
              ) : null}
              </>
              ) : null}
              {form.date && form.start_time ? (
                <a
                  className="text-xs font-bold text-emerald-700 underline"
                  href={`/api/public/advisor/ics?module=medicalgraph&date=${encodeURIComponent(form.date)}&start=${encodeURIComponent(form.start_time)}&title=${encodeURIComponent('MedicalAdvisor appointment')}&duration=${encodeURIComponent(form.duration_min || '45')}&location=${encodeURIComponent(form.location || '')}`}
                >
                  Download .ics (add to calendar)
                </a>
              ) : null}
              {form.appointment_kind !== 'personal' ? (
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
              ) : null}
              {selectedId && rosterOnSelected.length > 0 ? (
                <p className="sm:col-span-2 lg:col-span-3 text-[11px] text-slate-600 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2">
                  <strong>Booked on this slot:</strong>{' '}
                  {rosterOnSelected
                    .map((b) => {
                      const p = store.patients.find(
                        (x) => x.id === b.patient_id
                      );
                      return (
                        b.family_member_name || p?.name || b.patient_id
                      );
                    })
                    .join(', ')}
                </p>
              ) : null}
            </FormCard>
            {selectedId && form.appointment_kind !== 'personal' ? (
              <ClinicAppointmentVisitDesk
                module="medicalgraph"
                companyId={companyId}
                appointmentId={selectedId}
                date={form.date}
                startTime={form.start_time}
                serviceName={
                  store.services.find((s) => s.id === form.service_id)?.name
                }
                serviceId={form.service_id || null}
                servicePriceZar={
                  store.services.find((s) => s.id === form.service_id)
                    ?.price_zar
                }
                treatingName={
                  store.practitioners.find((p) => p.id === form.practitioner_id)
                    ?.name
                }
                treatingId={form.practitioner_id || null}
                patients={appointmentVisitPatients({
                  appointmentId: selectedId,
                  bookings: store.bookings,
                  patients: store.patients,
                })}
                visitNotes={store.visit_notes}
                post={post}
                saving={saving}
                accent="emerald"
                onRefresh={() => {
                  void load();
                }}
              />
            ) : null}
          </div>
          </ScheduleEventPeek>

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
                const prac = store.practitioners.find(
                  (p) => p.id === a.practitioner_id
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
            onDelete={(id) => {
              if (selectedId === id) closeEditor();
              void post({ entity: 'appointments', action: 'delete', id });
            }}
          />
        </div>
      )}
    </MedicalgraphWorkbench>
  );
}
