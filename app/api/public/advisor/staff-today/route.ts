/**
 * Public staff PWA API — token-scoped today board for coaches/clinicians.
 * GET ?module=fitgraph|dentalgraph|physiograph|medicalgraph|psychiatrygraph|vetgraph&token=
 * POST mark attendance { module, token, booking_id, status }
 */
import { NextRequest, NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { loadAdvisorStoreForPublicToken } from '@/lib/business/advisor-store-resolve';
import { saveWalletCompanyMeta } from '@/lib/b2c/load-company';
import { parseClinicianCompanyIdFromToken } from '@/lib/services/clinician-portal';
import { isAdvisorModuleKey, type AdvisorModuleKey } from '@/lib/business/company-data';
import {
  parseCompanyIdFromToken,
  readFitgraphFromMetadata,
  writeFitgraphToMetadata,
} from '@/lib/fitness/fitgraph';
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
  readVetgraphFromMetadata,
  writeVetgraphToMetadata,
} from '@/lib/clinic/vetgraph';
import {
  applyAttendanceToPersonStats,
  promoteNextWaitlist,
  type PersonNoShowStats,
} from '@/lib/services/advisor-booking';
import { sendWaitlistOfferEmail } from '@/lib/services/advisor-reminders';
import { logoUrlFromSettings } from '@/lib/business/company-logo';
import {
  consumePackSession,
  fitPtPackToLedger,
  ledgerToFitPtPack,
} from '@/lib/services/advisor-pack-ledger';
import { appendAdvisorEvent } from '@/lib/services/advisor-events';
import {
  issueFeedbackPrompt,
  buildPublicFeedbackPath,
} from '@/lib/services/booking-feedback';
import { applyCoachMemberClassFeedback } from '@/lib/fitness/coach-member-feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseStaffCompanyId(token: string): number | null {
  return (
    parseCompanyIdFromToken(token) || parseClinicianCompanyIdFromToken(token)
  );
}

async function resolveStaff(module: string, token: string) {
  const clean = token.trim();
  if (!clean || !isAdvisorModuleKey(module)) return null;
  const indexKeys =
    module === 'fitgraph'
      ? ['fitgraph_coach_tokens']
      : [`${module}_staff_tokens`];
  return loadAdvisorStoreForPublicToken({
    token: clean,
    moduleKey: module as AdvisorModuleKey,
    read: (m) => m,
    parseCompanyId: parseStaffCompanyId,
    indexKeys,
  });
}

