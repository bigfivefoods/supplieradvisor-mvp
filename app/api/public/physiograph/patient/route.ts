/**
 * PhysioAdvisor patient portal (token auth).
 * GET  ?token= — open diary vacancies + my bookings
 * POST book | request_join | cancel | update_profile
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  PHYSIOGRAPH_PATIENT_TOKENS_KEY,
  appointmentBookingCount,
  buildPatientPortalPayload,
  newId,
  parsePhysioCompanyIdFromToken,
  readPhysiographFromMetadata,
  writePhysiographToMetadata,
  type PhysioBooking,
  type PhysioPatient,
  type PhysiographStore,
} from '@/lib/clinic/physiograph';
import { notifyPatientBookingPush } from '@/lib/b2c/member-push';
import {
  applyCompanyLogoToSettings,
  pickCompanyLogoUrl,
} from '@/lib/business/company-logo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function resolvePatient(token: string): Promise<{
  companyId: number;
  meta: Record<string, unknown>;
  store: PhysiographStore;
  patient: PhysioPatient;
} | null> {
  const clean = token.trim();
  if (!clean || clean.length < 8) return null;
  const supabase = getSupabaseServer();
  let companyId = parsePhysioCompanyIdFromToken(clean);

  if (companyId == null) {
    const { data: rows } = await supabase
      .from('profiles')
      .select('id, metadata')
      .not('metadata', 'is', null)
      .limit(200);
    for (const row of rows || []) {
      const meta =
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : {};
      const map = meta[PHYSIOGRAPH_PATIENT_TOKENS_KEY];
      if (map && typeof map === 'object' && clean in (map as object)) {
        companyId = Number(row.id);
        break;
      }
      const store = readPhysiographFromMetadata(meta);
      if (store.patients.some((p) => p.portal_token === clean)) {
        companyId = Number(row.id);
        break;
      }
    }
  }
  if (companyId == null || !Number.isFinite(companyId)) return null;

  const { data: prof } = await supabase
    .from('profiles')
    .select('id, metadata, logo_url')
    .eq('id', companyId)
    .maybeSingle();
  if (!prof) return null;
  const meta =
    prof.metadata && typeof prof.metadata === 'object'
      ? { ...(prof.metadata as Record<string, unknown>) }
      : {};
  const store = readPhysiographFromMetadata(meta);
  applyCompanyLogoToSettings(store, pickCompanyLogoUrl(prof));
  const patient = store.patients.find((p) => p.portal_token === clean);
  if (!patient || patient.active === false) return null;
  return { companyId: Number(prof.id), meta, store, patient };
}

async function saveStore(
  companyId: number,
  meta: Record<string, unknown>,
  store: PhysiographStore
) {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('profiles')
    .update({
      metadata: writePhysiographToMetadata(meta, store),
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId);
  if (error) throw new Error(error.message);
}

export async function GET(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({
      key: `public-physio-patient:${ip}`,
      limit: 120,
      windowMs: 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
    const token = String(request.nextUrl.searchParams.get('token') || '').trim();
    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }
    const resolved = await resolvePatient(token);
    if (!resolved) {
      return NextResponse.json({ error: 'Patient portal not found' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      portal: buildPatientPortalPayload(
        resolved.store,
        resolved.patient,
        request.nextUrl.searchParams.get('from') || undefined,
        request.nextUrl.searchParams.get('to') || undefined
      ),
      companyId: resolved.companyId,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({
      key: `public-physio-patient-post:${ip}`,
      limit: 40,
      windowMs: 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
    const body = await request.json();
    const token = String(body.token || '').trim();
    const action = String(body.action || 'book');
    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }
    const resolved = await resolvePatient(token);
    if (!resolved) {
      return NextResponse.json({ error: 'Patient portal not found' }, { status: 404 });
    }
    const { companyId, meta, store, patient } = resolved;
    const now = new Date().toISOString();
    const pi = store.patients.findIndex((p) => p.id === patient.id);
    if (pi < 0) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    
    if (
      action.startsWith('message_') ||
      action === 'create_thread' ||
      action === 'post_message' ||
      action === 'mark_read' ||
      action === 'archive_thread'
    ) {
      const { handlePortalMessageAction } = await import(
        '@/lib/services/clinic-portal-messaging'
      );
      const b = { ...body };
      const cid = String(
        body.staff_id ||
          body.practitioner_id ||
          body.to_clinician ||
          patient.practitioner_id ||
          ''
      );
      const clin = (store.practitioners || []).find((x) => x.id === cid);
      if (
        clin &&
        (action === 'message_create_thread' ||
          action === 'create_thread' ||
          action === 'message_start')
      ) {
        b.with_role = 'practitioner';
        b.with_ref_id = clin.id;
        b.with_name = clin.name;
        b.channel = b.channel || 'practitioner_patient';
      }
      if (body.to_desk === true || body.channel === 'desk_patient') {
        b.with_role = 'desk';
        b.with_ref_id = 'desk';
        b.with_name = 'Front desk';
        b.channel = b.channel || 'desk_patient';
      }
      const msgResult = handlePortalMessageAction({
        action,
        body: b,
        threads: store.threads,
        personRole: 'patient',
        personId: patient.id,
        personName: patient.name,
        now,
      });
      if (!msgResult.ok) {
        return NextResponse.json(
          { error: msgResult.error },
          { status: msgResult.status || 400 }
        );
      }
      store.threads = msgResult.threads;
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        message: 'Message saved',
        thread: msgResult.thread,
        unread: msgResult.unread,
        portal: buildPatientPortalPayload(store, store.patients[pi]),
      });
    }

    if (action === 'update_profile') {
      const p = store.patients[pi];
      const { applyPortalProfileUpdate } = await import(
        '@/lib/services/portal-profile'
      );
      const result = applyPortalProfileUpdate(p, body, {
        storeIdOnMedical: true,
        now,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      store.patients[pi] = p;
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        portal: buildPatientPortalPayload(store, p),
        message: result.emailChanged
          ? 'Profile updated — email synced to clinic records and care messages'
          : 'Profile updated',
      });
    }


    if (action === 'family_upsert' || action === 'family_save') {
      const p = store.patients[pi];
      const { upsertFamilyMember } = await import(
        '@/lib/services/family-members'
      );
      const patch = (body.member || body.record || body) as Record<
        string,
        unknown
      >;
      const { list, member, error } = upsertFamilyMember(p.family, patch, now);
      if (error) {
        return NextResponse.json({ error }, { status: 400 });
      }
      p.family = list;
      p.updated_at = now;
      store.patients[pi] = p;
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        member,
        portal: buildPatientPortalPayload(store, p),
        message: patch.id
          ? 'Family member updated'
          : 'Family member added — synced to the practice',
      });
    }

    if (action === 'family_remove' || action === 'family_delete') {
      const p = store.patients[pi];
      const { removeFamilyMember } = await import(
        '@/lib/services/family-members'
      );
      const famId = String(body.member_id || body.id || '');
      if (!famId) {
        return NextResponse.json(
          { error: 'member_id required' },
          { status: 400 }
        );
      }
      p.family = removeFamilyMember(p.family, famId);
      p.updated_at = now;
      store.patients[pi] = p;
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        portal: buildPatientPortalPayload(store, p),
        message: 'Family member removed',
      });
    }


    if (action === 'confirm_waitlist' || action === 'accept_waitlist') {
      const { portalConfirmWaitlistPlace } = await import(
        '@/lib/services/clinic-portal-actions'
      );
      const bookingId = String(body.booking_id || body.bookingId || '');
      const result = portalConfirmWaitlistPlace(store.bookings, {
        bookingId,
        patientId: patient.id,
        now,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        portal: buildPatientPortalPayload(store, store.patients[pi] || patient),
        message: result.message,
      });
    }

    if (action === 'reschedule' || action === 'reschedule_booking') {
      const { portalRescheduleBooking } = await import(
        '@/lib/services/clinic-portal-actions'
      );
      const bookingId = String(body.booking_id || body.bookingId || '');
      const newAppointmentId = String(
        body.appointment_id || body.new_appointment_id || body.appointmentId || ''
      );
      const result = portalRescheduleBooking({
        bookings: store.bookings,
        appointments: store.appointments,
        bookingId,
        patientId: patient.id,
        newAppointmentId,
        policy: store.settings?.reschedule_policy,
        personSoftBlocked: patient.booking_soft_block === true,
        isSlotOpen: (aid) => appointmentBookingCount(store, aid) < 1,
        now,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        portal: buildPatientPortalPayload(store, store.patients[pi] || patient),
        message: result.message,
        fee_note: result.fee_note || null,
      });
    }

    if (action === 'cancel' || action === 'cancel_booking') {
      const bookingId = String(body.booking_id || body.bookingId || '');
      const bi = store.bookings.findIndex(
        (b) => b.id === bookingId && b.patient_id === patient.id
      );
      if (bi < 0) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      if (store.bookings[bi].status === 'attended') {
        return NextResponse.json(
          { error: 'Cannot cancel an attended visit' },
          { status: 400 }
        );
      }
      store.bookings[bi].status = 'cancelled';
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        portal: buildPatientPortalPayload(store, store.patients[pi]),
        message: 'Booking cancelled',
      });
    }

    if (action === 'book' || action === 'request_join' || action === 'join') {
      if (store.settings?.allow_public_booking === false) {
        return NextResponse.json(
          { error: 'Online booking is disabled by the clinic' },
          { status: 403 }
        );
      }
      const appointmentId = String(
        body.appointment_id || body.appointmentId || body.session_id || ''
      );
      if (!appointmentId) {
        return NextResponse.json(
          { error: 'appointment_id required' },
          { status: 400 }
        );
      }
      const appt = store.appointments.find((a) => a.id === appointmentId);
      if (!appt || appt.status !== 'scheduled' || appt.public !== true) {
        return NextResponse.json(
          { error: 'Slot not available for booking' },
          { status: 404 }
        );
      }
      const dup = store.bookings.find(
        (b) =>
          b.appointment_id === appointmentId &&
          b.patient_id === patient.id &&
          (b.status === 'booked' || b.status === 'waitlist' || b.status === 'attended')
      );
      if (dup) {
        return NextResponse.json(
          { error: 'Already booked on this slot', booking_id: dup.id, status: dup.status },
          { status: 409 }
        );
      }
      const booked = appointmentBookingCount(store, appointmentId);
      const full = booked >= 1;
      const famId = body.family_member_id
        ? String(body.family_member_id)
        : body.familyMemberId
          ? String(body.familyMemberId)
          : null;
      let famName: string | null = null;
      if (famId) {
        const m = (patient.family || []).find(
          (f: { id: string; active?: boolean }) =>
            f.id === famId && f.active !== false
        );
        if (m) {
          famName = `${m.name}${m.relationship ? ` (${m.relationship})` : ''}`;
        }
      }
      
      const preferOther =
        patient.practitioner_id &&
        appt.practitioner_id &&
        patient.practitioner_id !== appt.practitioner_id;
      const finalStatus: 'waitlist' | 'booked' = full ? 'waitlist' : 'booked';
      const row = {
        id: newId('bk'),
        appointment_id: appointmentId,
        patient_id: patient.id,
        status: finalStatus,
        booked_at: now,
        source: 'patient_portal',
        notes: [
          finalStatus === 'waitlist'
            ? 'Patient portal — waitlist / join request'
            : 'Patient portal booking',
          preferOther
            ? 'Booked another clinician (regular unavailable / preferred alternative)'
            : null,
        ]
          .filter(Boolean)
          .join(' · '),
        family_member_id: famName ? famId : null,
        family_member_name: famName,
      };
      store.bookings.push(row);

      let waitlistPosition = null;
      if (finalStatus === 'waitlist') {
        const { waitlistPositionOnSlot, notifyPracticeWaitlist } =
          await import('@/lib/services/clinic-waitlist');
        waitlistPosition = waitlistPositionOnSlot(
          store.bookings,
          appointmentId,
          row.id
        );
        const svc = store.services.find((s) => s.id === appt.service_id);
        const clin = store.practitioners.find(
          (s) => s.id === appt.practitioner_id
        );
        await notifyPracticeWaitlist({
          to: store.settings?.contact_email,
          brand: store.settings?.brand_name || 'Practice',
          moduleLabel: 'PhysioAdvisor®',
          patientName: patient.name,
          patientEmail: patient.email,
          kind: 'slot',
          position: waitlistPosition,
          eventTitle: svc?.name || 'Appointment',
          date: appt.date,
          start_time: appt.start_time,
          clinicianName: clin?.name,
          deskUrl: '/dashboard/physiograph/bookings',
        });
      }

      await saveStore(companyId, meta, store);
      const bookedSvc = store.services.find((s) => s.id === appt.service_id);
      await notifyPatientBookingPush({
        platformUserId: patient.platform_user_id,
        brand: store.settings?.brand_name,
        title: bookedSvc?.name || 'Appointment',
        date: appt.date,
        start_time: appt.start_time,
        status: row.status,
        portalPath: patient.portal_token
          ? `/member/physiograph/${patient.portal_token}?tab=mine`
          : '/me',
      });
      return NextResponse.json({
        success: true,
        booking: {
          id: row.id,
          status: row.status,
          waitlist_position: waitlistPosition,
          message:
            row.status === 'waitlist'
              ? `Slot is full — you are #${waitlistPosition} on the waitlist. The practice has been notified.`
              : preferOther
                ? 'You are booked with another clinician for this slot'
                : 'You are booked into this appointment',
        },
        portal: buildPatientPortalPayload(store, store.patients[pi]),
      });
    }

    if (
      action === 'join_queue' ||
      action === 'request_next_available' ||
      action === 'waitlist_queue'
    ) {
      if (store.settings?.allow_public_booking === false) {
        return NextResponse.json(
          { error: 'Online booking is disabled by the practice' },
          { status: 403 }
        );
      }
      const { newQueueEntry, queuePosition, notifyPracticeWaitlist } =
        await import('@/lib/services/clinic-waitlist');
      store.waitlist_queue = store.waitlist_queue || [];
      const already = store.waitlist_queue.find(
        (q) => q.patient_id === patient.id && q.status === 'waiting'
      );
      if (already) {
        return NextResponse.json({
          success: true,
          queue: {
            id: already.id,
            position: queuePosition(store.waitlist_queue, already.id),
            message: 'You are already on the next-available waitlist',
          },
          portal: buildPatientPortalPayload(store, store.patients[pi]),
        });
      }
      const acceptAny = body.accept_any_clinician !== false;
      const entry = newQueueEntry({
        patient_id: patient.id,
        patient_name: patient.name,
        preferred_clinician_id: acceptAny
          ? patient.practitioner_id || null
          : body.preferred_clinician_id
            ? String(body.preferred_clinician_id)
            : patient.practitioner_id || null,
        accept_any_clinician: acceptAny,
        service_id: body.service_id ? String(body.service_id) : null,
        notes: body.notes ? String(body.notes) : undefined,
        now,
      });
      store.waitlist_queue.push(entry);
      const position = queuePosition(store.waitlist_queue, entry.id);
      const preferredName = entry.preferred_clinician_id
        ? store.practitioners.find((s) => s.id === entry.preferred_clinician_id)
            ?.name
        : undefined;
      await notifyPracticeWaitlist({
        to: store.settings?.contact_email,
        brand: store.settings?.brand_name || 'Practice',
        moduleLabel: 'PhysioAdvisor®',
        patientName: patient.name,
        patientEmail: patient.email,
        kind: 'queue',
        position,
        acceptAny: entry.accept_any_clinician,
        preferredClinicianName: preferredName,
        deskUrl: '/dashboard/physiograph/bookings',
      });
      entry.notified_at = now;
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        queue: {
          id: entry.id,
          position,
          message: `You are #${position} in the next-available queue. The practice has been notified.`,
        },
        portal: buildPatientPortalPayload(store, store.patients[pi]),
      });
    }

    if (action === 'leave_queue' || action === 'cancel_queue') {
      const qid = String(body.queue_id || body.id || '');
      store.waitlist_queue = store.waitlist_queue || [];
      const q = store.waitlist_queue.find(
        (x) =>
          x.patient_id === patient.id &&
          (qid ? x.id === qid : x.status === 'waiting')
      );
      if (q) {
        q.status = 'cancelled';
        await saveStore(companyId, meta, store);
      }
      return NextResponse.json({
        success: true,
        message: 'Removed from waitlist',
        portal: buildPatientPortalPayload(store, store.patients[pi]),
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (e: unknown) {
    console.error('[physiograph patient portal]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
