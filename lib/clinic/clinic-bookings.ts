/**
 * One patient, one seat on an appointment. Dedupe leftover duplicate booking rows.
 */

export function clinicBookingSeatKey(b: {
  appointment_id?: string | null;
  patient_id?: string | null;
  family_member_id?: string | null;
}): string {
  return `${b.appointment_id || ''}::${b.patient_id || ''}::${b.family_member_id || ''}`;
}

export function clinicBookingStamp(row: {
  updated_at?: string | null;
  booked_at?: string | null;
  feedback_requested_at?: string | null;
}): string {
  return String(
    row.updated_at || row.feedback_requested_at || row.booked_at || ''
  );
}

function statusRank(status: string): number {
  if (status === 'attended') return 5;
  if (status === 'no_show') return 4;
  if (status === 'booked') return 3;
  if (status === 'waitlist') return 2;
  return 1;
}

export function pickPreferredClinicBooking<
  T extends { status: string; updated_at?: string | null; booked_at?: string | null },
>(a: T, b: T): T {
  const rank = statusRank(a.status) - statusRank(b.status);
  if (rank !== 0) return rank > 0 ? a : b;
  return clinicBookingStamp(a) >= clinicBookingStamp(b) ? a : b;
}

export function findClinicAppointmentSeat<
  T extends {
    appointment_id: string;
    patient_id: string;
    family_member_id?: string | null;
    status: string;
    updated_at?: string | null;
    booked_at?: string | null;
  },
>(
  bookings: T[],
  appointmentId: string,
  patientId: string,
  familyMemberId?: string | null
): T | undefined {
  const fam = familyMemberId || '';
  const live = (bookings || []).filter(
    (b) =>
      b.appointment_id === appointmentId &&
      b.patient_id === patientId &&
      String(b.family_member_id || '') === fam
  );
  if (!live.length) return undefined;
  return live.reduce((a, b) => pickPreferredClinicBooking(a, b));
}

export function resolveClinicBookingId<
  T extends {
    id: string;
    appointment_id: string;
    patient_id: string;
    family_member_id?: string | null;
    status: string;
    updated_at?: string | null;
    booked_at?: string | null;
  },
>(
  bookings: T[],
  rec: {
    id?: unknown;
    appointment_id?: unknown;
    patient_id?: unknown;
    family_member_id?: unknown;
  },
  newId: () => string
): string {
  const given = String(rec.id || '');
  if (given && bookings.some((b) => b.id === given)) return given;
  const appointmentId = String(rec.appointment_id || '');
  const patientId = String(rec.patient_id || '');
  if (appointmentId && patientId) {
    const seat = findClinicAppointmentSeat(
      bookings,
      appointmentId,
      patientId,
      rec.family_member_id != null ? String(rec.family_member_id) : ''
    );
    if (seat) return seat.id;
  }
  return given || newId();
}

export function clinicRosterRows<
  T extends {
    id: string;
    appointment_id: string;
    patient_id: string;
    family_member_id?: string | null;
    family_member_name?: string | null;
    status: string;
    updated_at?: string | null;
    booked_at?: string | null;
  },
>(
  bookings: T[],
  appointmentId: string,
  patients: Array<{ id: string; name: string }>
): Array<{
  booking_id: string;
  patient_id: string;
  name: string;
  status: string;
}> {
  const bySeat = new Map<string, T>();
  for (const b of bookings || []) {
    if (b.appointment_id !== appointmentId) continue;
    if (b.status === 'cancelled') continue;
    if (!b.patient_id) continue;
    const k = clinicBookingSeatKey(b);
    const prev = bySeat.get(k);
    bySeat.set(k, prev ? pickPreferredClinicBooking(prev, b) : b);
  }
  return [...bySeat.values()]
    .map((b) => {
      const p = patients.find((x) => x.id === b.patient_id);
      return {
        booking_id: b.id,
        patient_id: b.patient_id,
        name: b.family_member_name || p?.name || b.patient_id,
        status: b.status,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
