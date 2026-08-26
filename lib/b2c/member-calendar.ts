/**
 * Combined SA Member diary — hire, gym classes, clinic visits.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  bookingStatusLabel,
  readHiregraphFromMetadata,
} from '@/lib/hire/hiregraph';
import { readFitgraphFromMetadata } from '@/lib/fitness/fitgraph';
import { memberAllocatedUpcomingSessions } from '@/lib/fitness/class-allocate';
import { loadWalletCompany } from '@/lib/b2c/load-company';
import { readPhysiographFromMetadata } from '@/lib/clinic/physiograph';
import { readDentalgraphFromMetadata } from '@/lib/dental/dentalgraph';
import { readMedicalgraphFromMetadata } from '@/lib/clinic/medicalgraph';
import { readPsychiatrygraphFromMetadata } from '@/lib/clinic/psychiatrygraph';
import { readVetgraphFromMetadata } from '@/lib/clinic/vetgraph';
import type { B2cMembership } from '@/lib/b2c/types';
import type { CalendarLinkEvent } from '@/lib/b2c/calendar-links';

export type MemberCalendarEvent = CalendarLinkEvent & {
  source: 'hire' | 'gym' | 'clinic';
  brand: string;
  status?: string;
};

export async function buildMemberCalendar(
  memberships: B2cMembership[]
): Promise<MemberCalendarEvent[]> {
  const events: MemberCalendarEvent[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 90);
  const until = horizon.toISOString().slice(0, 10);
  const historyStart = new Date();
  historyStart.setMonth(historyStart.getMonth() - 18);
  const historyFrom = historyStart.toISOString().slice(0, 10);
  const cache = new Map<number, Record<string, unknown>>();

  async function meta(companyId: number) {
    if (cache.has(companyId)) return cache.get(companyId)!;
    const company = await loadWalletCompany(companyId);
    if (company?.meta) {
      cache.set(companyId, company.meta);
      return company.meta;
    }
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', companyId)
      .maybeSingle();
    const m =
      data?.metadata && typeof data.metadata === 'object'
        ? (data.metadata as Record<string, unknown>)
        : {};
    cache.set(companyId, m);
    return m;
  }

  for (const mem of memberships.filter((m) => m.active !== false)) {
    const brand = mem.brand || mem.company_name;
    try {
      const raw = await meta(mem.company_id);

      if (mem.kind === 'hire') {
        const store = readHiregraphFromMetadata(raw);
        const crmId = Number(mem.ref_id);
        for (const b of store.bookings || []) {
          if (Number(b.crm_customer_id || b.customer_id) !== crmId) continue;
          const st = String(b.status || '');
          if (st === 'cancelled') continue;
          const start = String(b.start_date || '').slice(0, 10);
          const end = String(b.end_date || start).slice(0, 10);
          if (!start || start > until) continue;
          const from = new Date();
          from.setDate(from.getDate() - 21);
          if (end < from.toISOString().slice(0, 10)) continue;
          const item = store.items.find((i) => i.id === b.item_id);
          const how =
            item?.fulfillment === 'delivery'
              ? 'Delivered to you.'
              : item?.fulfillment === 'both'
                ? 'Collect or delivery as arranged.'
                : 'Collect from the hire desk.';
          events.push({
            id: `hire-${b.id}`,
            source: 'hire',
            brand,
            title: b.item_title || item?.title || 'Hire',
            date: start,
            end_date: end,
            all_day: true,
            location: b.delivery_address || item?.location || brand,
            href: mem.portal_path,
            status: bookingStatusLabel(st),
            description: `${brand} · ${bookingStatusLabel(st)}. ${how}${
              item?.collect_hours ? ` Hours: ${item.collect_hours}.` : ''
            }`,
          });
        }
      }

      if (mem.kind === 'gym') {
        const store = readFitgraphFromMetadata(raw);
        const client = store.clients.find((c) => c.id === mem.ref_id);
        if (client) {
          const seen = new Set<string>();
          for (const b of store.bookings || []) {
            if (b.client_id !== client.id) continue;
            if (
              b.status !== 'booked' &&
              b.status !== 'waitlist' &&
              b.status !== 'attended'
            ) {
              continue;
            }
            const ses = store.sessions.find((s) => s.id === b.session_id);
            if (!ses || ses.status === 'cancelled') continue;
            if (ses.date < today || ses.date > until) continue;
            const ct = store.class_types.find((t) => t.id === ses.class_type_id);
            const start = String(ses.start_time || '09:00').slice(0, 5);
            const dur = Number(ses.duration_min) || 45;
            const [hh, mm] = start.split(':').map(Number);
            const endMin = (hh || 0) * 60 + (mm || 0) + dur;
            const end = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
            seen.add(ses.id);
            events.push({
              id: `gym-${b.id}`,
              source: 'gym',
              brand,
              title: ct?.name || 'Class',
              date: ses.date,
              start_time: start,
              end_time: ses.end_time?.slice(0, 5) || end,
              location: ses.location || brand,
              href: mem.portal_path,
              status: b.status === 'waitlist' ? 'Waitlist' : 'Booked',
              description: `${brand} class. ${b.status === 'waitlist' ? 'On the waitlist.' : 'You are booked.'}`,
            });
          }
          for (const ses of memberAllocatedUpcomingSessions(
            store,
            client.id,
            today,
            until
          )) {
            if (seen.has(ses.id)) continue;
            const ct = store.class_types.find((t) => t.id === ses.class_type_id);
            const start = String(ses.start_time || '09:00').slice(0, 5);
            const dur = Number(ses.duration_min) || 45;
            const [hh, mm] = start.split(':').map(Number);
            const endMin = (hh || 0) * 60 + (mm || 0) + dur;
            const end = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
            events.push({
              id: `gym-alloc-${ses.id}`,
              source: 'gym',
              brand,
              title: ct?.name || 'Class',
              date: ses.date,
              start_time: start,
              end_time: ses.end_time?.slice(0, 5) || end,
              location: ses.location || brand,
              href: mem.portal_path,
              status: 'On your class',
              description: `${brand} class. Saved to this class.`,
            });
          }
        }
      }

      if (
        mem.kind === 'physio' ||
        mem.kind === 'dental' ||
        mem.kind === 'medical' ||
        mem.kind === 'psychiatry' ||
        mem.kind === 'vet'
      ) {
        const store =
          mem.kind === 'physio'
            ? readPhysiographFromMetadata(raw)
            : mem.kind === 'dental'
              ? readDentalgraphFromMetadata(raw)
              : mem.kind === 'medical'
                ? readMedicalgraphFromMetadata(raw)
                : mem.kind === 'vet'
                  ? readVetgraphFromMetadata(raw)
                : readPsychiatrygraphFromMetadata(raw);
        const bookings = store.bookings || [];
        const appointments = store.appointments || [];
        for (const b of bookings) {
          if (b.patient_id !== mem.ref_id) continue;
          if (b.status === 'cancelled') continue;
          const apt = appointments.find((a) => a.id === b.appointment_id);
          if (!apt || apt.status === 'cancelled') continue;
          if (apt.date < historyFrom || apt.date > until) continue;
          const start = String(apt.start_time || '09:00').slice(0, 5);
          events.push({
            id: `clinic-${b.id}`,
            source: 'clinic',
            brand,
            title: `${brand} visit`,
            date: apt.date,
            start_time: start,
            end_time: apt.end_time?.slice(0, 5) || undefined,
            location: apt.location || brand,
            href: mem.portal_path,
            status: String(b.status || 'booked'),
            description: `${brand} appointment.`,
          });
        }
      }
    } catch {
      /* skip broken company */
    }
  }

  events.sort((a, b) => {
    const ad = `${a.date}T${a.start_time || '00:00'}`;
    const bd = `${b.date}T${b.start_time || '00:00'}`;
    return ad.localeCompare(bd);
  });
  return events;
}
