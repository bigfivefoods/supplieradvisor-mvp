import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getAgencyRegistration } from '@/lib/schools/approved-catalogue';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import { fetchAgencySchoolLinks, fetchByIds } from '@/lib/schools/supabase-page';
import { logNsnpEvent } from '@/lib/schools/events';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * PEU / monitor visits + day plans
 *
 * GET  ?companyId=&mode=agency|school|plan|report|schools
 * POST action: log_visit | complete_visit | create_plan | cancel_plan | notify_plan
 * PATCH update planned visit / cancel
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
    const mode = String(sp.get('mode') || 'agency');
    const q = String(sp.get('q') || '').trim().toLowerCase();
    const district = String(sp.get('district') || '').trim();
    const circuit = String(sp.get('circuit') || '').trim();
    const cmc = String(sp.get('cmc') || '').trim();
    const province = String(sp.get('province') || '').trim();
    const municipality = String(sp.get('municipality') || '').trim();
    const from = sp.get('from') || '';
    const to = sp.get('to') || '';
    const status = sp.get('status') || '';

    // ── Smart school picker for PEU ──────────────────────────────────
    if (mode === 'schools') {
      const agency = await getAgencyRegistration(supabase, companyId);
      if (!agency) {
        return NextResponse.json(
          { error: 'DBE / PEU only', success: false },
          { status: 403 }
        );
      }
      const links = await fetchAgencySchoolLinks(supabase, companyId, [
        'active',
      ]).catch(() => []);
      const schoolIds = [
        ...new Set(
          links
            .map((l) => Number(l.school_profile_id))
            .filter((n) => Number.isFinite(n) && n > 0)
        ),
      ];
      if (!schoolIds.length) {
        return NextResponse.json({
          success: true,
          schools: [],
          facets: emptyFacets(),
        });
      }

      let schools = await fetchByIds(
        supabase,
        'school_profiles',
        'id, profile_id, school_name, emis_number, natemis, province, district, circuit, cmc, local_municipality, municipality_ward, quintile, phase, level_label, learner_count_enrolled, learner_count_nsnp_eligible, status',
        schoolIds
      ).catch(async () =>
        fetchByIds(
          supabase,
          'school_profiles',
          'id, profile_id, school_name, emis_number, province, district, circuit, quintile, phase, learner_count_enrolled, status',
          schoolIds
        )
      );

      if (province) {
        schools = schools.filter(
          (s) =>
            String(s.province || '').toLowerCase() === province.toLowerCase()
        );
      }
      if (district) {
        schools = schools.filter(
          (s) =>
            String(s.district || '').toLowerCase() === district.toLowerCase()
        );
      }
      if (circuit) {
        schools = schools.filter(
          (s) =>
            String(s.circuit || '').toLowerCase() === circuit.toLowerCase()
        );
      }
      if (cmc) {
        schools = schools.filter(
          (s) => String(s.cmc || '').toLowerCase() === cmc.toLowerCase()
        );
      }
      if (municipality) {
        schools = schools.filter(
          (s) =>
            String(s.local_municipality || '').toLowerCase() ===
            municipality.toLowerCase()
        );
      }
      if (q) {
        schools = schools.filter((s) => {
          const hay = [
            s.school_name,
            s.emis_number,
            s.natemis,
            s.district,
            s.circuit,
            s.cmc,
            s.local_municipality,
            s.municipality_ward,
            s.phase,
            s.level_label,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return hay.includes(q);
        });
      }

      schools.sort((a, b) =>
        String(a.school_name || '').localeCompare(String(b.school_name || ''))
      );

      const facets = {
        provinces: uniq(schools.map((s) => s.province)),
        districts: uniq(schools.map((s) => s.district)),
        circuits: uniq(schools.map((s) => s.circuit)),
        cmcs: uniq(schools.map((s) => s.cmc)),
        municipalities: uniq(schools.map((s) => s.local_municipality)),
      };

      return NextResponse.json({
        success: true,
        schools: schools.slice(0, 500).map((s) => ({
          id: Number(s.id),
          profile_id: s.profile_id != null ? Number(s.profile_id) : null,
          school_name: s.school_name,
          emis_number: s.emis_number,
          natemis: s.natemis,
          province: s.province,
          district: s.district,
          circuit: s.circuit,
          cmc: s.cmc,
          local_municipality: s.local_municipality,
          quintile: s.quintile,
          learners: Number(
            s.learner_count_enrolled || s.learner_count_nsnp_eligible || 0
          ),
          label: [
            s.school_name,
            s.natemis || s.emis_number,
            s.district,
            s.circuit,
          ]
            .filter(Boolean)
            .join(' · '),
        })),
        total: schools.length,
        facets,
      });
    }

    // ── Planned vs actual report ─────────────────────────────────────
    if (mode === 'report') {
      const agency = await getAgencyRegistration(supabase, companyId);
      if (!agency) {
        return NextResponse.json(
          { error: 'DBE / PEU only' },
          { status: 403 }
        );
      }
      return NextResponse.json(
        await plannedVsActualReport(supabase, companyId, {
          from: from || monthStart(),
          to: to || today(),
          district,
        })
      );
    }

    // ── Day plans (grouped planned visits) ───────────────────────────
    if (mode === 'plan' || mode === 'plans') {
      const agency = await getAgencyRegistration(supabase, companyId);
      if (!agency) {
        return NextResponse.json(
          { error: 'DBE / PEU only' },
          { status: 403 }
        );
      }
      let qy = supabase
        .from('nsnp_peu_visits')
        .select('*')
        .eq('agency_profile_id', companyId)
        .in('status', ['planned', 'in_progress', 'cancelled'])
        .order('planned_date', { ascending: true })
        .limit(500);
      if (from) qy = qy.gte('planned_date', from);
      if (to) qy = qy.lte('planned_date', to);
      const { data, error } = await qy;
      if (error) {
        return NextResponse.json({
          success: true,
          plans: [],
          warning: error.message,
        });
      }
      const plans = groupPlans(data || []);
      await enrichPlanSchoolNames(supabase, plans);
      return NextResponse.json({ success: true, plans, visits: data || [] });
    }

    // ── School dashboard visits ──────────────────────────────────────
    if (mode === 'school') {
      const { school } = await getOrCreateSchoolProfile(supabase, companyId);
      if (!school) {
        return NextResponse.json({ success: true, planned: [], actual: [] });
      }
      const schoolId = Number(school.id);

      const { data: all } = await supabase
        .from('nsnp_peu_visits')
        .select('*')
        .eq('school_profile_id', schoolId)
        .order('visit_date', { ascending: false })
        .limit(100);

      const planned = (all || []).filter(
        (v) =>
          String(v.status) === 'planned' &&
          (v.notify_school === true ||
            (v.metadata as { notify_school?: boolean })?.notify_school === true)
      );
      const actual = (all || []).filter((v) =>
        ['completed', 'in_progress'].includes(String(v.status))
      );

      // Attach related RIADs if any
      const riadIds = new Set<number>();
      for (const v of actual) {
        const ids = Array.isArray(v.riad_ids)
          ? v.riad_ids
          : Array.isArray((v.metadata as { riad_ids?: number[] })?.riad_ids)
            ? (v.metadata as { riad_ids: number[] }).riad_ids
            : [];
        for (const id of ids) {
          if (Number.isFinite(Number(id))) riadIds.add(Number(id));
        }
      }
      let riads: Array<Record<string, unknown>> = [];
      if (riadIds.size) {
        const { data: r } = await supabase
          .from('riad_logs')
          .select(
            'id, title, status, riad_type, priority, severity, created_at, description'
          )
          .in('id', [...riadIds])
          .limit(50);
        riads = r || [];
      }

      return NextResponse.json({
        success: true,
        role: 'school',
        planned,
        actual,
        riads,
        school: {
          id: schoolId,
          name: school.school_name,
        },
      });
    }

    // ── Agency visit log (default) ───────────────────────────────────
    let qy = supabase
      .from('nsnp_peu_visits')
      .select('*')
      .eq('agency_profile_id', companyId)
      .order('visit_date', { ascending: false })
      .limit(300);

    if (status && status !== 'all') {
      qy = qy.eq('status', status);
    } else {
      // default list focuses on completed + recent planned
      qy = qy.in('status', [
        'completed',
        'planned',
        'in_progress',
        'cancelled',
      ]);
    }
    if (from) qy = qy.gte('visit_date', from);
    if (to) qy = qy.lte('visit_date', to);
    if (district) qy = qy.ilike('district', district);

    const schoolIdParam = sp.get('schoolProfileId');
    if (schoolIdParam) {
      qy = qy.eq('school_profile_id', Number(schoolIdParam));
    }

    const { data, error } = await qy;
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          visits: [],
          warning: 'Run PEU visits migration',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const ids = [
      ...new Set(
        (data || []).map((v) => Number(v.school_profile_id)).filter(Boolean)
      ),
    ];
    const nameMap = await schoolNameMap(supabase, ids);

    return NextResponse.json({
      success: true,
      visits: (data || []).map((v) => ({
        ...v,
        school_name: nameMap[Number(v.school_profile_id)] || null,
      })),
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
    const action = String(body.action || 'log_visit');

    // ── Create multi-school day plan ─────────────────────────────────
    if (action === 'create_plan') {
      const agency = await getAgencyRegistration(supabase, companyId);
      if (!agency) {
        return NextResponse.json(
          { error: 'Only DBE/PEU can plan visits' },
          { status: 403 }
        );
      }
      const planDate = String(body.plan_date || body.planned_date || '').slice(
        0,
        10
      );
      if (!/^\d{4}-\d{2}-\d{2}$/.test(planDate)) {
        return NextResponse.json(
          { error: 'plan_date required (YYYY-MM-DD)' },
          { status: 400 }
        );
      }
      const schoolIds = (
        Array.isArray(body.school_ids) ? body.school_ids : []
      )
        .map((n: unknown) => Number(n))
        .filter((n: number) => Number.isFinite(n) && n > 0);
      if (!schoolIds.length) {
        return NextResponse.json(
          { error: 'Select at least one school' },
          { status: 400 }
        );
      }

      // Validate active links
      const { data: links } = await supabase
        .from('school_agency_links')
        .select('school_profile_id')
        .eq('agency_profile_id', companyId)
        .eq('status', 'active')
        .in('school_profile_id', schoolIds);
      const allowed = new Set(
        (links || []).map((l) => Number(l.school_profile_id))
      );
      const okIds = schoolIds.filter((id) => allowed.has(id));
      if (!okIds.length) {
        return NextResponse.json(
          { error: 'None of the schools are active under your department' },
          { status: 400 }
        );
      }

      const schools = await fetchByIds(
        supabase,
        'school_profiles',
        'id, profile_id, school_name, district, circuit',
        okIds
      );
      const byId = new Map(schools.map((s) => [Number(s.id), s]));

      const planId = Date.now();
      const notify = Boolean(body.notify_schools ?? body.notify_school);
      const visitorName = body.visitor_name || null;
      const visitType = body.visit_type || 'monitor';
      const now = new Date().toISOString();

      const rows = okIds.map((sid) => {
        const s = byId.get(sid);
        return {
          agency_profile_id: companyId,
          school_profile_id: sid,
          school_company_id: s?.profile_id ? Number(s.profile_id) : null,
          visit_date: planDate,
          planned_date: planDate,
          plan_id: planId,
          visitor_name: visitorName,
          visitor_user_id: null as string | null,
          status: 'planned',
          visit_type: visitType,
          notify_school: notify,
          notified_at: notify ? now : null,
          district: s?.district ? String(s.district) : body.district || null,
          circuit: s?.circuit ? String(s.circuit) : body.circuit || null,
          notes: body.notes || null,
          checklist: {},
          photo_urls: [],
          metadata: {
            plan_id: planId,
            plan_title:
              body.title ||
              `PEU circuit ${planDate}${visitorName ? ` · ${visitorName}` : ''}`,
            notify_school: notify,
            created_by: gate.userId || null,
          },
        };
      });

      const { data, error } = await supabase
        .from('nsnp_peu_visits')
        .insert(rows)
        .select('*');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      if (notify) {
        for (const row of data || []) {
          const company = Number(row.school_company_id);
          if (!company) continue;
          await logNsnpEvent(supabase, {
            companyId,
            targetCompanyId: company,
            schoolProfileId: Number(row.school_profile_id),
            kind: 'peu_visit_planned',
            title: `PEU visit planned for ${planDate}`,
            body:
              body.notes ||
              `${visitorName || 'Department monitors'} will visit your school.`,
            href: '/dashboard/schools/visits',
            metadata: {
              visit_id: row.id,
              plan_id: planId,
              plan_date: planDate,
            },
          });
        }
      }

      return NextResponse.json({
        success: true,
        plan_id: planId,
        plan_date: planDate,
        visits: data || [],
        count: (data || []).length,
        notify_schools: notify,
        message: `Planned ${okIds.length} school visit(s) on ${planDate}${
          notify ? ' · schools notified' : ' · schools not notified'
        }`,
      });
    }

    // ── Complete / log field pack visit ──────────────────────────────
    if (
      action === 'log_visit' ||
      action === 'complete_visit' ||
      action === 'complete'
    ) {
      const agency = await getAgencyRegistration(supabase, companyId);
      if (!agency && !body.allowSchoolSelfCheck) {
        return NextResponse.json(
          {
            error: 'Only DBE/PEU agencies log official monitor visits',
          },
          { status: 403 }
        );
      }

      const schoolProfileId = Number(body.school_profile_id);
      if (!Number.isFinite(schoolProfileId)) {
        return NextResponse.json(
          { error: 'school_profile_id required' },
          { status: 400 }
        );
      }

      if (agency) {
        const { data: link } = await supabase
          .from('school_agency_links')
          .select('status')
          .eq('agency_profile_id', companyId)
          .eq('school_profile_id', schoolProfileId)
          .eq('status', 'active')
          .maybeSingle();
        if (!link) {
          return NextResponse.json(
            {
              error: 'School is not an approved member of your agency',
            },
            { status: 400 }
          );
        }
      }

      const checklist =
        body.checklist && typeof body.checklist === 'object'
          ? body.checklist
          : {};
      const scores = {
        hygiene: Number(body.hygiene_score ?? scoreFromBool(checklist.hygiene)),
        stock: Number(
          body.stock_score ?? scoreFromBool(checklist.stock_matches_menu)
        ),
        menu: Number(body.menu_score ?? scoreFromBool(checklist.menu_ok)),
        feeding: Number(
          body.feeding_score ?? scoreFromBool(checklist.learners_vs_meals)
        ),
      };
      const overall =
        body.overall_score != null
          ? Number(body.overall_score)
          : Math.round(
              ((scores.hygiene + scores.stock + scores.menu + scores.feeding) /
                4) *
                10
            ) / 10;

      const { data: school } = await supabase
        .from('school_profiles')
        .select('id, profile_id, school_name, district, circuit')
        .eq('id', schoolProfileId)
        .maybeSingle();

      const visitDate =
        body.visit_date || new Date().toISOString().slice(0, 10);
      const existingId = body.visit_id ? Number(body.visit_id) : null;

      // Optional RIAD raised during visit
      let riadIds: number[] = Array.isArray(body.riad_ids)
        ? body.riad_ids.map(Number).filter(Number.isFinite)
        : [];
      if (body.raise_riad && body.riad_title) {
        const riad = await raiseVisitRiad(supabase, {
          companyId,
          school,
          schoolProfileId,
          title: String(body.riad_title),
          description: body.riad_description || body.notes || null,
          riad_type: body.riad_type || 'issue',
          priority: body.riad_priority || 'medium',
          category: body.riad_category || 'Compliance / PEU',
          userId: gate.userId,
        });
        if (riad?.id) riadIds.push(Number(riad.id));
      }

      const payload: Record<string, unknown> = {
        agency_profile_id: companyId,
        school_profile_id: schoolProfileId,
        school_company_id: school?.profile_id
          ? Number(school.profile_id)
          : null,
        visit_date: visitDate,
        planned_date: body.planned_date || visitDate,
        visitor_name: body.visitor_name || null,
        visitor_user_id: null,
        status: body.status || 'completed',
        visit_type: body.visit_type || 'monitor',
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        hygiene_score: scores.hygiene,
        stock_score: scores.stock,
        menu_score: scores.menu,
        feeding_score: scores.feeding,
        overall_score: overall,
        checklist,
        notes: body.notes || null,
        findings_summary: body.findings_summary || body.notes || null,
        photo_urls: body.photo_urls || [],
        accuracy_m: body.accuracy_m ?? null,
        offline_synced: Boolean(body.offline_synced),
        arrived_at: body.arrived_at || null,
        departed_at: body.departed_at || new Date().toISOString(),
        district:
          body.district ||
          (school?.district ? String(school.district) : null),
        circuit:
          body.circuit || (school?.circuit ? String(school.circuit) : null),
        riad_ids: riadIds,
        notify_school:
          body.notify_school != null ? Boolean(body.notify_school) : true,
        updated_at: new Date().toISOString(),
        metadata: {
          ...(body.metadata || {}),
          completed_at: new Date().toISOString(),
          gps_accuracy_m: body.accuracy_m ?? null,
          riad_ids: riadIds,
        },
      };

      let data: Record<string, unknown> | null = null;
      let errorMsg: string | null = null;

      if (existingId && Number.isFinite(existingId)) {
        const { data: updated, error } = await supabase
          .from('nsnp_peu_visits')
          .update(payload)
          .eq('id', existingId)
          .eq('agency_profile_id', companyId)
          .select('*')
          .single();
        data = updated as Record<string, unknown> | null;
        errorMsg = error?.message || null;
      } else {
        // Prefer completing an existing planned visit for this school+date
        const { data: planned } = await supabase
          .from('nsnp_peu_visits')
          .select('id')
          .eq('agency_profile_id', companyId)
          .eq('school_profile_id', schoolProfileId)
          .eq('status', 'planned')
          .order('planned_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (planned?.id) {
          const { data: updated, error } = await supabase
            .from('nsnp_peu_visits')
            .update(payload)
            .eq('id', planned.id)
            .select('*')
            .single();
          data = updated as Record<string, unknown> | null;
          errorMsg = error?.message || null;
        } else {
          const { data: inserted, error } = await supabase
            .from('nsnp_peu_visits')
            .insert(payload)
            .select('*')
            .single();
          data = inserted as Record<string, unknown> | null;
          errorMsg = error?.message || null;
        }
      }

      if (errorMsg || !data) {
        return NextResponse.json(
          { error: errorMsg || 'Visit save failed' },
          { status: 400 }
        );
      }

      // Notify school of completed audit if enabled
      const notify =
        data.notify_school !== false &&
        data.school_company_id != null;
      if (notify) {
        await logNsnpEvent(supabase, {
          companyId,
          targetCompanyId: Number(data.school_company_id),
          schoolProfileId,
          kind: 'peu_visit_completed',
          title: `PEU visit result · score ${overall}`,
          body:
            String(data.findings_summary || data.notes || '').slice(0, 200) ||
            'Monitor visit completed — open Visits for checklist and photos.',
          href: '/dashboard/schools/visits',
          metadata: {
            visit_id: data.id,
            overall_score: overall,
            riad_ids: riadIds,
          },
        });
      }

      return NextResponse.json({
        success: true,
        visit: data,
        riad_ids: riadIds,
        message: `Visit logged · score ${overall}${
          riadIds.length ? ` · ${riadIds.length} RIAD linked` : ''
        }`,
      });
    }

    // ── Cancel plan / planned visit ──────────────────────────────────
    if (action === 'cancel_plan' || action === 'cancel_visit') {
      const planId = body.plan_id != null ? Number(body.plan_id) : null;
      const visitId = body.visit_id != null ? Number(body.visit_id) : null;
      if (planId) {
        const { error } = await supabase
          .from('nsnp_peu_visits')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('agency_profile_id', companyId)
          .eq('plan_id', planId)
          .eq('status', 'planned');
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ success: true, cancelled_plan: planId });
      }
      if (visitId) {
        const { error } = await supabase
          .from('nsnp_peu_visits')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', visitId)
          .eq('agency_profile_id', companyId);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ success: true, cancelled: visitId });
      }
      return NextResponse.json(
        { error: 'plan_id or visit_id required' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

function scoreFromBool(v: unknown): number {
  if (v === true) return 100;
  if (v === false) return 40;
  return 70;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function uniq(vals: unknown[]): string[] {
  return [
    ...new Set(
      vals
        .map((v) => (v == null ? '' : String(v).trim()))
        .filter(Boolean)
    ),
  ].sort();
}

function emptyFacets() {
  return {
    provinces: [] as string[],
    districts: [] as string[],
    circuits: [] as string[],
    cmcs: [] as string[],
    municipalities: [] as string[],
  };
}

async function schoolNameMap(
  supabase: ReturnType<typeof getSupabaseServer>,
  ids: number[]
) {
  const names: Record<number, string> = {};
  if (!ids.length) return names;
  const { data: schools } = await supabase
    .from('school_profiles')
    .select('id, school_name')
    .in('id', ids.slice(0, 500));
  for (const s of schools || []) {
    names[Number(s.id)] = String(s.school_name);
  }
  return names;
}

function groupPlans(visits: Array<Record<string, unknown>>) {
  const map = new Map<
    string,
    {
      plan_id: number | string;
      plan_date: string;
      title: string;
      visitor_name: string | null;
      notify_schools: boolean;
      status: string;
      schools: Array<Record<string, unknown>>;
      count: number;
    }
  >();
  for (const v of visits) {
    const pid = v.plan_id != null ? Number(v.plan_id) : null;
    const date = String(v.planned_date || v.visit_date || '').slice(0, 10);
    const key = pid ? `p:${pid}` : `d:${date}:${v.visitor_name || ''}`;
    const row = map.get(key) || {
      plan_id: pid || key,
      plan_date: date,
      title:
        String(
          (v.metadata as { plan_title?: string })?.plan_title ||
            `Circuit ${date}`
        ),
      visitor_name: v.visitor_name ? String(v.visitor_name) : null,
      notify_schools: Boolean(v.notify_school),
      status: String(v.status || 'planned'),
      schools: [] as Array<Record<string, unknown>>,
      count: 0,
    };
    row.schools.push(v);
    row.count += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) =>
    b.plan_date.localeCompare(a.plan_date)
  );
}

async function enrichPlanSchoolNames(
  supabase: ReturnType<typeof getSupabaseServer>,
  plans: Array<{ schools: Array<Record<string, unknown>> }>
) {
  const ids = new Set<number>();
  for (const p of plans) {
    for (const s of p.schools) {
      ids.add(Number(s.school_profile_id));
    }
  }
  const names = await schoolNameMap(supabase, [...ids]);
  for (const p of plans) {
    for (const s of p.schools) {
      s.school_name = names[Number(s.school_profile_id)] || null;
    }
  }
}

async function plannedVsActualReport(
  supabase: ReturnType<typeof getSupabaseServer>,
  agencyId: number,
  opts: { from: string; to: string; district: string }
) {
  let qy = supabase
    .from('nsnp_peu_visits')
    .select('*')
    .eq('agency_profile_id', agencyId)
    .or(
      `and(planned_date.gte.${opts.from},planned_date.lte.${opts.to}),and(visit_date.gte.${opts.from},visit_date.lte.${opts.to})`
    )
    .limit(1000);

  const { data, error } = await qy;
  let visits = data || [];
  if (error) {
    // Fallback without or
    const { data: d2 } = await supabase
      .from('nsnp_peu_visits')
      .select('*')
      .eq('agency_profile_id', agencyId)
      .gte('visit_date', opts.from)
      .lte('visit_date', opts.to)
      .limit(1000);
    visits = d2 || [];
  }

  if (opts.district) {
    visits = visits.filter(
      (v) =>
        String(v.district || '').toLowerCase() === opts.district.toLowerCase()
    );
  }

  const planned = visits.filter((v) =>
    ['planned', 'completed', 'cancelled', 'in_progress'].includes(
      String(v.status)
    )
  );
  const plannedOnly = visits.filter((v) => String(v.status) === 'planned');
  const completed = visits.filter((v) => String(v.status) === 'completed');
  const cancelled = visits.filter((v) => String(v.status) === 'cancelled');

  // Schools planned that were completed (same school+date or plan)
  const completedKeys = new Set(
    completed.map(
      (v) =>
        `${v.school_profile_id}:${String(v.planned_date || v.visit_date).slice(0, 10)}`
    )
  );
  const plannedKeys = visits.filter((v) =>
    ['planned', 'completed'].includes(String(v.status))
  );
  let hit = 0;
  let miss = 0;
  for (const v of plannedKeys) {
    if (String(v.status) === 'planned') {
      const key = `${v.school_profile_id}:${String(v.planned_date || v.visit_date).slice(0, 10)}`;
      // still open future/past without complete
      if (!completedKeys.has(key) && String(v.planned_date || '') < today()) {
        miss += 1;
      }
    } else if (String(v.status) === 'completed') {
      hit += 1;
    }
  }

  const byDistrict = new Map<
    string,
    { district: string; planned: number; completed: number; cancelled: number }
  >();
  for (const v of visits) {
    const d = String(v.district || 'Unknown');
    const row = byDistrict.get(d) || {
      district: d,
      planned: 0,
      completed: 0,
      cancelled: 0,
    };
    if (String(v.status) === 'planned') row.planned += 1;
    if (String(v.status) === 'completed') row.completed += 1;
    if (String(v.status) === 'cancelled') row.cancelled += 1;
    byDistrict.set(d, row);
  }

  const ids = [
    ...new Set(visits.map((v) => Number(v.school_profile_id)).filter(Boolean)),
  ];
  const names = await schoolNameMap(supabase, ids);

  const coverage_pct =
    hit + miss > 0 ? Math.round((hit / (hit + miss)) * 1000) / 10 : null;

  return {
    success: true,
    period: { from: opts.from, to: opts.to },
    kpis: {
      planned_open: plannedOnly.length,
      completed: completed.length,
      cancelled: cancelled.length,
      total_logged: visits.length,
      plan_hit: hit,
      plan_miss: miss,
      coverage_pct,
      avg_score:
        completed.length > 0
          ? Math.round(
              (completed.reduce(
                (n, v) => n + Number(v.overall_score || 0),
                0
              ) /
                completed.length) *
                10
            ) / 10
          : null,
    },
    byDistrict: [...byDistrict.values()].sort(
      (a, b) => b.completed + b.planned - (a.completed + a.planned)
    ),
    visits: visits.slice(0, 200).map((v) => ({
      ...v,
      school_name: names[Number(v.school_profile_id)] || null,
    })),
  };
}

async function raiseVisitRiad(
  supabase: ReturnType<typeof getSupabaseServer>,
  opts: {
    companyId: number;
    school: Record<string, unknown> | null | undefined;
    schoolProfileId: number;
    title: string;
    description: string | null;
    riad_type: string;
    priority: string;
    category: string;
    userId?: string | null;
  }
): Promise<{ id: number } | null> {
  try {
    const subjectCompanyId = opts.school?.profile_id
      ? Number(opts.school.profile_id)
      : null;
    if (!subjectCompanyId) return null;

    const priority = String(opts.priority || 'medium').toLowerCase();
    const severityMap: Record<string, number> = {
      low: 2,
      medium: 3,
      high: 4,
      critical: 5,
    };

    const { data, error } = await supabase
      .from('riad_logs')
      .insert({
        profile_id: subjectCompanyId,
        module: 'schools',
        riad_type: opts.riad_type || 'issue',
        title: opts.title,
        description: opts.description,
        status: 'active',
        priority,
        severity: severityMap[priority] ?? 3,
        category: opts.category,
        stakeholder_type: 'customer',
        stakeholder_name: String(opts.school?.school_name || 'School'),
        owner_id: subjectCompanyId,
        stakeholder_id: subjectCompanyId,
        related_entity_type: 'school',
        related_entity_id: opts.schoolProfileId,
        source: 'peu_visit',
        metadata: {
          target_type: 'school',
          school_profile_id: opts.schoolProfileId,
          subject_name: opts.school?.school_name,
          raised_by_agency_profile_id: opts.companyId,
          raised_by_user_id: opts.userId || null,
          from_peu_visit: true,
        },
      })
      .select('id')
      .single();

    if (error || !data) return null;
    return { id: Number(data.id) };
  } catch {
    return null;
  }
}
