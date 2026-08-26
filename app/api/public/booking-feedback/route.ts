/**
 * Public post-visit feedback by token (no login).
 * GET  ?module=&companyId=&token=
 * POST { module, companyId, token, feeling, intensity, ... }
 */
import { NextRequest, NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  readFitgraphFromMetadata,
  writeFitgraphToMetadata,
  upsertClassFeedback,
  type FitgraphStore,
} from '@/lib/fitness/fitgraph';
import {
  readPhysiographFromMetadata,
  writePhysiographToMetadata,
  type PhysiographStore,
} from '@/lib/clinic/physiograph';
import {
  readDentalgraphFromMetadata,
  writeDentalgraphToMetadata,
  type DentalgraphStore,
} from '@/lib/dental/dentalgraph';
import {
  readMedicalgraphFromMetadata,
  writeMedicalgraphToMetadata,
  type MedicalgraphStore,
} from '@/lib/clinic/medicalgraph';
import {
  readPsychiatrygraphFromMetadata,
  writePsychiatrygraphToMetadata,
  type PsychiatrygraphStore,
} from '@/lib/clinic/psychiatrygraph';
import { logoUrlFromSettings, pickCompanyLogoUrl } from '@/lib/business/company-logo';
import {
  upsertServiceFeedback,
  bookingEligibleForClientRating,
  type FeedbackModule,
  type ServiceFeedback,
} from '@/lib/services/booking-feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function modOf(v: unknown): FeedbackModule | null {
  const m = String(v || '').toLowerCase();
  if (
    m === 'fitgraph' ||
    m === 'physiograph' ||
    m === 'dentalgraph' ||
    m === 'psychiatrygraph' ||
    m === 'medicalgraph' ||
    m === 'vetgraph'
  )
    return m;
  return null;
}

async function loadCompany(companyId: number) {
  const { loadWalletCompany } = await import('@/lib/b2c/load-company');
  const company = await loadWalletCompany(companyId);
  if (!company) return null;
  return {
    meta: company.meta,
    brand: company.name || 'Practice',
    logo_url: company.logoUrl || pickCompanyLogoUrl({ logo_url: company.logoUrl }),
  };
}

async function saveMeta(companyId: number, meta: Record<string, unknown>) {
  const { saveWalletCompanyMeta } = await import('@/lib/b2c/load-company');
  await saveWalletCompanyMeta(companyId, meta);
}

type Resolved = {
  brand: string;
  logo_url?: string | null;
  bookingId: string;
  eventId: string;
  eventLabel: string;
  personName: string;
  personEmail?: string;
  personId?: string;
  alreadySubmitted: boolean;
  module: FeedbackModule;
};

function feedbackStatusOk(
  status?: string,
  date?: string | null,
  startTime?: string | null
) {
  return bookingEligibleForClientRating({
    status,
    date,
    startTime,
  });
}

type ClinicFeedbackStore = {
  bookings: Array<{
    id: string;
    appointment_id: string;
    patient_id: string;
    status?: string;
    feedback_token?: string | null;
    feedback_submitted_at?: string | null;
    feedback_id?: string | null;
  }>;
  appointments?: Array<{
    id: string;
    date?: string;
    start_time?: string;
  }>;
  patients: Array<{ id: string; name?: string; email?: string | null }>;
  appointment_feedback?: ServiceFeedback[];
};

