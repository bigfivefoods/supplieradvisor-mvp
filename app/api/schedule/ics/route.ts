import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess } from '@/lib/auth/api-auth';
import { buildIcsCalendar, type IcsEvent } from '@/lib/schedule/advisor-ics';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { readFitgraphFromMetadata } from '@/lib/fitness/fitgraph';
import { readDentalgraphFromMetadata } from '@/lib/dental/dentalgraph';
import { readPhysiographFromMetadata } from '@/lib/clinic/physiograph';
import { readMedicalgraphFromMetadata } from '@/lib/clinic/medicalgraph';
import { readPsychiatrygraphFromMetadata } from '@/lib/clinic/psychiatrygraph';

export const runtime = 'nodejs';

/**
 * GET /api/schedule/ics?companyId=&module=fitgraph|dentalgraph|...&personId=&from=&to=
 * Returns text/calendar feed — import into Outlook/Google as a mirror.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const companyId = url.searchParams.get('companyId') || '';
    const module = url.searchParams.get('module') || 'fitgraph';
    const personId = url.searchParams.get('personId') || '';
    const from = url.searchParams.get('from') || '';
    const to = url.searchParams.get('to') || '';

    if (!companyId) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const auth = await requireCompanyAccess(req, Number(companyId));
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = getSupabaseServer();
    const { data: company } = await supabase
      .from('companies')
      .select('id, name, metadata')
      .eq('id', Number(companyId))
      .maybeSingle();

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const meta = (company.metadata || {}) as Record<string, unknown>;
    const events: IcsEvent[] = [];
    const brand = String(company.name || 'SupplierAdvisor');

    if (module === 'fitgraph') {
      const store = readFitgraphFromMetadata(meta);
      for (const s of store.sessions || []) {
        if (s.status === 'cancelled') continue;
        if (personId && s.coach_id !== personId) continue;
        if (from && s.date < from) continue;
        if (to && s.date > to) continue;
        const ct = store.class_types.find((c) => c.id === s.class_type_id);
        const coach = store.coaches.find((c) => c.id === s.coach_id);
        events.push({
          id: s.id,
          title: ct?.name || 'Class',
          description: [coach?.name, s.location, s.public_notes]
            .filter(Boolean)
            .join(' · '),
          location: s.location || undefined,
          date: s.date,
          start_time: s.start_time,
          end_time: s.end_time,
          duration_min: s.duration_min,
        });
      }
    } else {
      const readers: Record<
        string,
        (m: Record<string, unknown>) => {
          appointments?: Array<Record<string, unknown>>;
          patients?: Array<{ id: string; name?: string }>;
        }
      > = {
        dentalgraph: readDentalgraphFromMetadata as never,
        physiograph: readPhysiographFromMetadata as never,
        medicalgraph: readMedicalgraphFromMetadata as never,
        psychiatrygraph: readPsychiatrygraphFromMetadata as never,
      };
      const read = readers[module];
      if (!read) {
        return NextResponse.json({ error: 'Unknown module' }, { status: 400 });
      }
      const store = read(meta);
      for (const a of store.appointments || []) {
        if (String(a.status || '') === 'cancelled') continue;
        const clin = String(a.staff_id || a.practitioner_id || '');
        if (personId && clin !== personId) continue;
        const date = String(a.date || '');
        if (from && date < from) continue;
        if (to && date > to) continue;
        const patient = (store.patients || []).find(
          (p) => p.id === String(a.patient_id || '')
        );
        events.push({
          id: String(a.id),
          title: String(a.title || a.service_name || 'Appointment'),
          description: patient?.name || undefined,
          location: String(a.location || a.room || '') || undefined,
          date,
          start_time: String(a.start_time || '09:00'),
          end_time: a.end_time ? String(a.end_time) : null,
          duration_min: a.duration_min != null ? Number(a.duration_min) : null,
        });
      }
    }

    const ics = buildIcsCalendar(events, {
      calName: `${brand} · ${module}`,
    });

    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${module}-${companyId}.ics"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: unknown) {
    console.error('ics feed', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'ICS failed' },
      { status: 500 }
    );
  }
}
