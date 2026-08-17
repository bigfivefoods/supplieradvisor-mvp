/**
 * Care feed for SA Member — bookings + shared medical summaries
 * from linked Advisor brands (medical, dental, physio, psychiatry, gym).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { readMedicalgraphFromMetadata } from '@/lib/clinic/medicalgraph';
import { readPhysiographFromMetadata } from '@/lib/clinic/physiograph';
import { readDentalgraphFromMetadata } from '@/lib/dental/dentalgraph';
import { readPsychiatrygraphFromMetadata } from '@/lib/clinic/psychiatrygraph';
import { readFitgraphFromMetadata } from '@/lib/fitness/fitgraph';
import { readHiregraphFromMetadata } from '@/lib/hire/hiregraph';
import { readRetailgraphFromMetadata } from '@/lib/retail/retailgraph';
import { buildPatientMedicalShare } from '@/lib/clinic/medical-share';
import type { B2cMembership } from '@/lib/b2c/types';
import type {
  B2cCareAnnouncement,
  B2cCareBooking,
  B2cCareClinic,
  B2cCareRecord,
} from '@/lib/b2c/care-types';
import { publishedAnnouncements } from '@/lib/services/member-announcements';

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
    const bookHref = `${mem.portal_path}${q}tab=open`;
    const careHref = `${mem.portal_path}${q}tab=profile`;
    const classesHref = `${mem.portal_path}${q}tab=mine`;
    const progressHref = `${mem.portal_path}${q}tab=progress`;
    const isClinic = ['physio', 'dental', 'medical', 'psychiatry'].includes(
      mem.kind
    );
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
    const { data } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', mem.company_id)
      .maybeSingle();
    const meta =
      data?.metadata && typeof data.metadata === 'object'
        ? (data.metadata as Record<string, unknown>)
        : {};

    if (mem.kind === 'gym') {
      const store = readFitgraphFromMetadata(meta);
      const client = store.clients.find((c) => c.id === mem.ref_id);
      if (!client) continue;
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
        if (!ses || ses.date < today) continue;
        const ct = store.class_types.find((t) => t.id === ses.class_type_id);
        bookings.push({
          id: b.id,
          kind: 'gym',
          brand,
          title: ct?.name || 'Class',
          when: `${ses.date} ${ses.start_time || ''}`.trim(),
          status: String(b.status),
          href: `${mem.portal_path}${mem.portal_path.includes('?') ? '&' : '?'}tab=mine`,
        });
      }
      continue;
    }

    if (mem.kind === 'hire') {
      const store = readHiregraphFromMetadata(meta);
      for (const a of publishedAnnouncements(store.announcements, 4)) {
        announcements.push({
          id: a.id,
          kind: 'hire',
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

    if (mem.kind === 'retail') {
      const store = readRetailgraphFromMetadata(meta);
      for (const a of publishedAnnouncements(store.announcements, 4)) {
        announcements.push({
          id: a.id,
          kind: 'retail',
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

    if (!['physio', 'dental', 'medical', 'psychiatry'].includes(mem.kind)) {
      continue;
    }

    const store =
      mem.kind === 'physio'
        ? readPhysiographFromMetadata(meta)
        : mem.kind === 'dental'
          ? readDentalgraphFromMetadata(meta)
          : mem.kind === 'medical'
            ? readMedicalgraphFromMetadata(meta)
            : readPsychiatrygraphFromMetadata(meta);
    const patient = (store.patients || []).find((p) => p.id === mem.ref_id);
    if (!patient) continue;

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
    if (share) {
      records.push({
        kind: mem.kind,
        brand,
        href: careHref,
        summary: share,
      });
    }

    for (const b of store.bookings || []) {
      if (b.patient_id !== patient.id || b.status === 'cancelled') continue;
      const appt = store.appointments.find((a) => a.id === b.appointment_id);
      if (!appt || appt.date < today) continue;
      const svc = store.services.find((s) => s.id === appt.service_id);
      bookings.push({
        id: b.id,
        kind: mem.kind,
        brand,
        title: svc?.name || 'Appointment',
        when: `${appt.date} ${appt.start_time || ''}`.trim(),
        status: String(b.status),
        href: bookHref,
      });
    }
  }

  bookings.sort((a, b) => a.when.localeCompare(b.when));
  announcements.sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
  return {
    bookings: bookings.slice(0, 20),
    records,
    clinics,
    announcements: announcements.slice(0, 8),
  };
}