export async function GET(req: NextRequest) {
  const module = String(req.nextUrl.searchParams.get('module') || 'fitgraph');
  const token = String(req.nextUrl.searchParams.get('token') || '');
  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 });
  }

  const rl = rateLimit({
    key: `public-staff-today:${clientIp(req)}`,
    limit: 120,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const loaded = await resolveStaff(module, token);
  if (!loaded) {
    return NextResponse.json({ error: 'Staff portal not found' }, { status: 404 });
  }
  const rows = [
    {
      id: loaded.companyId,
      metadata: loaded.meta,
      company_name: null as string | null,
      name: null as string | null,
    },
  ];

  for (const row of rows || []) {
    const meta =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {};

    if (module === 'fitgraph' && meta.fitgraph) {
      const store = readFitgraphFromMetadata(meta);
      const coach = store.coaches.find(
        (c) => c.portal_token === token && c.active !== false
      );
      if (!coach) continue;
      const day = todayIso();
      const sessions = store.sessions.filter(
        (s) =>
          s.date === day &&
          s.status !== 'cancelled' &&
          (s.coach_id === coach.id || !s.coach_id)
      );
      const rowsOut: Array<Record<string, unknown>> = [];
      for (const s of sessions) {
        const ct = store.class_types.find((t) => t.id === s.class_type_id);
        const books = store.bookings.filter(
          (b) => b.session_id === s.id && b.status !== 'cancelled'
        );
        for (const b of books) {
          const client = store.clients.find((c) => c.id === b.client_id);
          rowsOut.push({
            booking_id: b.id,
            time: s.start_time,
            title: ct?.name || 'Class',
            attendee: b.family_member_name || client?.name || 'Member',
            status: b.status,
            location: s.location,
            session_id: s.id,
            coach_feedback: b.coach_feedback || null,
          });
        }
        if (!books.length) {
          rowsOut.push({
            booking_id: null,
            time: s.start_time,
            title: ct?.name || 'Class',
            attendee: null,
            status: 'open',
            location: s.location,
            session_id: s.id,
          });
        }
      }
      rowsOut.sort((a, b) =>
        String(a.time).localeCompare(String(b.time))
      );
      return NextResponse.json({
        success: true,
        module: 'fitgraph',
        companyId: row.id,
        brand:
          store.settings?.pwa_name ||
          store.settings?.brand_name ||
          row.company_name ||
          row.name ||
          'GymAdvisor',
        public_token: store.settings?.public_token || null,
        logo_url: logoUrlFromSettings(store.settings),
        staff: { id: coach.id, name: coach.name, role: 'coach' },
        date: day,
        rows: rowsOut,
      });
    }

    if (module === 'dentalgraph' && meta.dentalgraph) {
      const store = readDentalgraphFromMetadata(meta);
      const staff = store.staff.find(
        (c) => c.portal_token === token && c.active !== false
      );
      if (!staff) continue;
      const day = todayIso();
      const appts = store.appointments.filter(
        (a) =>
          a.date === day &&
          a.status !== 'cancelled' &&
          a.staff_id === staff.id
      );
      const rowsOut: Array<Record<string, unknown>> = [];
      for (const a of appts) {
        const svc = store.services.find((t) => t.id === a.service_id);
        const books = store.bookings.filter(
          (b) => b.appointment_id === a.id && b.status !== 'cancelled'
        );
        for (const b of books) {
          const patient = store.patients.find((p) => p.id === b.patient_id);
          rowsOut.push({
            booking_id: b.id,
            time: a.start_time,
            title: svc?.name || 'Appointment',
            attendee: b.family_member_name || patient?.name || 'Patient',
            status: b.status,
            location: a.location,
            appointment_id: a.id,
          });
        }
        if (!books.length) {
          rowsOut.push({
            booking_id: null,
            time: a.start_time,
            title: svc?.name || 'Appointment',
            attendee: null,
            status: 'open',
            location: a.location,
            appointment_id: a.id,
          });
        }
      }
      rowsOut.sort((a, b) =>
        String(a.time).localeCompare(String(b.time))
      );
      return NextResponse.json({
        success: true,
        module: 'dentalgraph',
        companyId: row.id,
        brand:
          store.settings?.brand_name ||
          row.company_name ||
          'DentalAdvisor',
        staff: { id: staff.id, name: staff.name, role: 'clinician' },
        date: day,
        rows: rowsOut,
      });
    }

    for (const cfg of [
      {
        key: 'physiograph' as const,
        read: readPhysiographFromMetadata,
        label: 'PhysioAdvisor',
      },
      {
        key: 'medicalgraph' as const,
        read: readMedicalgraphFromMetadata,
        label: 'MedicalAdvisor',
      },
      {
        key: 'psychiatrygraph' as const,
        read: readPsychiatrygraphFromMetadata,
        label: 'PsychiatryAdvisor',
      },
      {
        key: 'vetgraph' as const,
        read: readVetgraphFromMetadata,
        label: 'VetAdvisor',
      },
    ]) {
      if (module !== cfg.key || !meta[cfg.key]) continue;
      const store = cfg.read(meta);
      const prac = store.practitioners.find(
        (c) => c.portal_token === token && c.active !== false
      );
      if (!prac) continue;
      const day = todayIso();
      const appts = store.appointments.filter(
        (a) =>
          a.date === day &&
          a.status !== 'cancelled' &&
          a.practitioner_id === prac.id
      );
      const rowsOut: Array<Record<string, unknown>> = [];
      for (const a of appts) {
        const svc = store.services.find((t) => t.id === a.service_id);
        const books = store.bookings.filter(
          (b) => b.appointment_id === a.id && b.status !== 'cancelled'
        );
        for (const b of books) {
          const patient = store.patients.find((p) => p.id === b.patient_id);
          rowsOut.push({
            booking_id: b.id,
            time: a.start_time,
            title: svc?.name || 'Appointment',
            attendee: b.family_member_name || patient?.name || 'Patient',
            status: b.status,
            location: a.location,
            appointment_id: a.id,
          });
        }
        if (!books.length) {
          rowsOut.push({
            booking_id: null,
            time: a.start_time,
            title: svc?.name || 'Appointment',
            attendee: null,
            status: 'open',
            location: a.location,
            appointment_id: a.id,
          });
        }
      }
      rowsOut.sort((a, b) =>
        String(a.time).localeCompare(String(b.time))
      );
      return NextResponse.json({
        success: true,
        module: cfg.key,
        companyId: row.id,
        brand:
          store.settings?.brand_name || row.company_name || cfg.label,
        staff: { id: prac.id, name: prac.name, role: 'clinician' },
        date: day,
        rows: rowsOut,
      });
    }
  }

  return NextResponse.json({ error: 'Staff portal not found' }, { status: 404 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const module = String(body.module || 'fitgraph');
    const token = String(body.token || '');
    const action = String(body.action || 'mark');
    const bookingId = String(body.booking_id || '');
    const status = String(body.status || 'attended');
    const sessionId = String(body.session_id || body.appointment_id || '');
    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }
    if (
      action !== 'delete_session' &&
      action !== 'delete_appointment' &&
      !bookingId
    ) {
      return NextResponse.json(
        { error: 'token and booking_id required' },
        { status: 400 }
      );
    }
    if (action === 'member_coach_feedback' && module !== 'fitgraph') {
      return NextResponse.json(
        { error: 'Member class feedback is GymAdvisor only' },
        { status: 400 }
      );
    }

    const rl = rateLimit({
      key: `public-staff-today-post:${clientIp(req)}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const loaded = await resolveStaff(module, token);
    if (!loaded) {
      return NextResponse.json(
        { error: 'Staff portal not found' },
        { status: 404 }
      );
    }
    const rows = [{ id: loaded.companyId, metadata: loaded.meta }];

    for (const row of rows || []) {
      const meta0 =
        row.metadata && typeof row.metadata === 'object'
          ? { ...(row.metadata as Record<string, unknown>) }
          : {};

      if (module === 'fitgraph' && meta0.fitgraph) {
        const store = readFitgraphFromMetadata(meta0);
        const coach = store.coaches.find((c) => c.portal_token === token);
        if (!coach) continue;

        const now = new Date().toISOString();

        if (action === 'member_coach_feedback') {
          const result = applyCoachMemberClassFeedback(store, {
            bookingId,
            coachId: coach.id,
            coachName: coach.name,
            comment: String(body.comment || body.note || ''),
            feeling: body.feeling,
            rating: body.rating,
            now,
          });
          if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 400 });
          }
          const meta = writeFitgraphToMetadata(meta0, store);
          await saveWalletCompanyMeta(Number(row.id), meta);
          return NextResponse.json({
            success: true,
            message: 'Member feedback saved',
          });
        }

        if (action === 'delete_session' || action === 'delete_appointment') {
          const session = store.sessions.find(
            (s) =>
              s.id === sessionId &&
              (s.coach_id === coach.id || !s.coach_id)
          );
          if (!session) {
            return NextResponse.json(
              { error: 'Session not found' },
              { status: 404 }
            );
          }
          store.sessions = store.sessions.filter((s) => s.id !== session.id);
          store.bookings = store.bookings.filter(
            (b) => b.session_id !== session.id
          );
          const meta = writeFitgraphToMetadata(meta0, store);
          await saveWalletCompanyMeta(Number(row.id), meta);
          return NextResponse.json({
            success: true,
            deleted: 1,
            message: 'Class deleted',
          });
        }

        const booking = store.bookings.find((b) => b.id === bookingId);
        if (!booking) {
          return NextResponse.json(
            { error: 'Booking not found' },
            { status: 404 }
          );
        }
        const prev = booking.status;
        booking.status = status as typeof booking.status;

        if (status === 'cancelled' && prev !== 'cancelled') {
          const promoted = promoteNextWaitlist(
            store.bookings,
            (b) => b.session_id === booking.session_id,
            now
          );
          if (promoted) {
            const client = store.clients.find(
              (c) => c.id === promoted.client_id
            );
            const session = store.sessions.find(
              (s) => s.id === booking.session_id
            );
            const ct = session
              ? store.class_types.find((t) => t.id === session.class_type_id)
              : null;
            if (client?.email && session) {
              void sendWaitlistOfferEmail({
                to: client.email,
                personName: client.name,
                brand: store.settings?.brand_name || 'Gym',
                eventTitle: ct?.name || 'Class',
                date: session.date,
                start_time: session.start_time,
                location: session.location,
                moduleLabel: 'GymAdvisor®',
                moduleKey: 'fitgraph',
                logoUrl: logoUrlFromSettings(store.settings),
              });
            }
          }
        }

        if (
          (status === 'attended' || status === 'no_show') &&
          prev !== status
        ) {
          const ci = store.clients.findIndex(
            (c) => c.id === booking.client_id
          );
          if (ci >= 0) {
            Object.assign(
              store.clients[ci],
              applyAttendanceToPersonStats(
                store.clients[ci],
                status as 'attended' | 'no_show',
                now
              )
            );
          }
        }

        let packRemaining: number | null = null;
        if (status === 'attended' && prev !== 'attended') {
          const session = store.sessions.find(
            (s) => s.id === booking.session_id
          );
          const ledgers = (store.pt_packs || []).map(fitPtPackToLedger);
          const { packs, remaining } = consumePackSession(ledgers, {
            personId: booking.client_id,
            bookingId: booking.id,
            providerId: session?.coach_id || coach.id,
            now,
          });
          store.pt_packs = packs.map(ledgerToFitPtPack);
          packRemaining = remaining;
          const prompted = issueFeedbackPrompt(booking, now);
          booking.feedback_token = prompted.feedback_token;
          booking.feedback_requested_at = prompted.feedback_requested_at;
        }

        let meta = writeFitgraphToMetadata(meta0, store);
        const ev = appendAdvisorEvent(meta, {
          module: 'fitgraph',
          company_id: Number(row.id),
          type: 'attendance.marked',
          person_id: booking.client_id,
          booking_id: booking.id,
          meta: { status, source: 'staff_pwa', staff_id: coach.id },
        });
        meta = ev.metadata;

        await saveWalletCompanyMeta(Number(row.id), meta);

        return NextResponse.json({
          success: true,
          booking: { id: booking.id, status: booking.status },
          pack_remaining: packRemaining,
          feedback_path: booking.feedback_token
            ? buildPublicFeedbackPath(
                'fitgraph',
                Number(row.id),
                booking.feedback_token
              )
            : null,
        });
      }

      if (module === 'dentalgraph' && meta0.dentalgraph) {
        const store = readDentalgraphFromMetadata(meta0);
        const staff = store.staff.find((c) => c.portal_token === token);
        if (!staff) continue;
        const now = new Date().toISOString();

        if (action === 'delete_session' || action === 'delete_appointment') {
          const appt = store.appointments.find(
            (a) => a.id === sessionId && a.staff_id === staff.id
          );
          if (!appt) {
            return NextResponse.json(
              { error: 'Appointment not found' },
              { status: 404 }
            );
          }
          store.appointments = store.appointments.filter(
            (a) => a.id !== appt.id
          );
          store.bookings = store.bookings.filter(
            (b) => b.appointment_id !== appt.id
          );
          const meta = writeDentalgraphToMetadata(meta0, store);
          await saveWalletCompanyMeta(Number(row.id), meta);
          return NextResponse.json({
            success: true,
            deleted: 1,
            message: 'Appointment deleted',
          });
        }

        const booking = store.bookings.find((b) => b.id === bookingId);
        if (!booking) {
          return NextResponse.json(
            { error: 'Booking not found' },
            { status: 404 }
          );
        }
        const prev = booking.status;
        booking.status = status as typeof booking.status;
        if (
          (status === 'attended' || status === 'no_show') &&
          prev !== status
        ) {
          const pi = store.patients.findIndex(
            (p) => p.id === booking.patient_id
          );
          if (pi >= 0) {
            Object.assign(
              store.patients[pi],
              applyAttendanceToPersonStats(
                store.patients[pi],
                status as 'attended' | 'no_show',
                now
              )
            );
          }
        }
        if (status === 'cancelled' && prev !== 'cancelled') {
          promoteNextWaitlist(
            store.bookings,
            (b) => b.appointment_id === booking.appointment_id,
            now
          );
        }
        if (status === 'attended' && prev !== 'attended') {
          store.care_packs = store.care_packs || [];
          const { packs } = consumePackSession(store.care_packs, {
            personId: booking.patient_id,
            bookingId: booking.id,
            now,
          });
          store.care_packs = packs;
          const prompted = issueFeedbackPrompt(booking, now);
          booking.feedback_token = prompted.feedback_token;
          booking.feedback_requested_at = prompted.feedback_requested_at;
        }
        const meta = writeDentalgraphToMetadata(meta0, store);
        await saveWalletCompanyMeta(Number(row.id), meta);
        return NextResponse.json({
          success: true,
          booking: { id: booking.id, status: booking.status },
        });
      }

      const clinicAttendance = <
        TStore extends {
          practitioners: Array<{ id: string; portal_token?: string | null }>;
          bookings: Array<{
            id: string;
            status: string;
            patient_id: string;
            feedback_token?: string | null;
            feedback_requested_at?: string | null;
          }>;
          patients: Array<PersonNoShowStats & { id: string }>;
          care_packs?: Parameters<typeof consumePackSession>[0];
        },
      >(
        key: 'physiograph' | 'medicalgraph' | 'psychiatrygraph' | 'vetgraph',
        read: (meta: Record<string, unknown>) => TStore,
        write: (
          meta: Record<string, unknown>,
          store: TStore
        ) => Record<string, unknown>
      ) => {
        if (module !== key || !meta0[key]) return null;
        const store = read(meta0);
        const prac = store.practitioners.find(
          (c) => c.portal_token === token
        );
        if (!prac) return null;
        const booking = store.bookings.find((b) => b.id === bookingId);
        if (!booking) {
          return { error: 'Booking not found' as const };
        }
        const now = new Date().toISOString();
        const prev = booking.status;
        booking.status = status as typeof booking.status;
        if (
          (status === 'attended' || status === 'no_show') &&
          prev !== status
        ) {
          const pi = store.patients.findIndex(
            (p) => p.id === booking.patient_id
          );
          if (pi >= 0) {
            Object.assign(
              store.patients[pi],
              applyAttendanceToPersonStats(
                store.patients[pi],
                status as 'attended' | 'no_show',
                now
              )
            );
          }
        }
        if (status === 'attended' && prev !== 'attended') {
          store.care_packs = store.care_packs || [];
          const { packs } = consumePackSession(store.care_packs, {
            personId: booking.patient_id,
            bookingId: booking.id,
            now,
          });
          store.care_packs = packs;
          const prompted = issueFeedbackPrompt(booking, now);
          booking.feedback_token = prompted.feedback_token;
          booking.feedback_requested_at = prompted.feedback_requested_at;
        }
        return {
          meta: write(meta0, store),
          booking: { id: booking.id, status: booking.status },
        };
      };

      const clinicSaved =
        clinicAttendance(
          'physiograph',
          readPhysiographFromMetadata,
          writePhysiographToMetadata
        ) ||
        clinicAttendance(
          'medicalgraph',
          readMedicalgraphFromMetadata,
          writeMedicalgraphToMetadata
        ) ||
        clinicAttendance(
          'psychiatrygraph',
          readPsychiatrygraphFromMetadata,
          writePsychiatrygraphToMetadata
        ) ||
        clinicAttendance(
          'vetgraph',
          readVetgraphFromMetadata,
          writeVetgraphToMetadata
        );
      if (clinicSaved) {
        if ('error' in clinicSaved) {
          return NextResponse.json(
            { error: clinicSaved.error },
            { status: 404 }
          );
        }
        await saveWalletCompanyMeta(Number(row.id), clinicSaved.meta);
        return NextResponse.json({
          success: true,
          booking: clinicSaved.booking,
        });
      }
    }

    return NextResponse.json(
      { error: 'Staff portal not found' },
      { status: 404 }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
