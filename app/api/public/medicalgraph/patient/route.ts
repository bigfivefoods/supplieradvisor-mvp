/**
 * MedicalAdvisor patient portal (token auth).
 * GET  ?token= — open diary vacancies + my bookings
 * POST book | request_join | cancel | update_profile
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  MEDICALGRAPH_PATIENT_TOKENS_KEY,
  appointmentBookingCount,
  buildPatientPortalPayload,
  newId,
  parsePhysioCompanyIdFromToken,
  readMedicalgraphFromMetadata,
  writeMedicalgraphToMetadata,
  type MedicalBooking,
  type MedicalPatient,
  type MedicalgraphStore,
} from '@/lib/clinic/medicalgraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function resolvePatient(token: string): Promise<{
  companyId: number;
  meta: Record<string, unknown>;
  store: MedicalgraphStore;
  patient: MedicalPatient;
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
      const map = meta[MEDICALGRAPH_PATIENT_TOKENS_KEY];
      if (map && typeof map === 'object' && clean in (map as object)) {
        companyId = Number(row.id);
        break;
      }
      const store = readMedicalgraphFromMetadata(meta);
      if (store.patients.some((p) => p.portal_token === clean)) {
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
  const store = readMedicalgraphFromMetadata(meta);
  const patient = store.patients.find((p) => p.portal_token === clean);
  if (!patient || patient.active === false) return null;
  return { companyId: Number(prof.id), meta, store, patient };
}

async function saveStore(
  companyId: number,
  meta: Record<string, unknown>,
  store: MedicalgraphStore
) {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('profiles')
    .update({
      metadata: writeMedicalgraphToMetadata(meta, store),
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
      const finalStatus: MedicalBooking['status'] = full ? 'waitlist' : 'booked';
      const row: MedicalBooking = {
        id: newId('bk'),
        appointment_id: appointmentId,
        patient_id: patient.id,
        status: finalStatus,
        booked_at: now,
        source: 'patient_portal',
        notes:
          finalStatus === 'waitlist'
            ? 'Patient portal — waitlist / join request'
            : 'Patient portal booking',
      };
      store.bookings.push(row);
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        booking: {
          id: row.id,
          status: row.status,
          message:
            row.status === 'waitlist'
              ? 'Slot is full — you are on the waitlist'
              : 'You are booked into this appointment',
        },
        portal: buildPatientPortalPayload(store, store.patients[pi]),
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    console.error('[medicalgraph patient portal]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
