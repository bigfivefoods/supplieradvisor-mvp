/**
 * Consented GP / clinic referrals — selected patient + referring-practice
 * details sent to another Advisor practice (physio, psychiatry, dental…).
 */
import { buildPatientMedicalShare } from '@/lib/clinic/medical-share';
import { readMedicalgraphFromMetadata } from '@/lib/clinic/medicalgraph';
import { readVetgraphFromMetadata } from '@/lib/clinic/vetgraph';
import { readPhysiographFromMetadata } from '@/lib/clinic/physiograph';
import { readPsychiatrygraphFromMetadata } from '@/lib/clinic/psychiatrygraph';
import { readDentalgraphFromMetadata } from '@/lib/dental/dentalgraph';
import { buildPatientVisitHistory } from '@/lib/clinic/visit-history';
import { healthSummaryLabel } from '@/lib/health/body-map';
import type { ClinicalShareScope } from '@/lib/services/advisor-b2c-relationship';
import {
  isAdvisorShareKind,
  type AdvisorShareKind,
  type ProfileShareSnapshot,
} from '@/lib/b2c/profile-share-types';

export const INBOUND_REFERRALS_KEY = 'inbound_practice_referrals';

export type PracticeReferralInbound = {
  id: string;
  from_company_id: number;
  from_company_name: string;
  from_kind: AdvisorShareKind;
  from_ref_id: string;
  to_kind: AdvisorShareKind;
  patient_name: string;
  scopes: ClinicalShareScope[];
  note?: string | null;
  status: 'active' | 'revoked';
  created_at: string;
  snapshot: ProfileShareSnapshot;
};

type SettingsLike = {
  brand_name?: string;
  contact_email?: string;
  contact_phone?: string;
  website_url?: string;
  practice_number?: string;
  marketplace?: { city?: string };
};

function clinicStore(kind: AdvisorShareKind, meta: Record<string, unknown>) {
  if (kind === 'physio') return readPhysiographFromMetadata(meta);
  if (kind === 'dental') return readDentalgraphFromMetadata(meta);
  if (kind === 'psychiatry') return readPsychiatrygraphFromMetadata(meta);
  if (kind === 'vet') return readVetgraphFromMetadata(meta);
  return readMedicalgraphFromMetadata(meta);
}

function clinicPeople(
  store: ReturnType<typeof clinicStore>
): Array<{ id: string; name: string }> {
  if ('staff' in store && Array.isArray(store.staff)) {
    return store.staff.map((p) => ({ id: p.id, name: p.name }));
  }
  if ('practitioners' in store && Array.isArray(store.practitioners)) {
    return store.practitioners.map((p) => ({ id: p.id, name: p.name }));
  }
  return [];
}

function clinicAppointmentsForHistory(store: ReturnType<typeof clinicStore>) {
  return (store.appointments || []).map((a) => {
    const staffId = 'staff_id' in a ? a.staff_id : null;
    const pracId = 'practitioner_id' in a ? a.practitioner_id : null;
    return {
      id: a.id,
      date: a.date,
      start_time: a.start_time,
      end_time: a.end_time,
      location: a.location,
      service_id: a.service_id,
      practitioner_id: pracId || staffId || null,
      status: a.status,
    };
  });
}

export function buildPracticeReferralSnapshot(opts: {
  companyName: string;
  kind: AdvisorShareKind;
  meta: Record<string, unknown>;
  patientId: string;
  scopes: ClinicalShareScope[];
  referralReason?: string | null;
  referringPractitionerName?: string | null;
}): ProfileShareSnapshot | null {
  const store = clinicStore(opts.kind, opts.meta);
  const patient = (store.patients || []).find((p) => p.id === opts.patientId);
  if (!patient) return null;
  const settings = (store.settings || {}) as SettingsLike;
  const set = new Set(opts.scopes);
  const all = set.has('full_chart');
  const brand = settings.brand_name || opts.companyName;

  const snapshot: ProfileShareSnapshot = {
    name: patient.name,
    email: patient.email,
    phone: patient.phone,
    brand,
    kind: opts.kind,
    captured_at: new Date().toISOString(),
    scopes: opts.scopes,
    referral_reason: opts.referralReason || null,
  };

  if (all || set.has('summary')) {
    snapshot.health =
      'clinical' in patient && patient.clinical
        ? healthSummaryLabel(patient.clinical)
        : undefined;
    snapshot.medical = buildPatientMedicalShare(patient);
  }
  if (all || set.has('practice_info')) {
    snapshot.practice = {
      brand,
      module: opts.kind,
      contact_email: settings.contact_email || null,
      contact_phone: settings.contact_phone || null,
      city: settings.marketplace?.city || null,
      website: settings.website_url || null,
      practice_number: settings.practice_number || null,
      referring_practitioner: opts.referringPractitionerName || null,
    };
  }
  if (all || set.has('visit_history') || set.has('clinical_notes')) {
    const history = buildPatientVisitHistory({
      patientId: patient.id,
      bookings: store.bookings,
      appointments: clinicAppointmentsForHistory(store),
      services: store.services,
      practitioners: clinicPeople(store),
      visitNotes: store.visit_notes,
      scripts:
        'medical' in patient ? patient.medical?.scripts : undefined,
      patientFacing: true,
    });
    snapshot.visits = history.slice(0, 20).map((v) => ({
      date: v.date,
      start_time: v.start_time,
      service_name: v.service_name,
      practitioner_name: v.practitioner_name,
      status: v.status,
      notes: v.notes[0]?.body,
    }));
  }
  return snapshot;
}

export function readInboundReferrals(meta: Record<string, unknown>): PracticeReferralInbound[] {
  const raw = meta[INBOUND_REFERRALS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is PracticeReferralInbound =>
      Boolean(r && typeof r === 'object' && (r as PracticeReferralInbound).id)
  );
}

export function writeInboundReferral(
  meta: Record<string, unknown>,
  row: PracticeReferralInbound
): Record<string, unknown> {
  const prev = readInboundReferrals(meta).filter((r) => r.id !== row.id);
  return {
    ...meta,
    [INBOUND_REFERRALS_KEY]: [row, ...prev].slice(0, 200),
  };
}

export function isClinicShareKind(v: unknown): v is AdvisorShareKind {
  return (
    isAdvisorShareKind(v) &&
    (v === 'medical' || v === 'physio' || v === 'dental' || v === 'psychiatry')
  );
}
