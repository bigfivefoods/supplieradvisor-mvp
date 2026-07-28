import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getAgencyRegistration } from '@/lib/schools/approved-catalogue';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import {
  emptyMonitoringForm,
  NSNP_MONITORING_VERSION,
  scoreMonitoringForm,
  type MonitoringFormData,
} from '@/lib/schools/nsnp-monitoring-tool';
import { logNsnpEvent } from '@/lib/schools/events';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * NSNP Monitoring Tool (KZN 2026-27) for DBE field workers.
 * GET  ?companyId=&id= | list agency/school submissions
 * POST save draft / submit
 * PATCH update existing
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
    const id = sp.get('id') ? Number(sp.get('id')) : null;
    const agency = await getAgencyRegistration(supabase, companyId);
    let schoolRow: Record<string, unknown> | null = null;
    if (!agency) {
      const got = await getOrCreateSchoolProfile(supabase, companyId).catch(
        () => null
      );
      schoolRow = got?.school ?? null;
    }
    const schoolId =
      schoolRow?.id != null ? Number(schoolRow.id) : null;

    if (id != null && Number.isFinite(id)) {
      const { data, error } = await supabase
        .from('nsnp_monitoring_tools')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) {
          return NextResponse.json({
            success: true,
            visit: null,
            warning: 'Run migration 20260728_nsnp_monitoring_tool.sql',
          });
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (!data) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      const allowed =
        (agency && Number(data.agency_profile_id) === companyId) ||
        (schoolId != null &&
          Number.isFinite(schoolId) &&
          Number(data.school_profile_id) === schoolId &&
          String(data.status) === 'submitted');
      if (!allowed) {
        return NextResponse.json({ error: 'Not authorised' }, { status: 403 });
      }
      return NextResponse.json({ success: true, visit: data, canEdit: !!agency });
    }

    // Optional: load by linked PEU visit
    const peuVisitIdParam = sp.get('peuVisitId')
      ? Number(sp.get('peuVisitId'))
      : null;
    if (peuVisitIdParam != null && Number.isFinite(peuVisitIdParam) && agency) {
      const { data: byPeu } = await supabase
        .from('nsnp_monitoring_tools')
        .select('*')
        .eq('agency_profile_id', companyId)
        .eq('peu_visit_id', peuVisitIdParam)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byPeu) {
        return NextResponse.json({
          success: true,
          visit: byPeu,
          canEdit: true,
          linkedFromPeu: true,
        });
      }
    }

    let q = supabase
      .from('nsnp_monitoring_tools')
      .select(
        'id, agency_profile_id, school_profile_id, school_company_id, peu_visit_id, visit_date, status, monitor_name, overall_kpi, rkmp_score, nehs_score, gardens_score, traffic_light, form_data, scores, submitted_at, created_at, updated_at'
      )
      .order('visit_date', { ascending: false })
      .limit(200);

    if (agency) {
      q = q.eq('agency_profile_id', companyId);
    } else if (schoolId != null && Number.isFinite(schoolId)) {
      q = q.eq('school_profile_id', schoolId).eq('status', 'submitted');
    } else {
      return NextResponse.json({
        success: true,
        visits: [],
        role: 'none',
        message: 'Register as DBE field agency or school to use monitoring.',
      });
    }

    const status = sp.get('status');
    if (status) q = q.eq('status', status);
    const from = sp.get('from');
    const to = sp.get('to');
    if (from) q = q.gte('visit_date', from);
    if (to) q = q.lte('visit_date', to);

    const { data, error } = await q;
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          visits: [],
          role: agency ? 'agency' : 'school',
          warning: 'Run migration 20260728_nsnp_monitoring_tool.sql',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Enrich school names for agency list
    type VisitRow = Record<string, unknown> & {
      school_profile_id?: number | null;
      form_data?: Record<string, unknown> | null;
    };
    type SchoolRow = {
      id: number;
      school_name?: string | null;
      emis_number?: string | null;
      district?: string | null;
    };
    let visits: VisitRow[] = (data || []) as VisitRow[];
    if (agency && visits.length) {
      const idSet = new Set<number>();
      for (const v of visits) {
        const n = Number(v.school_profile_id);
        if (Number.isFinite(n) && n > 0) idSet.add(n);
      }
      const ids = Array.from(idSet);
      if (ids.length) {
        const { data: schools } = await supabase
          .from('school_profiles')
          .select('id, school_name, emis_number, district, quintile')
          .in('id', ids);
        const map = new Map<number, SchoolRow>();
        for (const s of (schools || []) as SchoolRow[]) {
          map.set(Number(s.id), s);
        }
        visits = visits.map((v) => {
          const s = map.get(Number(v.school_profile_id));
          const fd = (v.form_data || {}) as Record<string, unknown>;
          return {
            ...v,
            school_name:
              s?.school_name ||
              String(fd.a1_school_name || '') ||
              null,
            emis_number:
              s?.emis_number || String(fd.a2_emis || '') || null,
            district: s?.district || String(fd.a4_district || '') || null,
          };
        });
      }
    }

    return NextResponse.json({
      success: true,
      visits,
      role: agency ? 'agency' : 'school',
      canCreate: !!agency,
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

    const supabase = getSupabaseServer();
    const agency = await getAgencyRegistration(supabase, companyId);
    if (!agency) {
      return NextResponse.json(
        { error: 'Only DBE / PEU field workers can complete the monitoring tool' },
        { status: 403 }
      );
    }

    const form = {
      ...emptyMonitoringForm(),
      ...(body.form_data && typeof body.form_data === 'object'
        ? body.form_data
        : {}),
    } as MonitoringFormData;

    const scores = scoreMonitoringForm(form);
    const status =
      body.status === 'submitted' || body.action === 'submit'
        ? 'submitted'
        : 'draft';
    const schoolProfileId = form.school_profile_id
      ? Number(form.school_profile_id)
      : body.school_profile_id
        ? Number(body.school_profile_id)
        : null;

    let schoolCompanyId: number | null = null;
    if (schoolProfileId) {
      const { data: link } = await supabase
        .from('school_agency_links')
        .select('status')
        .eq('agency_profile_id', companyId)
        .eq('school_profile_id', schoolProfileId)
        .eq('status', 'active')
        .maybeSingle();
      if (!link && status === 'submitted') {
        return NextResponse.json(
          { error: 'School is not an approved member of your agency' },
          { status: 400 }
        );
      }
      const { data: sch } = await supabase
        .from('school_profiles')
        .select('id, profile_id, school_name, emis_number, district, quintile')
        .eq('id', schoolProfileId)
        .maybeSingle();
      if (sch) {
        schoolCompanyId = sch.profile_id != null ? Number(sch.profile_id) : null;
        if (!form.a1_school_name) form.a1_school_name = String(sch.school_name || '');
        if (!form.a2_emis && sch.emis_number)
          form.a2_emis = String(sch.emis_number);
        if (!form.a4_district && sch.district)
          form.a4_district = String(sch.district);
        if (!form.a5_quintile && sch.quintile != null)
          form.a5_quintile = String(sch.quintile);
      }
    }

    // Link to planned PEU visit (optional)
    let peuVisitId: number | null =
      body.peu_visit_id != null && Number.isFinite(Number(body.peu_visit_id))
        ? Number(body.peu_visit_id)
        : null;

    if (peuVisitId) {
      const { data: peu } = await supabase
        .from('nsnp_peu_visits')
        .select(
          'id, school_profile_id, school_company_id, visitor_name, planned_date, visit_date, status'
        )
        .eq('id', peuVisitId)
        .eq('agency_profile_id', companyId)
        .maybeSingle();
      if (!peu) {
        return NextResponse.json(
          { error: 'Linked PEU visit not found for this agency' },
          { status: 400 }
        );
      }
      // Prefer school from PEU plan when form lacks it
      if (!schoolProfileId && peu.school_profile_id) {
        const sid = Number(peu.school_profile_id);
        form.school_profile_id = sid;
        const { data: sch } = await supabase
          .from('school_profiles')
          .select(
            'id, profile_id, school_name, emis_number, district, quintile'
          )
          .eq('id', sid)
          .maybeSingle();
        if (sch) {
          schoolCompanyId =
            sch.profile_id != null ? Number(sch.profile_id) : null;
          if (!form.a1_school_name)
            form.a1_school_name = String(sch.school_name || '');
          if (!form.a2_emis && sch.emis_number)
            form.a2_emis = String(sch.emis_number);
          if (!form.a4_district && sch.district)
            form.a4_district = String(sch.district);
          if (!form.a5_quintile && sch.quintile != null)
            form.a5_quintile = String(sch.quintile);
        }
      }
      if (!form.a6_monitor_name && peu.visitor_name) {
        form.a6_monitor_name = String(peu.visitor_name);
      }
      if (!form.a7_visit_date) {
        form.a7_visit_date = String(
          peu.planned_date || peu.visit_date || ''
        ).slice(0, 10);
      }
    }

    const resolvedSchoolId =
      form.school_profile_id != null
        ? Number(form.school_profile_id)
        : schoolProfileId;

    // Re-validate membership after PEU prefill
    if (
      status === 'submitted' &&
      resolvedSchoolId != null &&
      Number.isFinite(resolvedSchoolId)
    ) {
      const { data: link2 } = await supabase
        .from('school_agency_links')
        .select('status')
        .eq('agency_profile_id', companyId)
        .eq('school_profile_id', resolvedSchoolId)
        .eq('status', 'active')
        .maybeSingle();
      if (!link2) {
        return NextResponse.json(
          { error: 'School is not an approved member of your agency' },
          { status: 400 }
        );
      }
    }

    const row: Record<string, unknown> = {
      agency_profile_id: companyId,
      school_profile_id: resolvedSchoolId,
      school_company_id: schoolCompanyId,
      visit_date: form.a7_visit_date || new Date().toISOString().slice(0, 10),
      status,
      monitor_name: form.a6_monitor_name || null,
      tool_version: NSNP_MONITORING_VERSION,
      form_data: form,
      scores,
      overall_kpi: scores.overall_kpi,
      rkmp_score: scores.rkmp,
      nehs_score: scores.nehs,
      gardens_score: scores.gardens,
      traffic_light: scores.traffic_light,
      photo_urls: Array.isArray(body.photo_urls) ? body.photo_urls : [],
      metadata: {
        ...(body.metadata && typeof body.metadata === 'object'
          ? body.metadata
          : {}),
        peu_visit_id: peuVisitId,
      },
      created_by: gate.userId || null,
      submitted_at: status === 'submitted' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    if (peuVisitId) row.peu_visit_id = peuVisitId;

    const existingId = body.id ? Number(body.id) : null;
    let data;
    let error;

    if (existingId && Number.isFinite(existingId)) {
      const res = await supabase
        .from('nsnp_monitoring_tools')
        .update(row)
        .eq('id', existingId)
        .eq('agency_profile_id', companyId)
        .select('*')
        .single();
      data = res.data;
      error = res.error;
      // Column may not exist yet — retry without peu_visit_id
      if (
        error &&
        /peu_visit_id|schema cache|column/i.test(error.message) &&
        row.peu_visit_id != null
      ) {
        const { peu_visit_id: _drop, ...rest } = row;
        const res2 = await supabase
          .from('nsnp_monitoring_tools')
          .update(rest)
          .eq('id', existingId)
          .eq('agency_profile_id', companyId)
          .select('*')
          .single();
        data = res2.data;
        error = res2.error;
      }
    } else {
      const res = await supabase
        .from('nsnp_monitoring_tools')
        .insert(row)
        .select('*')
        .single();
      data = res.data;
      error = res.error;
      if (
        error &&
        /peu_visit_id|schema cache|column/i.test(error.message) &&
        row.peu_visit_id != null
      ) {
        const { peu_visit_id: _drop, ...rest } = row;
        const res2 = await supabase
          .from('nsnp_monitoring_tools')
          .insert(rest)
          .select('*')
          .single();
        data = res2.data;
        error = res2.error;
      }
    }

    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json(
          {
            error:
              'Monitoring table missing — run migration 20260728_nsnp_monitoring_tool.sql (+ peu_visit_id link migration)',
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const finalSchoolId =
      resolvedSchoolId != null && Number.isFinite(resolvedSchoolId)
        ? resolvedSchoolId
        : schoolProfileId;

    // On submit: complete linked PEU planned visit with monitoring KPI
    if (status === 'submitted' && peuVisitId) {
      const peuPatch: Record<string, unknown> = {
        status: 'completed',
        visit_date:
          form.a7_visit_date || new Date().toISOString().slice(0, 10),
        visitor_name: form.a6_monitor_name || null,
        overall_score: scores.overall_kpi,
        feeding_score: scores.feeding_time_points,
        hygiene_score: scores.nehs,
        stock_score: scores.rkmp,
        menu_score: scores.food_groups_kpi,
        findings_summary:
          form.observations ||
          form.recommendations ||
          `NSNP monitoring KPI ${scores.overall_kpi} (${scores.traffic_light})`,
        notes: [
          form.recommendations,
          form.observations,
        ]
          .filter(Boolean)
          .join('\n\n')
          .slice(0, 4000) || null,
        checklist: {
          source: 'nsnp_monitoring_tool',
          monitoring_id: data.id,
          traffic_light: scores.traffic_light,
          rkmp: scores.rkmp,
          nehs: scores.nehs,
          gardens: scores.gardens,
          overall_kpi: scores.overall_kpi,
        },
        metadata: {
          monitoring_id: data.id,
          monitoring_kpi: scores.overall_kpi,
          traffic_light: scores.traffic_light,
          completed_via: 'nsnp_monitoring_tool',
          completed_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      };
      try {
        await supabase
          .from('nsnp_peu_visits')
          .update(peuPatch)
          .eq('id', peuVisitId)
          .eq('agency_profile_id', companyId);
      } catch {
        /* soft — monitoring save already succeeded */
      }
    }

    if (status === 'submitted' && finalSchoolId) {
      await logNsnpEvent(supabase, {
        companyId,
        schoolProfileId: finalSchoolId,
        kind: 'nsnp_monitoring_submitted',
        title: `NSNP monitoring · KPI ${scores.overall_kpi} (${scores.traffic_light})`,
        body: `${form.a1_school_name || 'School'} · RKMP ${scores.rkmp}/20 · NEHS ${scores.nehs}/20 · Gardens ${scores.gardens}/10`,
        href: `/dashboard/schools/monitoring?id=${data.id}`,
        metadata: {
          monitoring_id: data.id,
          peu_visit_id: peuVisitId,
          overall_kpi: scores.overall_kpi,
          traffic_light: scores.traffic_light,
        },
      }).catch(() => null);
    }

    return NextResponse.json({
      success: true,
      visit: data,
      scores,
      peu_visit_id: peuVisitId,
      message:
        status === 'submitted'
          ? `Monitoring submitted · KPI ${scores.overall_kpi}/100 (${scores.traffic_light})${
              peuVisitId ? ' · PEU visit completed' : ''
            }`
          : 'Draft saved',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const id = Number(sp.get('id'));
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'companyId and id required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const agency = await getAgencyRegistration(supabase, companyId);
    if (!agency) {
      return NextResponse.json({ error: 'DBE only' }, { status: 403 });
    }

    const { error } = await supabase
      .from('nsnp_monitoring_tools')
      .delete()
      .eq('id', id)
      .eq('agency_profile_id', companyId)
      .eq('status', 'draft');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
