/**
 * Past and upcoming visit records for a patient — shared by the
 * MedicalAdvisor chart and the SA Member / portal profile.
 */

export type PatientVisitHistoryItem = {
  booking_id: string;
  appointment_id: string;
  date: string;
  start_time: string;
  end_time?: string | null;
  location?: string;
  service_name: string;
  practitioner_name?: string;
  status: string;
  upcoming: boolean;
  notes: Array<{
    id: string;
    at: string;
    body: string;
    author_name?: string | null;
    pain_score?: number | null;
    private?: boolean;
  }>;
  scripts: Array<{
    medication: string;
    strength?: string | null;
    instructions?: string | null;
    status?: string | null;
  }>;
  feedback_token?: string | null;
  feedback_submitted_at?: string | null;
};

type HistoryBooking = {
  id: string;
  appointment_id: string;
  patient_id?: string | null;
  status?: string;
  feedback_token?: string | null;
  feedback_submitted_at?: string | null;
};

type HistoryAppointment = {
  id: string;
  date: string;
  start_time: string;
  end_time?: string | null;
  location?: string;
  service_id?: string | null;
  practitioner_id?: string | null;
  status?: string;
};

export function buildPatientVisitHistory(opts: {
  patientId: string;
  bookings?: HistoryBooking[];
  appointments?: HistoryAppointment[];
  services?: Array<{ id: string; name: string }>;
  practitioners?: Array<{ id: string; name: string }>;
  visitNotes?: Array<{
    id: string;
    person_id: string;
    booking_id?: string | null;
    appointment_id?: string | null;
    body?: string | null;
    private?: boolean;
    created_at?: string;
    author_name?: string | null;
    pain_score?: number | null;
  }>;
  scripts?: Array<{
    appointment_id?: string | null;
    booking_id?: string | null;
    medication?: string | null;
    strength?: string | null;
    instructions?: string | null;
    status?: string | null;
  }>;
  /** When true, omit private visit notes (patient / PWA). */
  patientFacing?: boolean;
  today?: string;
}): PatientVisitHistoryItem[] {
  const today = opts.today || new Date().toISOString().slice(0, 10);
  const patientId = String(opts.patientId || '');
  if (!patientId) return [];

  const rows: PatientVisitHistoryItem[] = [];
  for (const b of opts.bookings || []) {
    if (b.patient_id !== patientId) continue;
    if (b.status === 'cancelled') continue;
    const a = (opts.appointments || []).find((x) => x.id === b.appointment_id);
    if (!a || a.status === 'cancelled') continue;
    const svc = (opts.services || []).find((s) => s.id === a.service_id);
    const prac = (opts.practitioners || []).find(
      (p) => p.id === a.practitioner_id
    );
    const notes = (opts.visitNotes || [])
      .filter((n) => n.person_id === patientId)
      .filter((n) => {
        if (opts.patientFacing && n.private === true) return false;
        if (n.appointment_id && n.appointment_id === a.id) return true;
        if (n.booking_id && n.booking_id === b.id) return true;
        return false;
      })
      .sort((x, y) =>
        String(y.created_at || '').localeCompare(String(x.created_at || ''))
      )
      .map((n) => ({
        id: n.id,
        at: n.created_at || a.date,
        body: String(n.body || '').trim(),
        author_name: n.author_name || null,
        pain_score: n.pain_score ?? null,
        private: n.private === true,
      }))
      .filter((n) => n.body);
    const scripts = (opts.scripts || [])
      .filter(
        (s) =>
          s.appointment_id === a.id ||
          (s.booking_id && s.booking_id === b.id)
      )
      .map((s) => ({
        medication: String(s.medication || '').trim(),
        strength: s.strength || null,
        instructions: s.instructions || null,
        status: s.status || null,
      }))
      .filter((s) => s.medication);
    const upcoming =
      a.date >= today &&
      b.status !== 'attended' &&
      b.status !== 'no_show' &&
      a.status !== 'completed';
    rows.push({
      booking_id: b.id,
      appointment_id: a.id,
      date: a.date,
      start_time: String(a.start_time || '').slice(0, 5),
      end_time: a.end_time ? String(a.end_time).slice(0, 5) : null,
      location: a.location,
      service_name: svc?.name || 'Appointment',
      practitioner_name: prac?.name,
      status: String(b.status || a.status || 'booked'),
      upcoming,
      notes,
      scripts,
      feedback_token: b.feedback_token || null,
      feedback_submitted_at: b.feedback_submitted_at || null,
    });
  }
  rows.sort((x, y) =>
    x.date === y.date
      ? y.start_time.localeCompare(x.start_time)
      : y.date.localeCompare(x.date)
  );
  return rows;
}
