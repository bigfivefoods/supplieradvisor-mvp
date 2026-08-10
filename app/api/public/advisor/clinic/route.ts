/**
 * Public clinic Advisor calendar + guest book (website embed).
 * GET  ?module=dentalgraph|physiograph|medicalgraph|psychiatrygraph&token=
 * POST { module, token, action: 'book', appointment_id, name, email?, phone? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  buildClinicPublicCalendar,
} from '@/lib/services/clinic-public-calendar';
import {
  readDentalgraphFromMetadata,
  writeDentalgraphToMetadata,
  newId as dentalNewId,
  appointmentBookingCount as dentalBookingCount,
} from '@/lib/dental/dentalgraph';
import {
  readPhysiographFromMetadata,
  writePhysiographToMetadata,
  newId as physioNewId,
  appointmentBookingCount as physioBookingCount,
} from '@/lib/clinic/physiograph';
import {
  readMedicalgraphFromMetadata,
  writeMedicalgraphToMetadata,
  newId as medicalNewId,
  appointmentBookingCount as medicalBookingCount,
} from '@/lib/clinic/medicalgraph';
import {
  readPsychiatrygraphFromMetadata,
  writePsychiatrygraphToMetadata,
  newId as psychNewId,
  appointmentBookingCount as psychBookingCount,
} from '@/lib/clinic/psychiatrygraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MODULES = [
  'dentalgraph',
  'physiograph',
  'medicalgraph',
  'psychiatrygraph',
] as const;

type ModuleKey = (typeof MODULES)[number];

function isModule(m: string): m is ModuleKey {
  return (MODULES as readonly string[]).includes(m);
}

async function resolveClinic(module: ModuleKey, token: string) {
  const clean = token.trim();
  if (!clean || clean.length < 8) return null;
  const supabase = getSupabaseServer();
  const { data: rows } = await supabase
    .from('profiles')
    .select('id, metadata, company_name, name')
    .order('updated_at', { ascending: false })
    .limit(300);

  for (const row of rows || []) {
    const meta =
      row.metadata && typeof row.metadata === 'object'
        ? { ...(row.metadata as Record<string, unknown>) }
        : {};
    if (!meta[module]) continue;

    let store: {
      settings?: { public_token?: string; enabled?: boolean } | null;
    } | null = null;
    if (module === 'dentalgraph') store = readDentalgraphFromMetadata(meta);
    else if (module === 'physiograph') store = readPhysiographFromMetadata(meta);
    else if (module === 'medicalgraph')
      store = readMedicalgraphFromMetadata(meta);
    else store = readPsychiatrygraphFromMetadata(meta);

    if (store?.settings?.public_token === clean) {
      return {
        companyId: Number(row.id),
        meta,
        store,
        companyName: row.company_name || row.name,
      };
    }
  }
  return null;
}

async function saveModule(
  module: ModuleKey,
  companyId: number,
  meta: Record<string, unknown>,
  store: unknown
) {
  const supabase = getSupabaseServer();
  let next = meta;
  if (module === 'dentalgraph')
    next = writeDentalgraphToMetadata(meta, store as never);
  else if (module === 'physiograph')
    next = writePhysiographToMetadata(meta, store as never);
  else if (module === 'medicalgraph')
    next = writeMedicalgraphToMetadata(meta, store as never);
  else next = writePsychiatrygraphToMetadata(meta, store as never);
  await supabase
    .from('profiles')
    .update({ metadata: next, updated_at: new Date().toISOString() })
    .eq('id', companyId);
}

export async function GET(req: NextRequest) {
  const module = String(req.nextUrl.searchParams.get('module') || '');
  const token = String(req.nextUrl.searchParams.get('token') || '');
  if (!isModule(module) || !token) {
    return NextResponse.json(
      { error: 'module and token required' },
      { status: 400 }
    );
  }
  const resolved = await resolveClinic(module, token);
  if (!resolved) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const calendar = buildClinicPublicCalendar({
    module,
    store: resolved.store as never,
  });
  if (!resolved.store.settings?.enabled && !calendar.slots.length) {
    // still return calendar if enabled false but token valid — website may be draft
  }
  return NextResponse.json({
    success: true,
    calendar: {
      ...calendar,
      brand:
        calendar.brand ||
        String(resolved.companyName || 'Clinic'),
    },
  });
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit({
    key: `clinic-public-book:${ip}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const module = String(body.module || '');
  const token = String(body.token || '');
  if (!isModule(module) || !token) {
    return NextResponse.json(
      { error: 'module and token required' },
      { status: 400 }
    );
  }
  const action = String(body.action || 'book');
  const resolved = await resolveClinic(module, token);
  if (!resolved) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const store = resolved.store as {
    settings?: { allow_public_booking?: boolean };
    appointments: Array<{
      id: string;
      status: string;
      public?: boolean;
      service_id: string;
    }>;
    bookings: Array<{
      id: string;
      appointment_id: string;
      patient_id: string;
      status: string;
      booked_at: string;
      source?: string;
      notes?: string;
    }>;
    patients: Array<{
      id: string;
      code: string;
      name: string;
      email?: string;
      phone?: string;
      active?: boolean;
      created_at: string;
      updated_at: string;
      status?: string;
    }>;
  };

  if (action !== 'book') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  if (store.settings?.allow_public_booking === false) {
    return NextResponse.json(
      { error: 'Online booking is disabled' },
      { status: 403 }
    );
  }

  const appointmentId = String(body.appointment_id || '');
  const name = String(body.name || '').trim();
  const email = String(body.email || '')
    .toLowerCase()
    .trim();
  const phone = String(body.phone || '').trim();
  if (!appointmentId || !name) {
    return NextResponse.json(
      { error: 'appointment_id and name required' },
      { status: 400 }
    );
  }

  const appt = store.appointments.find((a) => a.id === appointmentId);
  if (!appt || appt.status !== 'scheduled' || appt.public !== true) {
    return NextResponse.json(
      { error: 'Slot not available' },
      { status: 400 }
    );
  }

  const countFn =
    module === 'dentalgraph'
      ? dentalBookingCount
      : module === 'physiograph'
        ? physioBookingCount
        : module === 'medicalgraph'
          ? medicalBookingCount
          : psychBookingCount;
  const newId =
    module === 'dentalgraph'
      ? dentalNewId
      : module === 'physiograph'
        ? physioNewId
        : module === 'medicalgraph'
          ? medicalNewId
          : psychNewId;

  const booked = countFn(store as never, appointmentId);
  const full = booked >= 1;
  const now = new Date().toISOString();

  let patient = email
    ? store.patients.find(
        (p) =>
          String(p.email || '')
            .toLowerCase()
            .trim() === email && p.active !== false
      )
    : undefined;

  if (!patient) {
    patient = {
      id: newId('pat'),
      code: `WEB-${Date.now().toString(36).toUpperCase().slice(-6)}`,
      name,
      email: email || undefined,
      phone: phone || undefined,
      status: 'active',
      active: true,
      created_at: now,
      updated_at: now,
    };
    store.patients.push(patient as never);
  } else {
    patient.name = name || patient.name;
    if (phone) patient.phone = phone;
    patient.updated_at = now;
  }

  const dup = store.bookings.find(
    (b) =>
      b.appointment_id === appointmentId &&
      b.patient_id === patient!.id &&
      b.status !== 'cancelled'
  );
  if (dup) {
    return NextResponse.json({
      success: true,
      status: dup.status,
      booking_id: dup.id,
      message: 'Already on this slot',
    });
  }

  const status = full ? 'waitlist' : 'booked';
  const booking = {
    id: newId('bk'),
    appointment_id: appointmentId,
    patient_id: patient.id,
    status,
    booked_at: now,
    source: 'website',
    notes: 'Public website / embed booking',
  };
  store.bookings.push(booking as never);
  await saveModule(module, resolved.companyId, resolved.meta, store);

  return NextResponse.json({
    success: true,
    status,
    booking_id: booking.id,
    message:
      status === 'waitlist'
        ? 'Added to waitlist — the practice will contact you'
        : 'Booked successfully',
  });
}