function applyClinicVisitFeedback<T extends ClinicFeedbackStore>(
  store: T,
  opts: {
    token: string;
    now: string;
    statusOk: (
      status?: string,
      date?: string | null,
      startTime?: string | null
    ) => boolean;
    body: Record<string, unknown>;
    includePractice?: boolean;
  }
):
  | { kind: 'invalid' }
  | { kind: 'already' }
  | { kind: 'saved'; feedbackId: string } {
  const booking = store.bookings.find((b) => b.feedback_token === opts.token);
  const appt = (store.appointments || []).find(
    (a) => a.id === booking?.appointment_id
  );
  if (
    !booking ||
    !opts.statusOk(booking.status, appt?.date, appt?.start_time)
  )
    return { kind: 'invalid' };
  if (booking.feedback_submitted_at) return { kind: 'already' };
  const patient = store.patients.find((p) => p.id === booking.patient_id);
  const { list, row } = upsertServiceFeedback(store.appointment_feedback, {
    booking_id: booking.id,
    event_id: booking.appointment_id,
    role: 'patient',
    person_id: booking.patient_id,
    author_name:
      opts.body.author_name != null
        ? String(opts.body.author_name)
        : patient?.name,
    author_email:
      opts.body.author_email != null
        ? String(opts.body.author_email)
        : patient?.email ?? undefined,
    feeling: opts.body.feeling,
    intensity: opts.body.intensity,
    enjoyment: opts.body.enjoyment,
    would_return: opts.includePractice
      ? opts.body.would_return ?? opts.body.practice
      : opts.body.would_return,
    practice: opts.includePractice ? opts.body.practice : undefined,
    comment:
      opts.body.comment != null ? String(opts.body.comment) : undefined,
    tags: Array.isArray(opts.body.tags)
      ? (opts.body.tags as unknown[]).map(String)
      : undefined,
  } as Omit<ServiceFeedback, 'id' | 'created_at' | 'updated_at'>);
  store.appointment_feedback = list;
  booking.feedback_submitted_at = opts.now;
  booking.feedback_id = row.id;
  return { kind: 'saved', feedbackId: row.id };
}

function clinicFeedbackEarlyResponse(
  result: ReturnType<typeof applyClinicVisitFeedback>
) {
  if (result.kind === 'invalid') {
    return NextResponse.json(
      { error: 'Invalid feedback link' },
      { status: 404 }
    );
  }
  if (result.kind === 'already') {
    return NextResponse.json({
      success: true,
      message: 'Feedback already submitted — thank you',
      already_submitted: true,
    });
  }
  return null;
}

function resolveFit(
  store: FitgraphStore,
  token: string
): Resolved | null {
  const booking = store.bookings.find((b) => b.feedback_token === token);
  const session = store.sessions.find((s) => s.id === booking?.session_id);
  if (
    !booking ||
    !feedbackStatusOk(booking.status, session?.date, session?.start_time)
  )
    return null;
  const ct = session
    ? store.class_types.find((c) => c.id === session.class_type_id)
    : null;
  const client = store.clients.find((c) => c.id === booking.client_id);
  return {
    brand: store.settings?.brand_name || 'Gym',
    bookingId: booking.id,
    eventId: booking.session_id,
    eventLabel: session
      ? `${session.date} ${session.start_time} · ${ct?.name || 'Class'}`
      : 'Class',
    personName: client?.name || booking.guest_name || 'Member',
    personEmail: client?.email || booking.guest_email,
    personId: booking.client_id,
    alreadySubmitted: Boolean(booking.feedback_submitted_at),
    module: 'fitgraph',
  };
}

function resolvePhysio(
  store: PhysiographStore,
  token: string
): Resolved | null {
  const booking = store.bookings.find((b) => b.feedback_token === token);
  const apt = store.appointments.find((a) => a.id === booking?.appointment_id);
  if (
    !booking ||
    !feedbackStatusOk(booking.status, apt?.date, apt?.start_time)
  )
    return null;
  const svc = apt
    ? store.services.find((s) => s.id === apt.service_id)
    : null;
  const patient = store.patients.find((p) => p.id === booking.patient_id);
  return {
    brand: store.settings?.brand_name || 'Clinic',
    bookingId: booking.id,
    eventId: booking.appointment_id,
    eventLabel: apt
      ? `${apt.date} ${apt.start_time} · ${svc?.name || 'Appointment'}`
      : 'Appointment',
    personName: patient?.name || 'Patient',
    personEmail: patient?.email,
    personId: booking.patient_id,
    alreadySubmitted: Boolean(booking.feedback_submitted_at),
    module: 'physiograph',
  };
}

