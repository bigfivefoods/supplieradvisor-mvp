import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';

export const runtime = 'nodejs';

/**
 * School ratings:
 * GET  ?companyId=&view=isp|food|all
 * POST action: rate_isp | rate_food | delete_isp_rating | delete_food_rating
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
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }
    const schoolId = Number(school.id);
    const view = String(sp.get('view') || 'all');

    // Linked SPs for rating dropdown
    const { data: links } = await supabase
      .from('school_isp_links')
      .select('isp_profile_id, status')
      .eq('school_profile_id', schoolId)
      .eq('status', 'active')
      .limit(50);
    const ispIds = [
      ...new Set(
        (links || [])
          .map((l) => Number(l.isp_profile_id))
          .filter((n) => Number.isFinite(n))
      ),
    ];
    const ispNames: Record<number, string> = {};
    if (ispIds.length) {
      const { data: isps } = await supabase
        .from('nsnp_isp_profiles')
        .select('profile_id, trading_name, delivery_otifef_pct, csd_number')
        .in('profile_id', ispIds);
      for (const i of isps || []) {
        ispNames[Number(i.profile_id)] = String(
          i.trading_name || `SP ${i.profile_id}`
        );
      }
      const missing = ispIds.filter((id) => !ispNames[id]);
      if (missing.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, trading_name, legal_name')
          .in('id', missing);
        for (const p of profs || []) {
          ispNames[Number(p.id)] = String(
            p.trading_name || p.legal_name || `SP ${p.id}`
          );
        }
      }
    }

    let isp_ratings: unknown[] = [];
    let food_ratings: unknown[] = [];

    if (view === 'isp' || view === 'all') {
      const { data, error: rErr } = await supabase
        .from('school_isp_ratings')
        .select('*')
        .eq('school_profile_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (rErr && !/does not exist|schema cache/i.test(rErr.message)) {
        return NextResponse.json({ error: rErr.message }, { status: 400 });
      }
      isp_ratings = (data || []).map((r) => ({
        ...r,
        isp_name: ispNames[Number(r.isp_profile_id)] || `SP ${r.isp_profile_id}`,
      }));
    }

    if (view === 'food' || view === 'all') {
      const { data, error: fErr } = await supabase
        .from('school_food_ratings')
        .select('*')
        .eq('school_profile_id', schoolId)
        .order('feed_date', { ascending: false })
        .limit(100);
      if (fErr && !/does not exist|schema cache/i.test(fErr.message)) {
        return NextResponse.json({ error: fErr.message }, { status: 400 });
      }
      food_ratings = data || [];
    }

    const linked_isps = ispIds.map((id) => ({
      isp_profile_id: id,
      name: ispNames[id] || `SP ${id}`,
    }));

    return NextResponse.json({
      success: true,
      schoolId,
      linked_isps,
      isp_ratings,
      food_ratings,
      message:
        isp_ratings.length === 0 && food_ratings.length === 0
          ? 'Run migration 20260729_school_sp_otifef_ratings.sql if tables are missing'
          : undefined,
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
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }
    const schoolId = Number(school.id);
    const action = String(body.action || '');

    const star = (v: unknown) => {
      if (v == null || v === '') return null;
      const n = Number(v);
      if (!Number.isFinite(n)) return null;
      return Math.min(5, Math.max(1, Math.round(n * 2) / 2));
    };

    if (action === 'rate_isp') {
      const ispProfileId = Number(body.isp_profile_id);
      const overall = star(body.overall_rating);
      if (!Number.isFinite(ispProfileId) || overall == null) {
        return NextResponse.json(
          { error: 'isp_profile_id and overall_rating (1–5) required' },
          { status: 400 }
        );
      }
      // Must be linked
      const { data: link } = await supabase
        .from('school_isp_links')
        .select('id')
        .eq('school_profile_id', schoolId)
        .eq('isp_profile_id', ispProfileId)
        .eq('status', 'active')
        .maybeSingle();
      if (!link) {
        return NextResponse.json(
          { error: 'Only rate linked active service providers' },
          { status: 400 }
        );
      }

      const row = {
        school_profile_id: schoolId,
        profile_id: companyId,
        isp_profile_id: ispProfileId,
        overall_rating: overall,
        on_time_rating: star(body.on_time_rating),
        in_full_rating: star(body.in_full_rating),
        error_free_rating: star(body.error_free_rating),
        communication_rating: star(body.communication_rating),
        constructive_feedback:
          body.constructive_feedback != null
            ? String(body.constructive_feedback).trim() || null
            : null,
        would_recommend:
          body.would_recommend === true || body.would_recommend === false
            ? Boolean(body.would_recommend)
            : null,
        period_from: body.period_from || null,
        period_to: body.period_to || null,
        po_id: body.po_id != null ? Number(body.po_id) : null,
        delivery_id: body.delivery_id != null ? Number(body.delivery_id) : null,
        created_by: gate.userId || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error: iErr } = await supabase
        .from('school_isp_ratings')
        .insert(row)
        .select('*')
        .single();
      if (iErr) {
        if (/does not exist|schema cache/i.test(iErr.message)) {
          return NextResponse.json(
            {
              error:
                'Run migration 20260729_school_sp_otifef_ratings.sql for SP ratings',
            },
            { status: 400 }
          );
        }
        return NextResponse.json({ error: iErr.message }, { status: 400 });
      }

      // Soft-refresh SP average rating
      try {
        const { data: all } = await supabase
          .from('school_isp_ratings')
          .select('overall_rating')
          .eq('isp_profile_id', ispProfileId)
          .limit(500);
        if (all?.length) {
          const avg =
            Math.round(
              (all.reduce((n, r) => n + Number(r.overall_rating || 0), 0) /
                all.length) *
                10
            ) / 10;
          await supabase
            .from('nsnp_isp_profiles')
            .update({ avg_school_rating: avg })
            .eq('profile_id', ispProfileId);
        }
      } catch {
        /* soft */
      }

      return NextResponse.json({
        success: true,
        rating: data,
        message: 'Thank you — SP rating saved',
      });
    }

    if (action === 'rate_food') {
      const overall = star(body.overall_rating);
      if (overall == null) {
        return NextResponse.json(
          { error: 'overall_rating (1–5) required' },
          { status: 400 }
        );
      }
      const row = {
        school_profile_id: schoolId,
        profile_id: companyId,
        feed_date:
          body.feed_date || new Date().toISOString().slice(0, 10),
        meal_type: String(body.meal_type || 'lunch'),
        overall_rating: overall,
        taste_rating: star(body.taste_rating),
        portion_rating: star(body.portion_rating),
        appearance_rating: star(body.appearance_rating),
        temperature_rating: star(body.temperature_rating),
        menu_adherence_rating: star(body.menu_adherence_rating),
        constructive_feedback:
          body.constructive_feedback != null
            ? String(body.constructive_feedback).trim() || null
            : null,
        what_worked:
          body.what_worked != null
            ? String(body.what_worked).trim() || null
            : null,
        what_to_improve:
          body.what_to_improve != null
            ? String(body.what_to_improve).trim() || null
            : null,
        isp_profile_id:
          body.isp_profile_id != null ? Number(body.isp_profile_id) : null,
        recipe_name: body.recipe_name || null,
        menu_name: body.menu_name || null,
        created_by: gate.userId || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error: iErr } = await supabase
        .from('school_food_ratings')
        .insert(row)
        .select('*')
        .single();
      if (iErr) {
        if (/does not exist|schema cache/i.test(iErr.message)) {
          return NextResponse.json(
            {
              error:
                'Run migration 20260729_school_sp_otifef_ratings.sql for food ratings',
            },
            { status: 400 }
          );
        }
        return NextResponse.json({ error: iErr.message }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        rating: data,
        message: 'Food rating saved — constructive feedback recorded',
      });
    }

    if (action === 'delete_isp_rating' || action === 'delete_food_rating') {
      const id = Number(body.id);
      if (!Number.isFinite(id)) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
      }
      const table =
        action === 'delete_isp_rating'
          ? 'school_isp_ratings'
          : 'school_food_ratings';
      const { error: dErr } = await supabase
        .from(table)
        .delete()
        .eq('id', id)
        .eq('school_profile_id', schoolId);
      if (dErr) {
        return NextResponse.json({ error: dErr.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
