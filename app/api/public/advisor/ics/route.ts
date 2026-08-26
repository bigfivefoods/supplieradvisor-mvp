/**
 * GET /api/public/advisor/ics
 * Single event:
 *   ?module=fitgraph&date=YYYY-MM-DD&start=HH:mm&title=...&duration=45&location=
 * Diary feed (subscribe in Google/Apple Calendar):
 *   ?feed=1&module=dentalgraph&token=clin_…&from=&to=
 */
import { NextRequest, NextResponse } from 'next/server';
import { buildBookingIcs } from '@/lib/services/advisor-booking';
import { readFitgraphFromMetadata } from '@/lib/fitness/fitgraph';
import { readDentalgraphFromMetadata } from '@/lib/dental/dentalgraph';
import { readPhysiographFromMetadata } from '@/lib/clinic/physiograph';
import { readMedicalgraphFromMetadata } from '@/lib/clinic/medicalgraph';
import { readPsychiatrygraphFromMetadata } from '@/lib/clinic/psychiatrygraph';
import {
  isClinicianModule,
  parseClinicianCompanyIdFromToken,
  findClinicianByToken,
  clinicianField,
  type ClinicianStoreLike,
} from '@/lib/services/clinician-portal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function multiEventIcs(
  events: Array<{
    uid: string;
    title: string;
    date: string;
    start_time: string;
    duration_min?: number;
    location?: string;
    description?: string;
  }>
): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SupplierAdvisor//Advisor//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Advisor diary',
  ];
  for (const ev of events) {
    const single = buildBookingIcs(ev)
      .split(/\r?\n/)
      .filter(
        (l) =>
          l &&
          !l.startsWith('BEGIN:VCALENDAR') &&
          !l.startsWith('END:VCALENDAR') &&
          !l.startsWith('VERSION:') &&
          !l.startsWith('PRODID:') &&
          !l.startsWith('CALSCALE:') &&
          !l.startsWith('METHOD:')
      );
    lines.push(...single);
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const feed = sp.get('feed') === '1' || sp.get('mode') === 'feed';
  const module = String(sp.get('module') || 'fitgraph');
  const token = String(sp.get('token') || '');

  if (feed && token) {
    const from =
      sp.get('from') || new Date().toISOString().slice(0, 10);
    const toDate = new Date(from + 'T12:00:00');
    toDate.setDate(toDate.getDate() + 60);
    const to = sp.get('to') || toDate.toISOString().slice(0, 10);

    let companyId =
      parseClinicianCompanyIdFromToken(token) ||
      (() => {
        const m = /^coach_(\d+)_/.exec(token);
        return m ? Number(m[1]) : null;
      })();

    if (companyId == null) {
      return NextResponse.json(
        { error: 'token must include company id (re-issue portal)' },
        { status: 400 }
      );
    }

    const { loadAdvisorModuleStore, isAdvisorModuleKey } = await import(
      '@/lib/business/company-data'
    );
    if (!isAdvisorModuleKey(module)) {
      return NextResponse.json({ error: 'Unknown module' }, { status: 400 });
    }
    const { meta } = await loadAdvisorModuleStore(
      companyId,
      module,
      (m) => m
    );
    if (!meta) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const events: Array<{
      uid: string;
      title: string;
      date: string;
      start_time: string;
      duration_min?: number;
      location?: string;
      description?: string;
    }> = [];

    if (module === 'fitgraph') {
      const store = readFitgraphFromMetadata(meta);
      const coach = store.coaches.find((c) => c.portal_token === token);
      if (!coach) {
        return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
      }
      for (const s of store.sessions) {
        if (
          s.coach_id !== coach.id ||
          s.status === 'cancelled' ||
          s.date < from ||
          s.date > to
        )
          continue;
        const ct = store.class_types.find((t) => t.id === s.class_type_id);
        events.push({
          uid: s.id,
          title: ct?.name || 'Class',
          date: s.date,
          start_time: s.start_time,
          duration_min: s.duration_min || ct?.default_duration_min || 45,
          location: s.location,
          description: s.class_plan || s.notes,
        });
      }
    } else if (isClinicianModule(module)) {
      let store: ClinicianStoreLike;
      if (module === 'dentalgraph') {
        store = readDentalgraphFromMetadata(meta) as unknown as ClinicianStoreLike;
      } else if (module === 'physiograph') {
        store = readPhysiographFromMetadata(meta) as unknown as ClinicianStoreLike;
      } else if (module === 'medicalgraph') {
        store = readMedicalgraphFromMetadata(meta) as unknown as ClinicianStoreLike;
      } else if (module === 'vetgraph') {
        store = (await import('@/lib/clinic/vetgraph')).readVetgraphFromMetadata(
          meta
        ) as unknown as ClinicianStoreLike;
      } else {
        store = readPsychiatrygraphFromMetadata(
          meta
        ) as unknown as ClinicianStoreLike;
      }
      const person = findClinicianByToken(store, module, token);
      if (!person) {
        return NextResponse.json(
          { error: 'Clinician not found' },
          { status: 404 }
        );
      }
      const field = clinicianField(module);
      for (const a of store.appointments || []) {
        if (
          String(a[field] || '') !== person.id ||
          a.status === 'cancelled' ||
          a.date < from ||
          a.date > to
        )
          continue;
        const svc = (store.services || []).find((s) => s.id === a.service_id);
        events.push({
          uid: a.id,
          title: svc?.name || 'Appointment',
          date: a.date,
          start_time: a.start_time,
          duration_min: a.duration_min || 45,
          location: a.location,
          description: a.notes,
        });
      }
    } else {
      return NextResponse.json({ error: 'Unknown module' }, { status: 400 });
    }

    const ics = multiEventIcs(events);
    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `inline; filename="diary-${module}.ics"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const title = String(sp.get('title') || 'Booking');
  const date = String(sp.get('date') || '');
  const start = String(sp.get('start') || sp.get('start_time') || '09:00');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date=YYYY-MM-DD required' }, { status: 400 });
  }
  const duration = Number(sp.get('duration') || sp.get('duration_min') || 45);
  const location = sp.get('location') || undefined;
  const description = sp.get('description') || undefined;
  const uid = String(
    sp.get('uid') ||
      `${sp.get('module') || 'advisor'}-${date}-${start}-${Math.random().toString(36).slice(2, 8)}`
  );
  const ics = buildBookingIcs({
    uid,
    title,
    description,
    location: location || undefined,
    date,
    start_time: start,
    duration_min: duration,
  });
  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="booking-${date}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}
