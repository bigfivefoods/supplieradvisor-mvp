import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getAgencyRegistration } from '@/lib/schools/approved-catalogue';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import {
  buildMonitoringReport,
  rowFromVisit,
  type MonitoringReportRow,
} from '@/lib/schools/nsnp-monitoring-report';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET NSNP Monitoring Tool report — filters + aggregates for charts.
 * Query: companyId, from, to, status, district, circuit, quintile,
 *        traffic, monitor, feeding, breakfast, q, minKpi, maxKpi
 */
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

    const supabase = getSupabaseServer();
    const agency = await getAgencyRegistration(supabase, companyId);
    let schoolId: number | null = null;
    if (!agency) {
      const got = await getOrCreateSchoolProfile(supabase, companyId).catch(
        () => null
      );
      schoolId =
        got?.school?.id != null ? Number(got.school.id) : null;
    }

    if (!agency && schoolId == null) {
      return NextResponse.json({
        success: true,
        role: 'none',
        report: buildMonitoringReport([]),
        message: 'DBE agency or school profile required',
      });
    }

    let q = supabase
      .from('nsnp_monitoring_tools')
      .select(
        'id, agency_profile_id, school_profile_id, school_company_id, peu_visit_id, visit_date, status, monitor_name, overall_kpi, rkmp_score, nehs_score, gardens_score, traffic_light, form_data, scores, submitted_at, created_at, updated_at'
      )
      .order('visit_date', { ascending: false })
      .limit(2000);

    if (agency) {
      q = q.eq('agency_profile_id', companyId);
    } else {
      q = q.eq('school_profile_id', schoolId!).eq('status', 'submitted');
    }

    const status = String(sp.get('status') || '').trim();
    if (status && status !== 'all') q = q.eq('status', status);
    // Default: all statuses for agency (drafts + submitted) unless filtered

    const from = sp.get('from');
    const to = sp.get('to');
    if (from) q = q.gte('visit_date', from);
    if (to) q = q.lte('visit_date', to);

    const traffic = String(sp.get('traffic') || '').trim().toLowerCase();
    if (traffic && traffic !== 'all') q = q.eq('traffic_light', traffic);

    const monitor = String(sp.get('monitor') || '').trim();
    if (monitor) q = q.ilike('monitor_name', `%${monitor}%`);

    const minKpi = sp.get('minKpi');
    const maxKpi = sp.get('maxKpi');
    if (minKpi != null && minKpi !== '' && Number.isFinite(Number(minKpi))) {
      q = q.gte('overall_kpi', Number(minKpi));
    }
    if (maxKpi != null && maxKpi !== '' && Number.isFinite(Number(maxKpi))) {
      q = q.lte('overall_kpi', Number(maxKpi));
    }

    const { data, error } = await q;
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          role: agency ? 'agency' : 'school',
          report: buildMonitoringReport([]),
          warning: 'Run migration 20260728_nsnp_monitoring_tool.sql',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Enrich school metadata
    type SchoolRow = {
      id: number;
      school_name?: string | null;
      emis_number?: string | null;
      district?: string | null;
      circuit?: string | null;
      province?: string | null;
      quintile?: number | string | null;
    };
    const raw = (data || []) as Array<Record<string, unknown>>;
    const schoolIds = [
      ...new Set(
        raw
          .map((v) => Number(v.school_profile_id))
          .filter((n) => Number.isFinite(n) && n > 0)
      ),
    ];
    const schoolMap = new Map<number, SchoolRow>();
    if (schoolIds.length) {
      const { data: schools } = await supabase
        .from('school_profiles')
        .select(
          'id, school_name, emis_number, district, circuit, province, quintile'
        )
        .in('id', schoolIds);
      for (const s of (schools || []) as SchoolRow[]) {
        schoolMap.set(Number(s.id), s);
      }
    }

    let rows: MonitoringReportRow[] = raw.map((v) => {
      const s = schoolMap.get(Number(v.school_profile_id));
      return rowFromVisit({
        ...v,
        school_name: s?.school_name || null,
        emis_number: s?.emis_number || null,
        district: s?.district || null,
        circuit: s?.circuit || null,
        province: s?.province || null,
        quintile: s?.quintile ?? null,
      });
    });

    // Client-style filters that need form_data / enriched fields
    const district = String(sp.get('district') || '').trim();
    const circuit = String(sp.get('circuit') || '').trim();
    const quintile = String(sp.get('quintile') || '').trim();
    const feeding = String(sp.get('feeding') || '').trim().toLowerCase();
    const breakfast = String(sp.get('breakfast') || '').trim().toLowerCase();
    const search = String(sp.get('q') || '').trim().toLowerCase();

    if (district) {
      rows = rows.filter(
        (r) =>
          String(r.district || '').toLowerCase() === district.toLowerCase()
      );
    }
    if (circuit) {
      rows = rows.filter(
        (r) =>
          String(r.circuit || '').toLowerCase() === circuit.toLowerCase()
      );
    }
    if (quintile) {
      rows = rows.filter((r) => String(r.quintile ?? '') === quintile);
    }
    if (feeding === 'yes' || feeding === 'no') {
      rows = rows.filter(
        (r) => String(r.feeding_today || '').toLowerCase() === feeding
      );
    }
    if (breakfast === 'yes' || breakfast === 'no') {
      rows = rows.filter(
        (r) => String(r.breakfast_served || '').toLowerCase() === breakfast
      );
    }
    if (search) {
      const tokens = search.split(/\s+/).filter(Boolean);
      rows = rows.filter((r) => {
        const hay = [
          r.school_name,
          r.emis_number,
          r.district,
          r.circuit,
          r.monitor_name,
          r.sp_name,
          r.province,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return tokens.every((t) => hay.includes(t));
      });
    }

    // Facets from unfiltered agency set would need second query;
    // build report then merge facet unions from full fetch window
    const report = buildMonitoringReport(rows);

    // Broad facets (before post-filters) for slicers — recompute from enriched raw if needed
    const allRows = raw.map((v) => {
      const s = schoolMap.get(Number(v.school_profile_id));
      return rowFromVisit({
        ...v,
        school_name: s?.school_name || null,
        emis_number: s?.emis_number || null,
        district: s?.district || null,
        circuit: s?.circuit || null,
        province: s?.province || null,
        quintile: s?.quintile ?? null,
      });
    });
    const broad = buildMonitoringReport(allRows);
    report.facets = {
      districts: broad.facets.districts,
      circuits: broad.facets.circuits,
      quintiles: broad.facets.quintiles,
      monitors: broad.facets.monitors,
      traffic: broad.facets.traffic,
      statuses: broad.facets.statuses.length
        ? broad.facets.statuses
        : ['submitted', 'draft'],
    };

    return NextResponse.json({
      success: true,
      role: agency ? 'agency' : 'school',
      canEdit: !!agency,
      report,
      filters: {
        from: from || null,
        to: to || null,
        status: status || 'all',
        district: district || null,
        circuit: circuit || null,
        quintile: quintile || null,
        traffic: traffic || 'all',
        monitor: monitor || null,
        feeding: feeding || 'all',
        breakfast: breakfast || 'all',
        q: search || null,
        minKpi: minKpi || null,
        maxKpi: maxKpi || null,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
