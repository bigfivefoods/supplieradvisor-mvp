import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  appointmentBookingCount,
  appointmentsInRange,
  defaultPublicSettings,
  ensurePublicToken,
  newId,
  readPhysiographFromMetadata,
  seedDemoPhysiograph,
  summarisePhysiograph,
  writePhysiographToMetadata,
  type PhysioAppointment,
  type PhysioBooking,
  type PhysioPackage,
  type PhysioPatient,
  type PhysioPractitioner,
  type PhysioPublicSettings,
  type PhysioService,
  type PhysiographStore,
} from '@/lib/clinic/physiograph';

export const runtime = 'nodejs';

type Entity =
  | 'practitioners'
  | 'patients'
  | 'services'
  | 'packages'
  | 'appointments'
  | 'bookings';

async function loadStore(companyId: number) {
  const supabase = getSupabaseServer();
  const { data: prof } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', companyId)
    .maybeSingle();
  const meta =
    prof?.metadata && typeof prof.metadata === 'object'
      ? { ...(prof.metadata as Record<string, unknown>) }
      : {};
  return { meta, store: readPhysiographFromMetadata(meta) };
}

async function saveStore(
  companyId: number,
  meta: Record<string, unknown>,
  store: PhysiographStore
) {
  const supabase = getSupabaseServer();
  const nextMeta = writePhysiographToMetadata(meta, store);
  const { error } = await supabase
    .from('profiles')
    .update({
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId);
  if (error) throw new Error(error.message);
}

function analysis(store: PhysiographStore) {
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  return {
    weekAppointments: appointmentsInRange(
      store,
      today,
      weekEnd.toISOString().slice(0, 10)
    ).map((a) => ({
      ...a,
      booked: appointmentBookingCount(store, a.id),
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const { store } = await loadStore(companyId);
    return NextResponse.json({
      success: true,
      store,
      summary: summarisePhysiograph(store),
      analysis: analysis(store),
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
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const action = String(body.action || 'upsert');
    const entity = String(body.entity || '') as Entity;
    const { meta, store } = await loadStore(companyId);
    const now = new Date().toISOString();

    if (action === 'seed_demo') {
      const demo = seedDemoPhysiograph(now, companyId);
      await saveStore(companyId, meta, demo);
      return NextResponse.json({
        success: true,
        store: demo,
        summary: summarisePhysiograph(demo),
        analysis: analysis(demo),
        message: 'Demo clinic loaded',
      });
    }

    if (action === 'update_settings') {
      const patch = (body.settings || body.record || {}) as Partial<PhysioPublicSettings>;
      store.settings = ensurePublicToken(
        {
          ...defaultPublicSettings(companyId),
          ...(store.settings || {}),
          ...patch,
        },
        companyId
      );
      if (body.rotate_token === true) {
        store.settings.public_token = `pg_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      }
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summarisePhysiograph(store),
        analysis: analysis(store),
        message: 'Website / clinic settings updated',
      });
    }

    if (action === 'delete') {
      const id = String(body.id || '');
      if (!id || !entity) {
        return NextResponse.json(
          { error: 'entity and id required' },
          { status: 400 }
        );
      }
      const list = store[entity] as Array<{ id: string }> | undefined;
      if (!Array.isArray(list)) {
        return NextResponse.json({ error: 'Unknown entity' }, { status: 400 });
      }
      (store as Record<string, unknown>)[entity] = list.filter((r) => r.id !== id);
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summarisePhysiograph(store),
        analysis: analysis(store),
      });
    }

    if (action === 'upsert' || action === 'create' || action === 'update') {
      const rec = (body.record || body) as Record<string, unknown>;
      upsert(store, entity, rec, now);
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summarisePhysiograph(store),
        analysis: analysis(store),
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    console.error('[physiograph]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

function upsert(
  store: PhysiographStore,
  entity: Entity,
  rec: Record<string, unknown>,
  now: string
) {
  if (entity === 'practitioners') {
    const id = String(rec.id || newId('prac'));
    const i = store.practitioners.findIndex((p) => p.id === id);
    const prev = i >= 0 ? store.practitioners[i] : null;
    const row: PhysioPractitioner = {
      id,
      code: String(rec.code || prev?.code || `PR-${store.practitioners.length + 1}`),
      name: String(rec.name || prev?.name || 'Practitioner'),
      email: rec.email != null ? String(rec.email) : prev?.email,
      phone: rec.phone != null ? String(rec.phone) : prev?.phone,
      disciplines: Array.isArray(rec.disciplines)
        ? (rec.disciplines as string[])
        : prev?.disciplines || [],
      bio: rec.bio != null ? String(rec.bio) : prev?.bio,
      public_bio:
        rec.public_bio != null ? String(rec.public_bio) : prev?.public_bio,
      photo_url:
        rec.photo_url != null ? String(rec.photo_url) : prev?.photo_url,
      rate_zar:
        rec.rate_zar !== undefined
          ? rec.rate_zar === null || rec.rate_zar === ''
            ? null
            : Number(rec.rate_zar)
          : prev?.rate_zar ?? null,
      rate_basis:
        rec.rate_basis != null ? String(rec.rate_basis) : prev?.rate_basis,
      start_date:
        rec.start_date != null
          ? String(rec.start_date).slice(0, 10)
          : prev?.start_date || now.slice(0, 10),
      end_date:
        rec.end_date !== undefined
          ? rec.end_date
            ? String(rec.end_date).slice(0, 10)
            : null
          : prev?.end_date ?? null,
      portal_token:
        rec.portal_token !== undefined
          ? rec.portal_token
            ? String(rec.portal_token)
            : null
          : prev?.portal_token ?? null,
      active: rec.active !== undefined ? rec.active !== false : prev?.active !== false,
      created_at: prev?.created_at || now,
    };
    if (i >= 0) store.practitioners[i] = row;
    else store.practitioners.push(row);
  } else if (entity === 'patients') {
    const id = String(rec.id || newId('pat'));
    const i = store.patients.findIndex((p) => p.id === id);
    const prev = i >= 0 ? store.patients[i] : null;
    const row: PhysioPatient = {
      id,
      code: String(rec.code || prev?.code || `P-${store.patients.length + 1}`),
      name: String(rec.name || prev?.name || 'Patient'),
      email: rec.email != null ? String(rec.email) : prev?.email,
      phone: rec.phone != null ? String(rec.phone) : prev?.phone,
      status: String(rec.membership_status || rec.status || prev?.status || 'active'),
      practitioner_id:
        rec.practitioner_id != null
          ? String(rec.practitioner_id) || null
          : prev?.practitioner_id ?? null,
      package_id:
        rec.package_id != null
          ? String(rec.package_id) || null
          : prev?.package_id ?? null,
      diagnosis_notes:
        rec.diagnosis_notes != null
          ? String(rec.diagnosis_notes)
          : prev?.diagnosis_notes,
      emergency_contact:
        rec.emergency_contact != null
          ? String(rec.emergency_contact)
          : prev?.emergency_contact,
      start_date:
        rec.start_date != null
          ? String(rec.start_date).slice(0, 10)
          : prev?.start_date || now.slice(0, 10),
      active: rec.active !== undefined ? rec.active !== false : prev?.active !== false,
      created_at: prev?.created_at || now,
      updated_at: now,
    };
    if (i >= 0) store.patients[i] = row;
    else store.patients.push(row);
  } else if (entity === 'services') {
    const id = String(rec.id || newId('svc'));
    const i = store.services.findIndex((s) => s.id === id);
    const prev = i >= 0 ? store.services[i] : null;
    const row: PhysioService = {
      id,
      code: String(rec.code || prev?.code || `S-${store.services.length + 1}`),
      name: String(rec.name || prev?.name || 'Service'),
      default_duration_min:
        rec.default_duration_min != null
          ? Number(rec.default_duration_min)
          : prev?.default_duration_min ?? 45,
      price_zar:
        rec.price_zar != null ? Number(rec.price_zar) : prev?.price_zar ?? 0,
      description:
        rec.description != null ? String(rec.description) : prev?.description,
      active: rec.active !== undefined ? rec.active !== false : prev?.active !== false,
      created_at: prev?.created_at || now,
    };
    if (i >= 0) store.services[i] = row;
    else store.services.push(row);
  } else if (entity === 'packages') {
    const id = String(rec.id || newId('pkg'));
    const i = store.packages.findIndex((p) => p.id === id);
    const prev = i >= 0 ? store.packages[i] : null;
    const row: PhysioPackage = {
      id,
      code: String(rec.code || prev?.code || `PK-${store.packages.length + 1}`),
      name: String(rec.name || prev?.name || 'Package'),
      sessions_total:
        rec.sessions_total != null
          ? Number(rec.sessions_total)
          : prev?.sessions_total ?? 6,
      price_zar:
        rec.price_zar != null ? Number(rec.price_zar) : prev?.price_zar ?? 0,
      description:
        rec.description != null ? String(rec.description) : prev?.description,
      active: rec.active !== undefined ? rec.active !== false : prev?.active !== false,
      created_at: prev?.created_at || now,
    };
    if (i >= 0) store.packages[i] = row;
    else store.packages.push(row);
  } else if (entity === 'appointments') {
    const id = String(rec.id || newId('apt'));
    const i = store.appointments.findIndex((a) => a.id === id);
    const prev = i >= 0 ? store.appointments[i] : null;
    const row: PhysioAppointment = {
      id,
      service_id: String(rec.service_id || prev?.service_id || ''),
      practitioner_id:
        rec.practitioner_id != null
          ? String(rec.practitioner_id) || null
          : prev?.practitioner_id ?? null,
      date: String(rec.date || prev?.date || now.slice(0, 10)).slice(0, 10),
      start_time: String(rec.start_time || prev?.start_time || '09:00'),
      end_time:
        rec.end_time != null ? String(rec.end_time) : prev?.end_time ?? null,
      duration_min:
        rec.duration_min != null
          ? Number(rec.duration_min)
          : prev?.duration_min ?? 45,
      location: rec.location != null ? String(rec.location) : prev?.location,
      status: (rec.status as PhysioAppointment['status']) || prev?.status || 'scheduled',
      public: rec.public !== undefined ? rec.public === true : prev?.public === true,
      notes: rec.notes != null ? String(rec.notes) : prev?.notes,
      public_notes:
        rec.public_notes != null ? String(rec.public_notes) : prev?.public_notes,
      created_at: prev?.created_at || now,
    };
    if (i >= 0) store.appointments[i] = row;
    else store.appointments.push(row);
  } else if (entity === 'bookings') {
    const id = String(rec.id || newId('bkg'));
    const i = store.bookings.findIndex((b) => b.id === id);
    const prev = i >= 0 ? store.bookings[i] : null;
    const row: PhysioBooking = {
      id,
      appointment_id: String(
        rec.appointment_id || prev?.appointment_id || ''
      ),
      patient_id: String(rec.patient_id || prev?.patient_id || ''),
      status: (rec.status as PhysioBooking['status']) || prev?.status || 'booked',
      booked_at: prev?.booked_at || now,
      source: rec.source != null ? String(rec.source) : prev?.source || 'desk',
      notes: rec.notes != null ? String(rec.notes) : prev?.notes,
    };
    if (i >= 0) store.bookings[i] = row;
    else store.bookings.push(row);
  }
}
