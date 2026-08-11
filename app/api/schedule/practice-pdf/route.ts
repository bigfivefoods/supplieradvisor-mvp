/**
 * Practice PDF exports for Fit + clinic Advisors.
 * - kind=calendar → day/week/month schedule (A4 landscape|portrait)
 * - kind=profile  → practice profile (hours, team, services)
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  buildPracticeProfilePdf,
  buildPracticeSchedulePdf,
  type PracticePdfEvent,
} from '@/lib/schedule/practice-schedule-pdf';
import { normalizeWorkingHours } from '@/lib/schedule/working-hours';
import {
  readFitgraphFromMetadata,
  type FitgraphStore,
} from '@/lib/fitness/fitgraph';
import {
  readDentalgraphFromMetadata,
  type DentalgraphStore,
} from '@/lib/dental/dentalgraph';
import {
  readMedicalgraphFromMetadata,
  type MedicalgraphStore,
} from '@/lib/clinic/medicalgraph';
import {
  readPhysiographFromMetadata,
  type PhysiographStore,
} from '@/lib/clinic/physiograph';
import {
  readPsychiatrygraphFromMetadata,
  type PsychiatrygraphStore,
} from '@/lib/clinic/psychiatrygraph';

export const runtime = 'nodejs';

type ModuleId =
  | 'fitgraph'
  | 'dentalgraph'
  | 'medicalgraph'
  | 'physiograph'
  | 'psychiatrygraph';

const MODULE_LABEL: Record<ModuleId, string> = {
  fitgraph: 'FitAdvisor',
  dentalgraph: 'DentalAdvisor',
  medicalgraph: 'MedicalAdvisor',
  physiograph: 'PhysioAdvisor',
  psychiatrygraph: 'PsychiatryAdvisor',
};

function isModule(s: string): s is ModuleId {
  return s in MODULE_LABEL;
}

async function loadProfile(companyId: number) {
  const supabase = getSupabaseServer();
  const { data: prof } = await supabase
    .from('profiles')
    .select('id, trading_name, legal_name, metadata')
    .eq('id', companyId)
    .maybeSingle();
  return prof;
}

function fitEvents(
  store: FitgraphStore,
  from: string,
  to: string,
  personId?: string | null
): PracticePdfEvent[] {
  return (store.sessions || [])
    .filter(
      (s) =>
        s.date >= from &&
        s.date <= to &&
        s.status !== 'cancelled' &&
        (!personId || s.coach_id === personId)
    )
    .map((s) => {
      const ct = store.class_types.find((c) => c.id === s.class_type_id);
      const coach = store.coaches.find((c) => c.id === s.coach_id);
      return {
        date: s.date,
        start_time: String(s.start_time || '06:00').slice(0, 5),
        end_time: s.end_time,
        title: ct?.name || 'Class',
        person_name: coach?.name,
        location: s.room || s.location,
        meta: s.public ? 'Public' : undefined,
        status: s.status,
      };
    });
}

function clinicEvents(
  store:
    | DentalgraphStore
    | MedicalgraphStore
    | PhysiographStore
    | PsychiatrygraphStore,
  from: string,
  to: string,
  personId?: string | null,
  personField: 'staff_id' | 'practitioner_id' = 'practitioner_id'
): PracticePdfEvent[] {
  const people =
    'staff' in store
      ? (store as DentalgraphStore).staff
      : (store as MedicalgraphStore).practitioners;
  return (store.appointments || [])
    .filter((a) => {
      if (a.date < from || a.date > to || a.status === 'cancelled') return false;
      if (!personId) return true;
      const pid =
        personField === 'staff_id'
          ? (a as { staff_id?: string | null }).staff_id
          : (a as { practitioner_id?: string | null }).practitioner_id;
      return pid === personId;
    })
    .map((a) => {
      const svc = store.services.find((s) => s.id === a.service_id);
      const pid =
        personField === 'staff_id'
          ? (a as { staff_id?: string | null }).staff_id
          : (a as { practitioner_id?: string | null }).practitioner_id;
      const person = people.find((p) => p.id === pid);
      return {
        date: a.date,
        start_time: String(a.start_time || '09:00').slice(0, 5),
        end_time: a.end_time,
        title: svc?.name || 'Appointment',
        person_name: person?.name,
        location: a.location,
        meta: a.public ? 'Public slot' : undefined,
        status: a.status,
      };
    });
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const moduleRaw = String(sp.get('module') || 'fitgraph').toLowerCase();
    if (!isModule(moduleRaw)) {
      return NextResponse.json({ error: 'Invalid module' }, { status: 400 });
    }
    const kind = String(sp.get('kind') || 'calendar').toLowerCase();
    const orientation =
      String(sp.get('orientation') || 'landscape').toLowerCase() === 'portrait'
        ? 'portrait'
        : 'landscape';
    const viewRaw = String(sp.get('view') || 'week').toLowerCase();
    const view =
      viewRaw === 'day' || viewRaw === 'month' ? viewRaw : 'week';
    const from =
      sp.get('from') || new Date().toISOString().slice(0, 10);
    const to = sp.get('to') || from;
    const personId = sp.get('personId') || sp.get('coachId') || null;

    const prof = await loadProfile(companyId);
    if (!prof) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    const meta =
      prof.metadata && typeof prof.metadata === 'object'
        ? (prof.metadata as Record<string, unknown>)
        : {};
    const trading =
      String(prof.trading_name || prof.legal_name || 'Practice').trim() ||
      'Practice';
    const label = MODULE_LABEL[moduleRaw];

    if (kind === 'profile') {
      let brand = trading;
      let bio = '';
      let contactEmail = '';
      let contactPhone = '';
      let websiteUrl = '';
      let workingHours = normalizeWorkingHours(null);
      let rooms: string[] = [];
      let people: Array<{ name: string; role?: string; code?: string }> = [];
      let offerings: Array<{ name: string; code?: string; detail?: string }> =
        [];

      if (moduleRaw === 'fitgraph') {
        const store = readFitgraphFromMetadata(meta);
        brand = store.settings?.brand_name || brand;
        bio = store.settings?.public_bio || store.settings?.bio || '';
        contactEmail = store.settings?.contact_email || '';
        contactPhone = store.settings?.contact_phone || '';
        websiteUrl = store.settings?.website_url || '';
        workingHours = normalizeWorkingHours(store.settings?.working_hours);
        rooms = store.settings?.rooms || [];
        people = (store.coaches || [])
          .filter((c) => c.active !== false)
          .map((c) => ({
            name: c.name,
            code: c.code,
            role: (c.specialties || []).slice(0, 3).join(', ') || 'Coach',
          }));
        offerings = (store.class_types || [])
          .filter((c) => c.active !== false)
          .map((c) => ({
            name: c.name,
            code: c.code,
            detail: c.description,
          }));
      } else if (moduleRaw === 'dentalgraph') {
        const store = readDentalgraphFromMetadata(meta);
        brand = store.settings?.brand_name || brand;
        bio = store.settings?.public_bio || '';
        contactEmail = store.settings?.contact_email || '';
        contactPhone = store.settings?.contact_phone || '';
        websiteUrl = store.settings?.website_url || '';
        workingHours = normalizeWorkingHours(store.settings?.working_hours);
        rooms = store.settings?.rooms || [];
        people = (store.staff || [])
          .filter((p) => p.active !== false)
          .map((p) => ({
            name: p.name,
            code: p.code,
            role: (p.roles || []).slice(0, 3).join(', ') || 'Clinician',
          }));
        offerings = (store.services || [])
          .filter((s) => s.active !== false)
          .map((s) => ({
            name: s.name,
            code: s.code,
            detail: s.description,
          }));
      } else {
        const store =
          moduleRaw === 'medicalgraph'
            ? readMedicalgraphFromMetadata(meta)
            : moduleRaw === 'physiograph'
              ? readPhysiographFromMetadata(meta)
              : readPsychiatrygraphFromMetadata(meta);
        brand = store.settings?.brand_name || brand;
        bio = store.settings?.public_bio || '';
        contactEmail = store.settings?.contact_email || '';
        contactPhone = store.settings?.contact_phone || '';
        websiteUrl = store.settings?.website_url || '';
        workingHours = normalizeWorkingHours(store.settings?.working_hours);
        rooms = store.settings?.rooms || [];
        people = (store.practitioners || [])
          .filter((p) => p.active !== false)
          .map((p) => ({
            name: p.name,
            code: p.code,
            role:
              (p.disciplines || []).slice(0, 3).join(', ') || 'Practitioner',
          }));
        offerings = (store.services || [])
          .filter((s) => s.active !== false)
          .map((s) => ({
            name: s.name,
            code: s.code,
            detail: s.description,
          }));
      }

      const buf = await buildPracticeProfilePdf({
        brand,
        moduleLabel: label,
        bio,
        contactEmail,
        contactPhone,
        websiteUrl,
        workingHours,
        rooms,
        people,
        offerings,
      });
      const safe = brand.replace(/[^\w.-]+/g, '_').slice(0, 40);
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safe}-practice-profile.pdf"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // calendar
    let brand = trading;
    let workingHours = normalizeWorkingHours(null);
    let events: PracticePdfEvent[] = [];
    let title = 'Schedule';

    if (moduleRaw === 'fitgraph') {
      const store = readFitgraphFromMetadata(meta);
      brand = store.settings?.brand_name || brand;
      workingHours = normalizeWorkingHours(store.settings?.working_hours);
      events = fitEvents(store, from, to, personId);
      if (personId) {
        const coach = store.coaches.find((c) => c.id === personId);
        title = coach
          ? `Coach diary · ${coach.name}`
          : 'Coach diary';
      } else {
        title = 'Class schedule';
      }
    } else if (moduleRaw === 'dentalgraph') {
      const store = readDentalgraphFromMetadata(meta);
      brand = store.settings?.brand_name || brand;
      workingHours = normalizeWorkingHours(store.settings?.working_hours);
      events = clinicEvents(store, from, to, personId, 'staff_id');
      title = 'Clinic schedule';
    } else {
      const store =
        moduleRaw === 'medicalgraph'
          ? readMedicalgraphFromMetadata(meta)
          : moduleRaw === 'physiograph'
            ? readPhysiographFromMetadata(meta)
            : readPsychiatrygraphFromMetadata(meta);
      brand = store.settings?.brand_name || brand;
      workingHours = normalizeWorkingHours(store.settings?.working_hours);
      events = clinicEvents(store, from, to, personId, 'practitioner_id');
      title = 'Clinic schedule';
    }

    const buf = await buildPracticeSchedulePdf({
      brand,
      title,
      moduleLabel: label,
      view,
      from,
      to,
      orientation,
      workingHours,
      events,
    });
    const safe = brand.replace(/[^\w.-]+/g, '_').slice(0, 40);
    const fname = `${safe}-${view}-${from}-${orientation}.pdf`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fname}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: unknown) {
    console.error('[practice-pdf]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'PDF failed' },
      { status: 500 }
    );
  }
}
