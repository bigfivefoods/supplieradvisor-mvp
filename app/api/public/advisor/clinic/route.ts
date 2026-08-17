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
} from '@/lib/dental/dentalgraph';
import {
  readPhysiographFromMetadata,
  writePhysiographToMetadata,
  newId as physioNewId,
} from '@/lib/clinic/physiograph';
import {
  readMedicalgraphFromMetadata,
  writeMedicalgraphToMetadata,
  newId as medicalNewId,
} from '@/lib/clinic/medicalgraph';
import {
  readPsychiatrygraphFromMetadata,
  writePsychiatrygraphToMetadata,
  newId as psychNewId,
} from '@/lib/clinic/psychiatrygraph';
import {
  isAdvisorPayoutReady,
  readAdvisorPayout,
} from '@/lib/billing/advisor-payout';

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

const CLINIC_TOKEN_RE: Record<ModuleKey, RegExp> = {
  physiograph: /^pg_(\d+)_/,
  dentalgraph: /^dg_(\d+)_/,
  medicalgraph: /^medg_(\d+)_/,
  psychiatrygraph: /^psyg_(\d+)_/,
};

function parseClinicCompanyId(module: ModuleKey, token: string): number | null {
  const m = CLINIC_TOKEN_RE[module].exec(token);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) ? id : null;
}

function storeFromMeta(
  module: ModuleKey,
  meta: Record<string, unknown>
): {
  settings?: { public_token?: string; enabled?: boolean } | null;
} | null {
  if (module === 'dentalgraph') return readDentalgraphFromMetadata(meta);
  if (module === 'physiograph') return readPhysiographFromMetadata(meta);
  if (module === 'medicalgraph') return readMedicalgraphFromMetadata(meta);
  return readPsychiatrygraphFromMetadata(meta);
}

async function resolveClinic(module: ModuleKey, token: string) {
  const clean = token.trim();
  if (!clean || clean.length < 8) return null;
  const supabase = getSupabaseServer();
  const parsed = parseClinicCompanyId(module, clean);
  if (parsed != null) {
    const { data: row } = await supabase
      .from('profiles')
      .select('id, metadata, trading_name, legal_name')
      .eq('id', parsed)
      .maybeSingle();
    if (row) {
      const meta =
        row.metadata && typeof row.metadata === 'object'
          ? { ...(row.metadata as Record<string, unknown>) }
          : {};
      const store = storeFromMeta(module, meta);
      if (store?.settings?.public_token === clean) {
        return {
          companyId: Number(row.id),
          meta,
          store,
          companyName: row.trading_name || row.legal_name || '',
        };
      }
    }
  }

  const { data: rows } = await supabase
    .from('profiles')
    .select('id, metadata, trading_name, legal_name')
    .order('updated_at', { ascending: false })
    .limit(400);

  for (const row of rows || []) {
    const meta =
      row.metadata && typeof row.metadata === 'object'
        ? { ...(row.metadata as Record<string, unknown>) }
        : {};
    if (!meta[module]) continue;
    const store = storeFromMeta(module, meta);
    if (store?.settings?.public_token === clean) {
      return {
        companyId: Number(row.id),
        meta,
        store,
        companyName: row.trading_name || row.legal_name || '',
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
    payout_ready: isAdvisorPayoutReady(readAdvisorPayout(resolved.meta)),
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

  const newId =
    module === 'dentalgraph'
      ? dentalNewId
      : module === 'physiograph'
        ? physioNewId
        : module === 'medicalgraph'
          ? medicalNewId
          : psychNewId;

  const now = new Date().toISOString();

  let patient = email
    ? store.patients.find(
        (p) =>
          String(p.email || '')
            .toLowerCase()
            .trim() === email && p.active !== false
      )
    : undefined;

  let createdPatient = false;
  if (!patient) {
    createdPatient = true;
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

  const { bookAdvisorMemberSlot, newDeskNotice, pushDeskNotice } = await import(
    '@/lib/services/advisor-member-calendar'
  );
  if (createdPatient) {
    const s = store as {
      desk_notices?: import('@/lib/services/advisor-member-calendar').DeskMemberNotice[];
    };
    s.desk_notices = pushDeskNotice(
      s.desk_notices,
      newDeskNotice({
        kind: 'member_joined',
        person_id: patient.id,
        person_name: patient.name,
        email: patient.email,
        phone: patient.phone,
        source: 'embed',
        note: 'New patient from the public booking page',
      })
    );
  }
  const bookedSlot = bookAdvisorMemberSlot({
    store: store as never,
    module,
    patientId: patient.id,
    slotId: appointmentId,
    newId,
    source: 'embed',
    now,
  });
  if (!bookedSlot.ok) {
    return NextResponse.json(
      { error: bookedSlot.error, code: bookedSlot.code },
      { status: bookedSlot.status }
    );
  }
  await saveModule(module, resolved.companyId, resolved.meta, bookedSlot.store);

  return NextResponse.json({
    success: true,
    status: bookedSlot.status,
    booking_id: bookedSlot.bookingId,
    message:
      bookedSlot.status === 'waitlist'
        ? 'Added to waitlist — the practice will contact you'
        : 'Booked successfully',
  });
}