function resolveDental(
  store: DentalgraphStore,
  token: string
): Resolved | null {
  const booking = store.bookings.find((b) => b.feedback_token === token);
  const apt = store.appointments.find((a) => a.id === booking?.appointment_id);
  if (
    !booking ||
    !feedbackStatusOk(booking.status, apt?.date, apt?.start_time)
  )
    return null;
  const svc = apt
    ? store.services.find((s) => s.id === apt.service_id)
    : null;
  const patient = store.patients.find((p) => p.id === booking.patient_id);
  return {
    brand: store.settings?.brand_name || 'Dental practice',
    bookingId: booking.id,
    eventId: booking.appointment_id,
    eventLabel: apt
      ? `${apt.date} ${apt.start_time} · ${svc?.name || 'Visit'}`
      : 'Visit',
    personName: patient?.name || 'Patient',
    personEmail: patient?.email,
    personId: booking.patient_id,
    alreadySubmitted: Boolean(booking.feedback_submitted_at),
    module: 'dentalgraph',
  };
}

function resolveMedical(
  store: MedicalgraphStore,
  token: string
): Resolved | null {
  const booking = store.bookings.find((b) => b.feedback_token === token);
  const apt = store.appointments.find((a) => a.id === booking?.appointment_id);
  if (
    !booking ||
    !feedbackStatusOk(booking.status, apt?.date, apt?.start_time)
  )
    return null;
  const svc = apt
    ? store.services.find((s) => s.id === apt.service_id)
    : null;
  const patient = store.patients.find((p) => p.id === booking.patient_id);
  return {
    brand: store.settings?.brand_name || 'Practice',
    logo_url: logoUrlFromSettings(store.settings),
    bookingId: booking.id,
    eventId: booking.appointment_id,
    eventLabel: apt
      ? `${apt.date} ${apt.start_time} · ${svc?.name || 'Appointment'}`
      : 'Appointment',
    personName: patient?.name || 'Patient',
    personEmail: patient?.email,
    personId: booking.patient_id,
    alreadySubmitted: Boolean(booking.feedback_submitted_at),
    module: 'medicalgraph',
  };
}

function resolvePsychiatry(
  store: PsychiatrygraphStore,
  token: string
): Resolved | null {
  const booking = store.bookings.find((b) => b.feedback_token === token);
  const apt = store.appointments.find((a) => a.id === booking?.appointment_id);
  if (
    !booking ||
    !feedbackStatusOk(booking.status, apt?.date, apt?.start_time)
  )
    return null;
  const svc = apt
    ? store.services.find((s) => s.id === apt.service_id)
    : null;
  const patient = store.patients.find((p) => p.id === booking.patient_id);
  return {
    brand: store.settings?.brand_name || 'Practice',
    bookingId: booking.id,
    eventId: booking.appointment_id,
    eventLabel: apt
      ? `${apt.date} ${apt.start_time} · ${svc?.name || 'Appointment'}`
      : 'Appointment',
    personName: patient?.name || 'Patient',
    personEmail: patient?.email,
    personId: booking.patient_id,
    alreadySubmitted: Boolean(booking.feedback_submitted_at),
    module: 'psychiatrygraph',
  };
}

