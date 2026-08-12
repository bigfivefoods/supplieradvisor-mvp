/**
 * Public clinician diary portal API (token auth).
 * GET  ?module=&token=&from=&to=
 * POST { module, token, action, ... }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  readDentalgraphFromMetadata,
  writeDentalgraphToMetadata,
} from '@/lib/dental/dentalgraph';
import {
  readPhysiographFromMetadata,
  writePhysiographToMetadata,
} from '@/lib/clinic/physiograph';
import {
  readMedicalgraphFromMetadata,
  writeMedicalgraphToMetadata,
} from '@/lib/clinic/medicalgraph';
import {
  readPsychiatrygraphFromMetadata,
  writePsychiatrygraphToMetadata,
} from '@/lib/clinic/psychiatrygraph';
import {
  applyAttendanceToPersonStats,
  promoteNextWaitlist,
} from '@/lib/services/advisor-booking';
import {
  issueFeedbackPrompt,
  buildPublicFeedbackPath,
} from '@/lib/services/booking-feedback';
import { sendWaitlistOfferEmail } from '@/lib/services/advisor-reminders';
import { findClinicianDiaryConflict } from '@/lib/schedule/clinician-diary';
import {
  type ClinicianModule,
  type ClinicianStoreLike,
  buildClinicianPortalPayload,
  cancelBookingAndPromote,
  clinicianField,
  clinicianModuleLabel,
  clinicianOwnsAppointment,
  createClinicianAppointment,
  deleteClinicianAppointment,
  findClinicianByToken,
  isClinicianModule,
  listClinicians,
  parseClinicianCompanyIdFromToken,
  staffTokenMapKey,
} from '@/lib/services/clinician-portal';
import {
  applySeriesPatch,
  resolveSeriesEditIds,
  type SeriesEditScope,
} from '@/lib/services/advisor-series-edit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Resolved = {
  companyId: number;
  module: ClinicianModule;
  meta: Record<string, unknown>;
  store: ClinicianStoreLike;
  clinician: NonNullable<ReturnType<typeof findClinicianByToken>>;
  write: (
    meta: Record<string, unknown>,
    store: ClinicianStoreLike
  ) => Record<string, unknown>;
};

async function resolveClinician(
  module: string,
  token: string
): Promise<Resolved | null> {
  if (!isClinicianModule(module)) return null;
  const clean = token.trim();
  if (!clean || clean.length < 8) return null;

  const supabase = getSupabaseServer();
  let companyId = parseClinicianCompanyIdFromToken(clean);

  if (companyId == null) {
    const mapKey = staffTokenMapKey(module);
    const { data: rows } = await supabase
      .from('profiles')
      .select('id, metadata')
      .not('metadata', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(300);
    for (const row of rows || []) {
      const meta =
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : {};
      const map = meta[mapKey];
      if (map && typeof map === 'object' && clean in (map as object)) {
        companyId = Number(row.id);
        break;
      }
      const raw = meta[module];
      if (!raw || typeof raw !== 'object') continue;
      const store = raw as ClinicianStoreLike;
      if (findClinicianByToken(store, module, clean)) {
        companyId = Number(row.id);
        break;
      }
    }
  }

  if (companyId == null || !Number.isFinite(companyId)) return null;

  const { data: prof } = await supabase
    .from('profiles')
    .select('id, metadata')
    .eq('id', companyId)
    .maybeSingle();
  if (!prof) return null;

  const meta =
    prof.metadata && typeof prof.metadata === 'object'
      ? { ...(prof.metadata as Record<string, unknown>) }
      : {};

  let store: ClinicianStoreLike;
  let write: Resolved['write'];
  if (module === 'dentalgraph') {
    store = readDentalgraphFromMetadata(meta) as unknown as ClinicianStoreLike;
    write = (m, s) =>
      writeDentalgraphToMetadata(
        m,
        s as unknown as Parameters<typeof writeDentalgraphToMetadata>[1]
      );
  } else if (module === 'physiograph') {
    store = readPhysiographFromMetadata(meta) as unknown as ClinicianStoreLike;
    write = (m, s) =>
      writePhysiographToMetadata(
        m,
        s as unknown as Parameters<typeof writePhysiographToMetadata>[1]
      );
  } else if (module === 'medicalgraph') {
    store = readMedicalgraphFromMetadata(meta) as unknown as ClinicianStoreLike;
    write = (m, s) =>
      writeMedicalgraphToMetadata(
        m,
        s as unknown as Parameters<typeof writeMedicalgraphToMetadata>[1]
      );
  } else {
    store = readPsychiatrygraphFromMetadata(
      meta
    ) as unknown as ClinicianStoreLike;
    write = (m, s) =>
      writePsychiatrygraphToMetadata(
        m,
        s as unknown as Parameters<typeof writePsychiatrygraphToMetadata>[1]
      );
  }

  const clinician = findClinicianByToken(store, module, clean);
  if (!clinician || clinician.active === false) return null;

  return {
    companyId,
    module,
    meta,
    store,
    clinician,
    write,
  };
}

async function save(resolved: Resolved) {
  const supabase = getSupabaseServer();
  // Index staff tokens for faster resolve next time
  const mapKey = staffTokenMapKey(resolved.module);
  const tokens: Record<string, string> = {};
  for (const p of listClinicians(resolved.store, resolved.module)) {
    if (p.portal_token) tokens[String(p.portal_token)] = p.id;
  }
  let nextMeta = resolved.write(resolved.meta, resolved.store);
  nextMeta = { ...nextMeta, [mapKey]: tokens };
  await supabase
    .from('profiles')
    .update({
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', resolved.companyId);
  resolved.meta = nextMeta;
}

function portalJson(resolved: Resolved, from?: string, to?: string) {
  return {
    success: true,
    module: resolved.module,
    brand:
      resolved.store.settings?.brand_name ||
      clinicianModuleLabel(resolved.module),
    public_token: resolved.store.settings?.public_token,
    portal: buildClinicianPortalPayload(
      resolved.store,
      resolved.module,
      resolved.clinician,
      from,
      to
    ),
  };
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit(`clinician-portal-get:${ip}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  const module = String(req.nextUrl.searchParams.get('module') || '');
  const token = String(req.nextUrl.searchParams.get('token') || '');
  const from = req.nextUrl.searchParams.get('from') || undefined;
  const to = req.nextUrl.searchParams.get('to') || undefined;
  const resolved = await resolveClinician(module, token);
  if (!resolved) {
    return NextResponse.json(
      { error: 'Clinician portal not found' },
      { status: 404 }
    );
  }
  return NextResponse.json(portalJson(resolved, from, to));
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit(`clinician-portal-post:${ip}`, 60, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    const body = await req.json();
    const module = String(body.module || '');
    const token = String(body.token || '');
    const action = String(body.action || '');
    const from = body.from ? String(body.from) : undefined;
    const to = body.to ? String(body.to) : undefined;
    const resolved = await resolveClinician(module, token);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Clinician portal not found' },
        { status: 404 }
      );
    }
    if (resolved.clinician.can_manage === false) {
      return NextResponse.json(
        { error: 'Clinician cannot manage diary' },
        { status: 403 }
      );
    }

    const { store, clinician, module: mod, companyId } = resolved;
    const now = new Date().toISOString();
    const appointmentId = String(
      body.appointment_id || body.session_id || body.id || ''
    );
    const field = clinicianField(mod);

    if (action === 'create_appointment' || action === 'create_session') {
      const serviceId = String(body.service_id || '');
      const date = String(body.date || now.slice(0, 10));
      const startTime = String(body.start_time || '09:00').slice(0, 5);
      if (!serviceId) {
        return NextResponse.json(
          { error: 'service_id required' },
          { status: 400 }
        );
      }
      const duration =
        body.duration_min != null ? Number(body.duration_min) : 45;
      const conflict = findClinicianDiaryConflict({
        appointments: store.appointments as never[],
        clinicianId: clinician.id,
        clinicianField: field,
        date,
        start_time: startTime,
        duration_min: duration,
      });
      if (conflict.conflict) {
        return NextResponse.json({ error: conflict.message }, { status: 409 });
      }
      const appt = createClinicianAppointment(
        store,
        mod,
        clinician.id,
        {
          service_id: serviceId,
          date,
          start_time: startTime,
          duration_min: duration,
          location: body.location != null ? String(body.location) : undefined,
          public: body.public === true,
          notes: body.notes != null ? String(body.notes) : undefined,
          public_notes:
            body.public_notes != null ? String(body.public_notes) : undefined,
        },
        now
      );
      const patientId = String(body.patient_id || '');
      if (patientId) {
        const patient = store.patients.find((p) => p.id === patientId);
        if (patient) {
          store.bookings.push({
            id: `bkg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
            appointment_id: appt.id,
            patient_id: patientId,
            status: 'booked',
            booked_at: now,
            source: 'practitioner',
          });
        }
      }
      await save(resolved);
      return NextResponse.json({
        ...portalJson(resolved, from, to),
        message: 'Appointment created',
        appointment: { id: appt.id, date: appt.date, start_time: appt.start_time },
      });
    }

    if (action === 'update_appointment' || action === 'update_session') {
      const appt = store.appointments.find((a) => a.id === appointmentId);
      if (!appt || !clinicianOwnsAppointment(appt, mod, clinician.id)) {
        return NextResponse.json(
          { error: 'Appointment not found' },
          { status: 404 }
        );
      }
      const scope: SeriesEditScope =
        body.edit_scope === 'future' || body.series_future === true
          ? 'future'
          : 'one';
      const ids = resolveSeriesEditIds(
        store.appointments.map((a) => ({
          id: a.id,
          date: a.date,
          series_id: a.series_id,
        })),
        appt.id,
        scope
      );
      const patch = {
        start_time:
          body.start_time != null ? String(body.start_time) : undefined,
        location: body.location !== undefined ? String(body.location || '') : undefined,
        duration_min:
          body.duration_min != null && body.duration_min !== ''
            ? Number(body.duration_min)
            : undefined,
        service_id:
          body.service_id != null ? String(body.service_id) : undefined,
        public:
          body.public === true || body.public === false
            ? (body.public as boolean)
            : undefined,
        notes: body.notes !== undefined ? String(body.notes) : undefined,
        public_notes:
          body.public_notes !== undefined
            ? String(body.public_notes)
            : undefined,
        status: body.status != null ? String(body.status) : undefined,
      };
      const newDate =
        body.date != null ? String(body.date).slice(0, 10) : undefined;
      if (newDate || patch.start_time || patch.duration_min != null) {
        const checkDate = newDate || appt.date;
        const checkTime = patch.start_time || appt.start_time;
        const checkDur =
          patch.duration_min != null
            ? patch.duration_min
            : appt.duration_min || 45;
        const conflict = findClinicianDiaryConflict({
          appointments: store.appointments as never[],
          clinicianId: clinician.id,
          clinicianField: field,
          date: checkDate,
          start_time: checkTime,
          duration_min: Number(checkDur) || 45,
          excludeId: appt.id,
        });
        if (conflict.conflict) {
          return NextResponse.json(
            { error: conflict.message },
            { status: 409 }
          );
        }
      }
      for (const id of ids) {
        const row = store.appointments.find((a) => a.id === id);
        if (!row) continue;
        const isAnchor = id === appt.id;
        Object.assign(
          row,
          applySeriesPatch(row as never, patch, {
            isAnchor,
            newDate: isAnchor ? newDate : undefined,
          })
        );
      }
      await save(resolved);
      return NextResponse.json({
        ...portalJson(resolved, from, to),
        message:
          scope === 'future'
            ? `Updated ${ids.length} appointments in series`
            : 'Appointment updated',
        updated: ids.length,
      });
    }

    if (action === 'delete_appointment' || action === 'delete_session' || action === 'delete') {
      const appt = store.appointments.find((a) => a.id === appointmentId);
      if (!appt || !clinicianOwnsAppointment(appt, mod, clinician.id)) {
        return NextResponse.json(
          { error: 'Appointment not found' },
          { status: 404 }
        );
      }
      const deleteSeries =
        body.delete_series === true || body.series === true;
      const result = deleteClinicianAppointment(
        store,
        appt.id,
        deleteSeries
      );
      await save(resolved);
      return NextResponse.json({
        ...portalJson(resolved, from, to),
        deleted: result.deleted,
        message:
          result.deleted > 1
            ? `Deleted ${result.deleted} appointments in series`
            : 'Appointment deleted',
      });
    }

    if (action === 'book_patient' || action === 'book_member') {
      const appt = store.appointments.find((a) => a.id === appointmentId);
      if (
        !appt ||
        !clinicianOwnsAppointment(appt, mod, clinician.id) ||
        appt.status === 'cancelled'
      ) {
        return NextResponse.json(
          { error: 'Appointment not found' },
          { status: 404 }
        );
      }
      const patientId = String(body.patient_id || '');
      const patient = store.patients.find((p) => p.id === patientId);
      if (!patient) {
        return NextResponse.json(
          { error: 'Patient not found' },
          { status: 404 }
        );
      }
      const existing = store.bookings.find(
        (b) =>
          b.appointment_id === appointmentId &&
          b.patient_id === patientId &&
          b.status !== 'cancelled'
      );
      if (existing) {
        return NextResponse.json(
          { error: 'Already booked on this slot', booking: existing },
          { status: 409 }
        );
      }
      const count = store.bookings.filter(
        (b) =>
          b.appointment_id === appointmentId &&
          (b.status === 'booked' || b.status === 'attended')
      ).length;
      const status = count >= 1 ? 'waitlist' : 'booked';
      const booking = {
        id: `bkg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        appointment_id: appointmentId,
        patient_id: patientId,
        status,
        booked_at: now,
        source: 'practitioner',
      };
      store.bookings.push(booking);
      await save(resolved);
      return NextResponse.json({
        ...portalJson(resolved, from, to),
        booking: { id: booking.id, status },
        message:
          status === 'waitlist'
            ? 'Patient added to waitlist'
            : 'Patient booked',
      });
    }

    if (action === 'cancel_booking') {
      const bookingId = String(body.booking_id || '');
      const booking = store.bookings.find((b) => b.id === bookingId);
      if (!booking) {
        return NextResponse.json(
          { error: 'Booking not found' },
          { status: 404 }
        );
      }
      const appt = store.appointments.find(
        (a) => a.id === booking.appointment_id
      );
      if (!appt || !clinicianOwnsAppointment(appt, mod, clinician.id)) {
        return NextResponse.json({ error: 'Not your appointment' }, { status: 403 });
      }
      const { promoted } = cancelBookingAndPromote(store, bookingId, now);
      if (promoted) {
        const patient = store.patients.find((p) => p.id === promoted.patient_id);
        const svc = store.services.find((s) => s.id === appt.service_id);
        if (patient?.email) {
          void sendWaitlistOfferEmail({
            to: patient.email,
            personName: patient.name,
            brand: store.settings?.brand_name || clinicianModuleLabel(mod),
            eventTitle: svc?.name || 'Appointment',
            date: appt.date,
            start_time: appt.start_time,
            location: appt.location,
            manageUrl: patient.portal_token
              ? `/member/${mod}/${patient.portal_token}`
              : undefined,
            moduleLabel: clinicianModuleLabel(mod),
          });
        }
      }
      await save(resolved);
      return NextResponse.json({
        ...portalJson(resolved, from, to),
        promoted: promoted
          ? { booking_id: promoted.id, patient_id: promoted.patient_id }
          : null,
        message: promoted
          ? 'Booking cancelled — next waitlist patient promoted'
          : 'Booking cancelled',
      });
    }

    if (
      action === 'mark_attendance' ||
      action === 'mark_attended' ||
      action === 'mark'
    ) {
      const bookingId = String(body.booking_id || '');
      const booking = store.bookings.find((b) => b.id === bookingId);
      if (!booking) {
        return NextResponse.json(
          { error: 'Booking not found' },
          { status: 404 }
        );
      }
      const appt = store.appointments.find(
        (a) => a.id === booking.appointment_id
      );
      if (!appt || !clinicianOwnsAppointment(appt, mod, clinician.id)) {
        return NextResponse.json({ error: 'Not your appointment' }, { status: 403 });
      }
      const nextStatus = String(body.status || 'attended');
      if (
        !['attended', 'no_show', 'booked', 'cancelled'].includes(nextStatus)
      ) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      const prev = booking.status;
      booking.status = nextStatus;

      if (
        (nextStatus === 'attended' || nextStatus === 'no_show') &&
        prev !== nextStatus
      ) {
        const pi = store.patients.findIndex((p) => p.id === booking.patient_id);
        if (pi >= 0) {
          Object.assign(
            store.patients[pi],
            applyAttendanceToPersonStats(
              store.patients[pi] as never,
              nextStatus as 'attended' | 'no_show',
              now
            )
          );
        }
        if (appt.status !== 'cancelled') {
          appt.status =
            nextStatus === 'attended' || nextStatus === 'no_show'
              ? 'completed'
              : appt.status;
        }
      }

      if (nextStatus === 'cancelled' && prev !== 'cancelled') {
        const promoted = promoteNextWaitlist(
          store.bookings,
          (b) => b.appointment_id === booking.appointment_id,
          now
        );
        if (promoted) {
          const patient = store.patients.find(
            (p) => p.id === promoted.patient_id
          );
          const svc = store.services.find((s) => s.id === appt.service_id);
          if (patient?.email) {
            void sendWaitlistOfferEmail({
              to: patient.email,
              personName: patient.name,
              brand: store.settings?.brand_name || clinicianModuleLabel(mod),
              eventTitle: svc?.name || 'Appointment',
              date: appt.date,
              start_time: appt.start_time,
              location: appt.location,
              moduleLabel: clinicianModuleLabel(mod),
            });
          }
        }
      }

      let feedbackPath: string | null = null;
      if (nextStatus === 'attended') {
        const prompted = issueFeedbackPrompt(booking as never, now);
        (booking as { feedback_token?: string }).feedback_token =
          prompted.feedback_token || undefined;
        (booking as { feedback_requested_at?: string }).feedback_requested_at =
          prompted.feedback_requested_at || undefined;
        if (prompted.feedback_token) {
          feedbackPath = buildPublicFeedbackPath(
            mod,
            companyId,
            prompted.feedback_token
          );
        }
      }

      await save(resolved);
      return NextResponse.json({
        ...portalJson(resolved, from, to),
        feedback_path: feedbackPath,
        message: `Marked ${nextStatus.replace('_', ' ')}`,
      });
    }

    if (action === 'update_profile') {
      const people =
        mod === 'dentalgraph' ? store.staff : store.practitioners;
      const person = (people || []).find((p) => p.id === clinician.id);
      if (!person) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      if (body.name != null) person.name = String(body.name).trim() || person.name;
      if (body.email !== undefined)
        person.email = body.email ? String(body.email) : undefined;
      if (body.phone !== undefined)
        person.phone = body.phone ? String(body.phone) : undefined;
      if (body.bio !== undefined) person.bio = String(body.bio);
      if (body.public_bio !== undefined)
        person.public_bio = String(body.public_bio);
      if (body.photo_url !== undefined)
        person.photo_url = body.photo_url
          ? String(body.photo_url)
          : undefined;
      await save(resolved);
      return NextResponse.json({
        ...portalJson(resolved, from, to),
        message: 'Profile updated',
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    console.error('[public/advisor/clinician]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
