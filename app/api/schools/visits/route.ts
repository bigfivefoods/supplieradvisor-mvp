import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getAgencyRegistration } from '@/lib/schools/approved-catalogue';

/**
 * W1 PEU / monitor field visits.
 * Agency posts visits against approved schools.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const schoolId = request.nextUrl.searchParams.get('schoolProfileId');
    const mode = String(request.nextUrl.searchParams.get('mode') || 'agency');

    let q = supabase
      .from('nsnp_peu_visits')
      .select('*')
      .order('visit_date', { ascending: false })
      .limit(200);

    if (mode === 'school' || schoolId) {
      // school sees visits about them
      if (schoolId) {
        q = q.eq('school_profile_id', Number(schoolId));
      } else {
        const { data: school } = await supabase
          .from('school_profiles')
          .select('id')
          .eq('profile_id', companyId)
          .maybeSingle();
        if (!school) {
          return NextResponse.json({ success: true, visits: [] });
        }
        q = q.eq('school_profile_id', school.id);
      }
    } else {
      q = q.eq('agency_profile_id', companyId);
    }

    const { data, error } = await q;
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          visits: [],
          warning: 'Run 20260726_nsnp_w1_w5_expansion.sql',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Enrich school names
    const ids = [
      ...new Set(
        (data || [])
          .map((v) => Number(v.school_profile_id))
          .filter(Boolean)
      ),
    ];
    let names: Record<number, string> = {};
    if (ids.length) {
      const { data: schools } = await supabase
        .from('school_profiles')
        .select('id, school_name')
        .in('id', ids);
      for (const s of schools || []) {
        names[Number(s.id)] = String(s.school_name);
      }
    }

    return NextResponse.json({
      success: true,
      visits: (data || []).map((v) => ({
        ...v,
        school_name: names[Number(v.school_profile_id)] || null,
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
    const agency = await getAgencyRegistration(supabase, companyId);
    if (!agency && !body.allowSchoolSelfCheck) {
      return NextResponse.json(
        { error: 'Only DBE/PEU agencies log official monitor visits' },
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

    // Must be approved link if agency
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
          { error: 'School is not an approved member of your agency' },
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
      .select('profile_id')
      .eq('id', schoolProfileId)
      .maybeSingle();

    const { data, error } = await supabase
      .from('nsnp_peu_visits')
      .insert({
        agency_profile_id: companyId,
        school_profile_id: schoolProfileId,
        school_company_id: school?.profile_id
          ? Number(school.profile_id)
          : null,
        visit_date: body.visit_date || new Date().toISOString().slice(0, 10),
        visitor_name: body.visitor_name || null,
        visitor_user_id: gate.userId || null,
        status: body.status || 'completed',
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        hygiene_score: scores.hygiene,
        stock_score: scores.stock,
        menu_score: scores.menu,
        feeding_score: scores.feeding,
        overall_score: overall,
        checklist,
        notes: body.notes || null,
        photo_urls: body.photo_urls || [],
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, visit: data });
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
