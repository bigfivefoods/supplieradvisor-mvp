/**
 * Care feed for SA Member — bookings + shared medical summaries
 * from linked Advisor brands (medical, dental, physio, psychiatry, gym).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  isStaleModuleStoreError,
  loadAdvisorModuleStore,
  saveAdvisorModuleStore,
} from '@/lib/business/company-data';
import {
  readMedicalgraphFromMetadata,
  writeMedicalgraphToMetadata,
} from '@/lib/clinic/medicalgraph';
import {
  readPhysiographFromMetadata,
  writePhysiographToMetadata,
} from '@/lib/clinic/physiograph';
import {
  readDentalgraphFromMetadata,
  writeDentalgraphToMetadata,
} from '@/lib/dental/dentalgraph';
import {
  readPsychiatrygraphFromMetadata,
  writePsychiatrygraphToMetadata,
} from '@/lib/clinic/psychiatrygraph';
import {
  readVetgraphFromMetadata,
  writeVetgraphToMetadata,
} from '@/lib/clinic/vetgraph';
import {
  readFitgraphFromMetadata,
} from '@/lib/fitness/fitgraph';
import { saveFitgraphPatch } from '@/lib/fitness/fitgraph-io';
import { readHiregraphFromMetadata } from '@/lib/hire/hiregraph';
import { readRetailgraphFromMetadata } from '@/lib/retail/retailgraph';
import { buildPatientMedicalShare } from '@/lib/clinic/medical-share';
import {
  followUpsAsAdvice,
  patientFacingFollowUps,
} from '@/lib/clinic/patient-follow-up';
import type { B2cMembership } from '@/lib/b2c/types';
import type {
  B2cCareAnnouncement,
  B2cCareBooking,
  B2cCareClinic,
  B2cCareRecord,
} from '@/lib/b2c/care-types';
import { publishedAnnouncements } from '@/lib/services/member-announcements';
import {
  buildPublicFeedbackPath,
  ensureClientRatingTokens,
} from '@/lib/services/booking-feedback';
function isClinicKindHref(kind: string) {
  return ['physio', 'dental', 'medical', 'psychiatry', 'vet'].includes(kind);
}

function daysAgoIso(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type ClinicCareKey =
  | 'physiograph'
  | 'dentalgraph'
  | 'medicalgraph'
  | 'psychiatrygraph'
  | 'vetgraph';

type ClinicCareStore = {
  patients: Array<{
    id: string;
    follow_ups?: Parameters<typeof followUpsAsAdvice>[0];
    share_medical?: boolean;
  }>;
  bookings: Array<{
    id: string;
    patient_id: string;
    appointment_id: string;
    status?: string;
    feedback_token?: string | null;
    feedback_submitted_at?: string | null;
  }>;
  appointments: Array<{
    id: string;
    date: string;
    start_time?: string;
    status?: string;
    service_id?: string | null;
  }>;
  services: Array<{ id: string; name: string }>;
  announcements?: Parameters<typeof publishedAnnouncements>[0];
  visit_notes?: Array<{
    person_id: string;
    private?: boolean;
    appointment_id?: string | null;
    booking_id?: string | null;
    body?: string | null;
  }>;
};

type GymCareStore = ReturnType<typeof readFitgraphFromMetadata>;
const READ_ONLY_CARE_COMPANY_ID = 102;

async function loadClinicCareStore(
  companyId: number,
  kind: string
): Promise<{ clinicKey: ClinicCareKey; store: ClinicCareStore } | null> {
  if (kind === 'physio') {
    const { store } = await loadAdvisorModuleStore(
      companyId,
      'physiograph',
      (meta: Record<string, unknown>) => readPhysiographFromMetadata(meta)
    );
    return { clinicKey: 'physiograph', store: store as ClinicCareStore };
  }
  if (kind === 'dental') {
    const { store } = await loadAdvisorModuleStore(
      companyId,
      'dentalgraph',
      (meta: Record<string, unknown>) => readDentalgraphFromMetadata(meta)
    );
    return { clinicKey: 'dentalgraph', store: store as ClinicCareStore };
  }
  if (kind === 'medical') {
    const { store } = await loadAdvisorModuleStore(
      companyId,
      'medicalgraph',
      (meta: Record<string, unknown>) => readMedicalgraphFromMetadata(meta)
    );
    return { clinicKey: 'medicalgraph', store: store as ClinicCareStore };
  }
  if (kind === 'psychiatry') {
    const { store } = await loadAdvisorModuleStore(
      companyId,
      'psychiatrygraph',
      (meta: Record<string, unknown>) => readPsychiatrygraphFromMetadata(meta)
    );
    return { clinicKey: 'psychiatrygraph', store: store as ClinicCareStore };
  }
  if (kind === 'vet') {
    const { store } = await loadAdvisorModuleStore(
      companyId,
      'vetgraph',
      (meta: Record<string, unknown>) => readVetgraphFromMetadata(meta)
    );
    return { clinicKey: 'vetgraph', store: store as ClinicCareStore };
  }
  return null;
}

function writeClinicCareStore(
  clinicKey: ClinicCareKey,
  store: ClinicCareStore
): Record<string, unknown> {
  if (clinicKey === 'physiograph') {
    return writePhysiographToMetadata({}, store as never);
  }
  if (clinicKey === 'dentalgraph') {
    return writeDentalgraphToMetadata({}, store as never);
  }
  if (clinicKey === 'medicalgraph') {
    return writeMedicalgraphToMetadata({}, store as never);
  }
  if (clinicKey === 'vetgraph') {
    return writeVetgraphToMetadata({}, store as never);
  }
  return writePsychiatrygraphToMetadata({}, store as never);
}

function gymCareSlot(store: GymCareStore, booking: GymCareStore['bookings'][number]) {
  const session = store.sessions.find((row) => row.id === booking.session_id);
  return session ? { date: session.date, start_time: session.start_time } : null;
}

function gymCareUpdatedAt(store: GymCareStore): string | null {
  return typeof store.updated_at === 'string' && store.updated_at.trim()
    ? store.updated_at.trim()
    : null;
}

async function saveGymCareBookingsPatch(
  companyId: number,
  store: GymCareStore
): Promise<GymCareStore> {
  try {
    const updatedAt = await saveFitgraphPatch(
      companyId,
      { bookings: store.bookings },
      { ifUpdatedAt: gymCareUpdatedAt(store) }
    );
    store.updated_at = updatedAt;
    return store;
  } catch (error) {
    if (!isStaleModuleStoreError(error)) throw error;
  }

  const { store: latest } = await loadAdvisorModuleStore(
    companyId,
    'fitgraph',
    readFitgraphFromMetadata,
    [],
    { fresh: true }
  );
  const dirty = ensureClientRatingTokens(latest.bookings, (booking) =>
    gymCareSlot(latest, booking)
  );
  if (!dirty) return latest;

  try {
    const updatedAt = await saveFitgraphPatch(
      companyId,
      { bookings: latest.bookings },
      { ifUpdatedAt: gymCareUpdatedAt(latest) }
    );
    latest.updated_at = updatedAt;
    return latest;
  } catch (error) {
    if (!isStaleModuleStoreError(error)) throw error;
    const { store: freshest } = await loadAdvisorModuleStore(
      companyId,
      'fitgraph',
      readFitgraphFromMetadata,
      [],
      { fresh: true }
    );
    return freshest;
  }
}

export type { B2cCareAnnouncement, B2cCareBooking, B2cCareClinic, B2cCareRecord };

export async function buildB2cCare(memberships: B2cMembership[]): Promise<{
  bookings: B2cCareBooking[];
  records: B2cCareRecord[];
  clinics: B2cCareClinic[];
  announcements: B2cCareAnnouncement[];
}> {
  const bookings: B2cCareBooking[] = [];
  const records: B2cCareRecord[] = [];
  const clinics: B2cCareClinic[] = [];
  const announcements: B2cCareAnnouncement[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const supabase = getSupabaseServer();

  for (const mem of memberships.filter((m) => m.active !== false)) {
    const brand = mem.brand || mem.company_name;
    const q = mem.portal_path.includes('?') ? '&' : '?';
    const bookHref = isClinicKindHref(mem.kind)
      ? `/me?tab=book&company=${mem.company_id}&kind=${encodeURIComponent(mem.kind)}`
      : `${mem.portal_path}${q}tab=open`;
    const careHref = `${mem.portal_path}${q}tab=profile`;
    const classesHref = `${mem.portal_path}${q}tab=mine`;
    const progressHref = `${mem.portal_path}${q}tab=progress`;
    const isClinic = isClinicKindHref(mem.kind);
    const isGym = mem.kind === 'gym';
    if (isClinic || isGym) {
      clinics.push({
        kind: mem.kind,
        brand,
        bookHref,
        careHref: isClinic ? careHref : progressHref,
        hasRecords: isClinic,
        classesHref: isGym ? classesHref : undefined,
        progressHref: isGym ? progressHref : undefined,
      });
    }
    if (mem.kind === 'gym') {
      const companyId = Number(mem.company_id);
      const [{ store: loadedStore }, fitgraphRow] = await Promise.all([
        loadAdvisorModuleStore(companyId, 'fitgraph', readFitgraphFromMetadata),
        supabase
          .from('company_module_stores')
          .select('updated_at')
          .eq('company_id', companyId)
          .eq('module', 'fitgraph')
          .maybeSingle(),
      ]);
      let store = loadedStore;
      let client = store.clients.find((c) => c.id === mem.ref_id);
      if (!client) continue;
      const hasLiveFitgraphStore = !fitgraphRow.error && Boolean(fitgraphRow.data?.updated_at);
      if (companyId !== READ_ONLY_CARE_COMPANY_ID && hasLiveFitgraphStore) {
        const gymDirty = ensureClientRatingTokens(store.bookings, (booking) =>
          gymCareSlot(store, booking)
        );
        if (gymDirty) {
          store = await saveGymCareBookingsPatch(companyId, store);
          client = store.clients.find((c) => c.id === mem.ref_id);
          if (!client) continue;
        }
      }
      for (const a of publishedAnnouncements(store.announcements, 4)) {
        announcements.push({
          id: a.id,
          kind: 'gym',
          brand,
          title: a.title,
          body: a.body,
          href: mem.portal_path,
          pinned: a.pinned,
          cta_label: a.cta_label,
          cta_href: a.cta_href,
        });
      }
      for (const b of store.bookings || []) {
        if (b.client_id !== client.id) continue;
        if (!['booked', 'waitlist', 'attended'].includes(String(b.status))) {
          continue;
        }
        const ses = store.sessions.find((s) => s.id === b.session_id);
        if (!ses) continue;
        const past = ses.date < today || b.status === 'attended';
        if (past && ses.date < daysAgoIso(today, -21)) continue;
        const ct = store.class_types.find((t) => t.id === ses.class_type_id);
        bookings.push({
          id: b.id,
          kind: 'gym',
          brand,
          title: ct?.name || 'Class',
          when: `${ses.date} ${ses.start_time || ''}`.trim(),
          status: String(b.status),
          href: `${mem.portal_path}${mem.portal_path.includes('?') ? '&' : '?'}tab=mine`,
          past,
          feedback_href:
            b.feedback_token && !b.feedback_submitted_at
              ? buildPublicFeedbackPath(
                  'fitgraph',
                  Number(mem.company_id),
                  b.feedback_token
                )
              : null,
          feedback_done: Boolean(b.feedback_submitted_at),
        });
      }
      continue;
    }

    if (!isClinicKindHref(mem.kind) && mem.kind !== 'hire' && mem.kind !== 'retail') {
      continue;
    }

    if (mem.kind === 'hire' || mem.kind === 'retail') {
      const { data } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('id', mem.company_id)
        .maybeSingle();
      const meta =
        data?.metadata && typeof data.metadata === 'object'
          ? (data.metadata as Record<string, unknown>)
          : {};

      const store =
        mem.kind === 'hire'
          ? readHiregraphFromMetadata(meta)
          : readRetailgraphFromMetadata(meta);
      for (const a of publishedAnnouncements(store.announcements, 4)) {
        announcements.push({
          id: a.id,
          kind: mem.kind,
          brand,
          title: a.title,
          body: a.body,
          href: mem.portal_path,
          pinned: a.pinned,
          cta_label: a.cta_label,
          cta_href: a.cta_href,
        });
      }
      continue;
    }

    const loadedClinic = await loadClinicCareStore(Number(mem.company_id), mem.kind);
    if (!loadedClinic) continue;
    const { clinicKey, store } = loadedClinic;
    const patient = (store.patients || []).find((p) => p.id === mem.ref_id);
    if (!patient) continue;
    const clinicDirty = ensureClientRatingTokens(store.bookings, (b) => {
      const a = store.appointments.find((x) => x.id === b.appointment_id);
      return a ? { date: a.date, start_time: a.start_time } : null;
    });
    if (clinicDirty) {
      await saveAdvisorModuleStore(
        Number(mem.company_id),
        clinicKey,
        store,
        (_meta, next) => writeClinicCareStore(clinicKey, next)
      );
    }

    for (const a of publishedAnnouncements(store.announcements, 4)) {
      announcements.push({
        id: a.id,
        kind: mem.kind,
        brand,
        title: a.title,
        body: a.body,
        href: mem.portal_path,
        pinned: a.pinned,
        cta_label: a.cta_label,
        cta_href: a.cta_href,
      });
    }

    const share = buildPatientMedicalShare(patient);
    const advice = followUpsAsAdvice(patient.follow_ups);
    const followUps = patientFacingFollowUps(patient.follow_ups);
    if (share || advice.length || followUps.length) {
      records.push({
        kind: mem.kind,
        brand,
        href: careHref,
        summary: share || {},
        advice: advice.map((a) => ({
          id: a.id,
          body: a.body,
          at: a.at,
        })),
        follow_ups: followUps.map((f) => ({
          id: f.id,
          remind_on: f.remind_on,
          title: f.title,
          advice: f.advice,
          status: f.status,
        })),
      });
    }

    for (const b of store.bookings || []) {
      if (b.patient_id !== patient.id || b.status === 'cancelled') continue;
      const appt = store.appointments.find((a) => a.id === b.appointment_id);
      if (!appt || appt.status === 'cancelled') continue;
      const svc = store.services.find((s) => s.id === appt.service_id);
      const past = appt.date < today || b.status === 'attended' || b.status === 'no_show';
      const note = (store.visit_notes || []).find(
        (n) =>
          n.person_id === patient.id &&
          n.private !== true &&
          (n.appointment_id === appt.id || n.booking_id === b.id)
      );
      bookings.push({
        id: b.id,
        kind: mem.kind,
        brand,
        title: svc?.name || 'Appointment',
        when: `${appt.date} ${appt.start_time || ''}`.trim(),
        status: String(b.status),
        href: `${mem.portal_path}${mem.portal_path.includes('?') ? '&' : '?'}tab=${past ? 'history' : 'mine'}`,
        past,
        notes: note?.body || undefined,
        feedback_href:
          b.feedback_token && !b.feedback_submitted_at
            ? buildPublicFeedbackPath(
                clinicKey,
                Number(mem.company_id),
                b.feedback_token
              )
            : null,
        feedback_done: Boolean(b.feedback_submitted_at),
      });
    }
  }

  bookings.sort((a, b) => {
    if (Boolean(a.past) !== Boolean(b.past)) return a.past ? 1 : -1;
    return b.when.localeCompare(a.when);
  });
  announcements.sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
  return {
    bookings: bookings.slice(0, 30),
    records,
    clinics,
    announcements: announcements.slice(0, 8),
  };
}
