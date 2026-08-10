/**
 * Build desk waitlist views from clinic/fit stores.
 */
import type { ClinicWaitlistQueueEntry } from '@/lib/services/clinic-waitlist';
import { queuePosition } from '@/lib/services/clinic-waitlist';

export function buildDeskQueueRows(
  queue: ClinicWaitlistQueueEntry[] | undefined,
  people: Array<{ id: string; name: string }>,
  clinicians?: Array<{ id: string; name: string }>
) {
  const open = (queue || [])
    .filter((q) => q.status === 'waiting')
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return open.map((q) => ({
    id: q.id,
    patient_id: q.patient_id,
    patient_name:
      q.patient_name ||
      people.find((p) => p.id === q.patient_id)?.name ||
      q.patient_id,
    accept_any_clinician: q.accept_any_clinician,
    preferred_clinician_id: q.preferred_clinician_id,
    preferred_clinician_name: q.preferred_clinician_id
      ? clinicians?.find((c) => c.id === q.preferred_clinician_id)?.name || null
      : null,
    service_name: q.service_name,
    notes: q.notes,
    status: q.status,
    created_at: q.created_at,
    position: queuePosition(queue || [], q.id),
  }));
}

export function buildDeskSlotWaitlist(opts: {
  bookings: Array<{
    id: string;
    patient_id?: string;
    client_id?: string;
    appointment_id?: string;
    session_id?: string;
    status: string;
    booked_at?: string;
  }>;
  appointments?: Array<{
    id: string;
    date: string;
    start_time: string;
    service_id?: string;
    staff_id?: string | null;
    practitioner_id?: string | null;
  }>;
  people: Array<{ id: string; name: string }>;
  services?: Array<{ id: string; name: string }>;
  clinicians?: Array<{ id: string; name: string }>;
}) {
  const byAppt: Record<string, typeof opts.bookings> = {};
  for (const b of opts.bookings) {
    if (b.status !== 'waitlist') continue;
    const aid = b.appointment_id || b.session_id || '';
    if (!aid) continue;
    if (!byAppt[aid]) byAppt[aid] = [];
    byAppt[aid].push(b);
  }
  const rows: Array<{
    booking_id: string;
    patient_id: string;
    patient_name?: string;
    appointment_id: string;
    date?: string;
    start_time?: string;
    service_name?: string;
    clinician_name?: string;
    position: number;
    booked_at?: string;
  }> = [];
  for (const [aid, list] of Object.entries(byAppt)) {
    const sorted = [...list].sort((a, b) =>
      String(a.booked_at || '').localeCompare(String(b.booked_at || ''))
    );
    const appt = opts.appointments?.find((a) => a.id === aid);
    const svc = appt?.service_id
      ? opts.services?.find((s) => s.id === appt.service_id)
      : undefined;
    const clinId = appt?.staff_id || appt?.practitioner_id;
    const clin = clinId
      ? opts.clinicians?.find((c) => c.id === clinId)
      : undefined;
    sorted.forEach((b, i) => {
      const pid = b.patient_id || b.client_id || '';
      rows.push({
        booking_id: b.id,
        patient_id: pid,
        patient_name: opts.people.find((p) => p.id === pid)?.name,
        appointment_id: aid,
        date: appt?.date,
        start_time: appt?.start_time,
        service_name: svc?.name,
        clinician_name: clin?.name,
        position: i + 1,
        booked_at: b.booked_at,
      });
    });
  }
  return rows.sort((a, b) =>
    String(a.date || '').localeCompare(String(b.date || ''))
  );
}
