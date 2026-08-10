/**
 * Clinic patient waitlist helpers — queue position + desk notification.
 * Used by Dental / Physio / Medical / Psychiatry patient portals.
 *
 * Patients may book any public clinician (not only their regular assigned one).
 * When a slot is full they join the waitlist; practice is emailed.
 */
import { getResend, getResendFrom, getAppUrl } from '@/lib/resend';

export type ClinicWaitlistQueueEntry = {
  id: string;
  patient_id: string;
  patient_name?: string;
  /** Prefer regular clinician if possible */
  preferred_clinician_id?: string | null;
  /** Patient is happy with any available clinician */
  accept_any_clinician: boolean;
  service_id?: string | null;
  service_name?: string | null;
  notes?: string;
  status: 'waiting' | 'contacted' | 'booked' | 'cancelled';
  created_at: string;
  notified_at?: string | null;
};

/** 1-based position among waitlisted bookings on the same appointment */
export function waitlistPositionOnSlot(
  bookings: Array<{
    id: string;
    appointment_id: string;
    status: string;
    booked_at?: string;
  }>,
  appointmentId: string,
  bookingId: string
): number {
  const list = bookings
    .filter(
      (b) =>
        b.appointment_id === appointmentId && b.status === 'waitlist'
    )
    .sort((a, b) =>
      String(a.booked_at || '').localeCompare(String(b.booked_at || ''))
    );
  const idx = list.findIndex((b) => b.id === bookingId);
  return idx >= 0 ? idx + 1 : list.length;
}

export function queuePosition(
  queue: ClinicWaitlistQueueEntry[],
  entryId: string
): number {
  const open = queue
    .filter((q) => q.status === 'waiting')
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const idx = open.findIndex((q) => q.id === entryId);
  return idx >= 0 ? idx + 1 : open.length;
}

export function newQueueEntry(opts: {
  patient_id: string;
  patient_name?: string;
  preferred_clinician_id?: string | null;
  accept_any_clinician?: boolean;
  service_id?: string | null;
  service_name?: string | null;
  notes?: string;
  now?: string;
}): ClinicWaitlistQueueEntry {
  const now = opts.now || new Date().toISOString();
  return {
    id: `wlq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    patient_id: opts.patient_id,
    patient_name: opts.patient_name,
    preferred_clinician_id: opts.preferred_clinician_id ?? null,
    accept_any_clinician: opts.accept_any_clinician !== false,
    service_id: opts.service_id ?? null,
    service_name: opts.service_name ?? null,
    notes: opts.notes,
    status: 'waiting',
    created_at: now,
  };
}

export async function notifyPracticeWaitlist(opts: {
  to?: string | null;
  brand: string;
  moduleLabel: string;
  patientName: string;
  patientEmail?: string;
  /** Slot waitlist vs general next-available queue */
  kind: 'slot' | 'queue';
  position?: number;
  eventTitle?: string;
  date?: string;
  start_time?: string;
  clinicianName?: string;
  acceptAny?: boolean;
  preferredClinicianName?: string;
  deskUrl?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const resend = getResend();
    if (!resend) {
      return { ok: false, error: 'Email not configured' };
    }
    const to = String(opts.to || '').trim();
    if (!to || !to.includes('@')) {
      return { ok: false, error: 'No practice contact email' };
    }
    const app = getAppUrl();
    const pos =
      opts.position != null ? `Queue position: #${opts.position}` : '';
    const subject =
      opts.kind === 'queue'
        ? `Waitlist: ${opts.patientName} wants the next available slot · ${opts.brand}`
        : `Waitlist: ${opts.patientName} joined a full slot · ${opts.brand}`;

    const when =
      opts.date && opts.start_time
        ? `${opts.date} at ${opts.start_time.slice(0, 5)}`
        : '';
    const clin = opts.clinicianName
      ? `Clinician: ${opts.clinicianName}`
      : opts.acceptAny
        ? 'Happy with any available clinician'
        : opts.preferredClinicianName
          ? `Prefers: ${opts.preferredClinicianName}`
          : '';

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
        <p style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b">
          ${escapeHtml(opts.moduleLabel)} · Waitlist
        </p>
        <h1 style="font-size:18px;margin:8px 0 12px">Patient on the waitlist</h1>
        <p style="font-size:15px;line-height:1.5;color:#334155">
          <strong>${escapeHtml(opts.patientName)}</strong>
          ${opts.patientEmail ? ` (${escapeHtml(opts.patientEmail)})` : ''}
          ${
            opts.kind === 'queue'
              ? ' asked for the <strong>next available</strong> appointment.'
              : ' joined the waitlist for a full slot.'
          }
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:16px 0">
          ${opts.eventTitle ? `<p style="margin:0;font-weight:700">${escapeHtml(opts.eventTitle)}</p>` : ''}
          ${when ? `<p style="margin:8px 0 0;color:#475569">${escapeHtml(when)}</p>` : ''}
          ${clin ? `<p style="margin:4px 0 0;color:#64748b">${escapeHtml(clin)}</p>` : ''}
          ${pos ? `<p style="margin:8px 0 0;font-weight:700;color:#0f172a">${escapeHtml(pos)}</p>` : ''}
        </div>
        <p style="font-size:13px;color:#64748b">
          Open the diary to free a slot or promote the next waitlist patient when someone cancels.
        </p>
        ${
          opts.deskUrl
            ? `<p><a href="${escapeHtml(opts.deskUrl.startsWith('http') ? opts.deskUrl : app + opts.deskUrl)}" style="color:#0284c7;font-weight:700">Open desk</a></p>`
            : ''
        }
      </div>
    `;
    const { error } = await resend.emails.send({
      from: getResendFrom(),
      to,
      subject,
      html,
    });
    if (error) return { ok: false, error: error.message || 'Send failed' };
    return { ok: true };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Notify failed',
    };
  }
}

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
