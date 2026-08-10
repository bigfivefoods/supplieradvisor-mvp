/**
 * Public post-visit feedback by token (no login).
 * GET  ?module=&companyId=&token=
 * POST { module, companyId, token, feeling, intensity, ... }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
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
  upsertServiceFeedback,
  type FeedbackModule,
  type ServiceFeedback,
} from '@/lib/services/booking-feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function modOf(v: unknown): FeedbackModule | null {
  const m = String(v || '').toLowerCase();
  if (m === 'fitgraph' || m === 'physiograph' || m === 'dentalgraph') return m;
  return null;
}

async function loadCompany(companyId: number) {
  const supabase = getSupabaseServer();
  const { data: prof } = await supabase
    .from('profiles')
    .select('id, trading_name, legal_name, metadata')
    .eq('id', companyId)
    .maybeSingle();
  if (!prof) return null;
  const meta =
    prof.metadata && typeof prof.metadata === 'object'
      ? { ...(prof.metadata as Record<string, unknown>) }
      : {};
  return {
    meta,
    brand: String(prof.trading_name || prof.legal_name || 'Practice'),
  };
}

async function saveMeta(companyId: number, meta: Record<string, unknown>) {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('profiles')
    .update({ metadata: meta, updated_at: new Date().toISOString() })
    .eq('id', companyId);
  if (error) throw new Error(error.message);
}

type Resolved = {
  brand: string;
  bookingId: string;
  eventId: string;
  eventLabel: string;
  personName: string;
  personEmail?: string;
  personId?: string;
  alreadySubmitted: boolean;
  module: FeedbackModule;
};

function resolveFit(
  store: FitgraphStore,
  token: string
): Resolved | null {
  const booking = store.bookings.find((b) => b.feedback_token === token);
  if (!booking || booking.status !== 'attended') return null;
  const session = store.sessions.find((s) => s.id === booking.session_id);
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
  if (!booking || booking.status !== 'attended') return null;
  const apt = store.appointments.find((a) => a.id === booking.appointment_id);
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
  if (!booking || booking.status !== 'attended') return null;
  const apt = store.appointments.find((a) => a.id === booking.appointment_id);
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
      if (!booking || booking.status !== 'attended') {
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
      await saveMeta(companyId, writeFitgraphToMetadata(meta, store));
      return NextResponse.json({
        success: true,
        message: 'Thanks — your feedback helps the team improve',
        feedback_id: row.id,
      });
    }

    if (module === 'physiograph') {
      const store = readPhysiographFromMetadata(meta);
      const booking = store.bookings.find((b) => b.feedback_token === token);
      if (!booking || booking.status !== 'attended') {
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

    // dentalgraph
    const store = readDentalgraphFromMetadata(meta);
    const booking = store.bookings.find((b) => b.feedback_token === token);
    if (!booking || booking.status !== 'attended') {
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