export async function GET(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({
      key: `public-fb-get:${ip}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
    }

    const module = modOf(request.nextUrl.searchParams.get('module'));
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const token = String(request.nextUrl.searchParams.get('token') || '').trim();
    if (!module || !Number.isFinite(companyId) || !token) {
      return NextResponse.json(
        { error: 'module, companyId and token required' },
        { status: 400 }
      );
    }

    const loaded = await loadCompany(companyId);
    if (!loaded) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let resolved: Resolved | null = null;
    if (module === 'fitgraph') {
      resolved = resolveFit(readFitgraphFromMetadata(loaded.meta), token);
    } else if (module === 'physiograph') {
      resolved = resolvePhysio(readPhysiographFromMetadata(loaded.meta), token);
    } else if (module === 'medicalgraph') {
      resolved = resolveMedical(readMedicalgraphFromMetadata(loaded.meta), token);
    } else if (module === 'vetgraph') {
      const hit = resolveMedical(
        (await import('@/lib/clinic/vetgraph')).readVetgraphFromMetadata(
          loaded.meta
        ) as never,
        token
      );
      resolved = hit ? { ...hit, module: 'vetgraph' } : null;
    } else if (module === 'psychiatrygraph') {
      resolved = resolvePsychiatry(
        readPsychiatrygraphFromMetadata(loaded.meta),
        token
      );
    } else {
      resolved = resolveDental(readDentalgraphFromMetadata(loaded.meta), token);
    }

    if (!resolved) {
      return NextResponse.json(
        { error: 'Feedback link not found or visit not completed' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      brand: resolved.brand || loaded.brand,
      logo_url: resolved.logo_url || loaded.logo_url || null,
      module,
      event_label: resolved.eventLabel,
      person_name: resolved.personName,
      already_submitted: resolved.alreadySubmitted,
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
      key: `public-fb-post:${ip}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
    }

    const body = await request.json();
    const module = modOf(body.module);
    const companyId = Number(body.companyId);
    const token = String(body.token || '').trim();
    if (!module || !Number.isFinite(companyId) || !token) {
      return NextResponse.json(
        { error: 'module, companyId and token required' },
        { status: 400 }
      );
    }

    const loaded = await loadCompany(companyId);
    if (!loaded) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const now = new Date().toISOString();
    const meta = loaded.meta;

    if (module === 'fitgraph') {
      const store = readFitgraphFromMetadata(meta);
      const booking = store.bookings.find((b) => b.feedback_token === token);
      const session = store.sessions.find((s) => s.id === booking?.session_id);
      if (
        !booking ||
        !feedbackStatusOk(booking.status, session?.date, session?.start_time)
      ) {
        return NextResponse.json({ error: 'Invalid feedback link' }, { status: 404 });
      }
      if (booking.feedback_submitted_at) {
        return NextResponse.json({
          success: true,
          message: 'Feedback already submitted — thank you',
          already_submitted: true,
        });
      }
      const client = store.clients.find((c) => c.id === booking.client_id);
      const row = upsertClassFeedback(store, {
        session_id: booking.session_id,
        role: 'member',
        client_id: booking.client_id,
        booking_id: booking.id,
        author_name:
          body.author_name != null
            ? String(body.author_name)
            : client?.name || booking.guest_name,
        author_email:
          body.author_email != null
            ? String(body.author_email)
            : client?.email || booking.guest_email,
        feeling: body.feeling,
        intensity: body.intensity,
        enjoyment: body.enjoyment,
        would_return: body.would_return,
        comment: body.comment != null ? String(body.comment) : undefined,
        tags: Array.isArray(body.tags)
          ? (body.tags as unknown[]).map(String)
          : undefined,
      });
      booking.feedback_submitted_at = now;
      booking.feedback_id = row.id;
      try {
        const { notifyGymClassFeedback } = await import(
          '@/lib/fitness/notify-class-feedback'
        );
        await notifyGymClassFeedback({
          store,
          bookingId: booking.id,
          feedback: row,
        });
      } catch {
        /* notice/email is best-effort */
      }
      await saveMeta(companyId, writeFitgraphToMetadata(meta, store));
      return NextResponse.json({
        success: true,
        message: 'Thanks — your coach and the gym have your feedback',
        feedback_id: row.id,
      });
    }

    if (module === 'physiograph') {
      const store = readPhysiographFromMetadata(meta);
      const booking = store.bookings.find((b) => b.feedback_token === token);
      const apt = store.appointments.find(
        (a) => a.id === booking?.appointment_id
      );
      if (
        !booking ||
        !feedbackStatusOk(booking.status, apt?.date, apt?.start_time)
      ) {
        return NextResponse.json({ error: 'Invalid feedback link' }, { status: 404 });
      }
      if (booking.feedback_submitted_at) {
        return NextResponse.json({
          success: true,
          message: 'Feedback already submitted — thank you',
          already_submitted: true,
        });
      }
      const patient = store.patients.find((p) => p.id === booking.patient_id);
      const { list, row } = upsertServiceFeedback(store.appointment_feedback, {
        booking_id: booking.id,
        event_id: booking.appointment_id,
        role: 'patient',
        person_id: booking.patient_id,
        author_name:
          body.author_name != null
            ? String(body.author_name)
            : patient?.name,
        author_email:
          body.author_email != null
            ? String(body.author_email)
            : patient?.email,
        feeling: body.feeling,
        intensity: body.intensity,
        enjoyment: body.enjoyment,
        would_return: body.would_return,
        comment: body.comment != null ? String(body.comment) : undefined,
        tags: Array.isArray(body.tags)
          ? (body.tags as unknown[]).map(String)
          : undefined,
      } as Omit<ServiceFeedback, 'id' | 'created_at' | 'updated_at'>);
      store.appointment_feedback = list;
      booking.feedback_submitted_at = now;
      booking.feedback_id = row.id;
      await saveMeta(companyId, writePhysiographToMetadata(meta, store));
      return NextResponse.json({
        success: true,
        message: 'Thanks — your feedback helps the clinic improve',
        feedback_id: row.id,
      });
    }

    if (module === 'medicalgraph') {
      const store = readMedicalgraphFromMetadata(meta);
      const result = applyClinicVisitFeedback(store, {
        token,
        now,
        statusOk: feedbackStatusOk,
        body,
        includePractice: true,
      });
      const early = clinicFeedbackEarlyResponse(result);
      if (early) return early;
      await saveMeta(companyId, writeMedicalgraphToMetadata(meta, store));
      return NextResponse.json({
        success: true,
        message: 'Thanks — your feedback helps the practice improve',
        feedback_id: result.kind === 'saved' ? result.feedbackId : undefined,
      });
    }

    if (module === 'vetgraph') {
      const vet = await import('@/lib/clinic/vetgraph');
      const store = vet.readVetgraphFromMetadata(meta);
      const result = applyClinicVisitFeedback(store, {
        token,
        now,
        statusOk: feedbackStatusOk,
        body,
        includePractice: true,
      });
      const early = clinicFeedbackEarlyResponse(result);
      if (early) return early;
      await saveMeta(companyId, vet.writeVetgraphToMetadata(meta, store));
      return NextResponse.json({
        success: true,
        message: 'Thanks — your feedback helps the practice improve',
        feedback_id: result.kind === 'saved' ? result.feedbackId : undefined,
      });
    }

    if (module === 'psychiatrygraph') {
      const store = readPsychiatrygraphFromMetadata(meta);
      const result = applyClinicVisitFeedback(store, {
        token,
        now,
        statusOk: feedbackStatusOk,
        body,
        includePractice: true,
      });
      const early = clinicFeedbackEarlyResponse(result);
      if (early) return early;
      await saveMeta(companyId, writePsychiatrygraphToMetadata(meta, store));
      return NextResponse.json({
        success: true,
        message: 'Thanks — your feedback helps the practice improve',
        feedback_id: result.kind === 'saved' ? result.feedbackId : undefined,
      });
    }

    // dentalgraph
    const store = readDentalgraphFromMetadata(meta);
    const booking = store.bookings.find((b) => b.feedback_token === token);
    const apt = store.appointments.find((a) => a.id === booking?.appointment_id);
    if (
      !booking ||
      !feedbackStatusOk(booking.status, apt?.date, apt?.start_time)
    ) {
      return NextResponse.json({ error: 'Invalid feedback link' }, { status: 404 });
    }
    if (booking.feedback_submitted_at) {
      return NextResponse.json({
        success: true,
        message: 'Feedback already submitted — thank you',
        already_submitted: true,
      });
    }
    const patient = store.patients.find((p) => p.id === booking.patient_id);
    const { list, row } = upsertServiceFeedback(store.appointment_feedback, {
      booking_id: booking.id,
      event_id: booking.appointment_id,
      role: 'patient',
      person_id: booking.patient_id,
      author_name:
        body.author_name != null
          ? String(body.author_name)
          : patient?.name,
      author_email:
        body.author_email != null
          ? String(body.author_email)
          : patient?.email,
      feeling: body.feeling,
      intensity: body.intensity,
      enjoyment: body.enjoyment,
      would_return: body.would_return,
      comment: body.comment != null ? String(body.comment) : undefined,
      tags: Array.isArray(body.tags)
        ? (body.tags as unknown[]).map(String)
        : undefined,
    } as Omit<ServiceFeedback, 'id' | 'created_at' | 'updated_at'>);
    store.appointment_feedback = list;
    booking.feedback_submitted_at = now;
    booking.feedback_id = row.id;
    await saveMeta(companyId, writeDentalgraphToMetadata(meta, store));
    return NextResponse.json({
      success: true,
      message: 'Thanks — your feedback helps the practice improve',
      feedback_id: row.id,
    });
  } catch (e: unknown) {
    console.error('[booking-feedback]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
