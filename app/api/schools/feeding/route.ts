import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';

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

    const from = sp.get('from') || '';
    const to = sp.get('to') || '';

    const supabase = getSupabaseServer();
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }

    let q = supabase
      .from('school_feeding_days')
      .select('*')
      .eq('school_profile_id', school.id)
      .order('feed_date', { ascending: false })
      .limit(500);
    if (from) q = q.gte('feed_date', from);
    if (to) q = q.lte('feed_date', to);

    const { data, error: fErr } = await q;
    if (fErr) {
      return NextResponse.json({ error: fErr.message }, { status: 400 });
    }

    const rows = data || [];
    const summary = {
      days: rows.length,
      planned: rows.reduce((s, r) => s + Number(r.planned_meals || 0), 0),
      served: rows.reduce((s, r) => s + Number(r.served_meals || 0), 0),
      waste: rows.reduce((s, r) => s + Number(r.waste_meals || 0), 0),
    };

    return NextResponse.json({ success: true, feeding: rows, summary });
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

    const feedDate =
      body.feed_date || new Date().toISOString().slice(0, 10);
    const mealType = body.meal_type || 'lunch';

    const row = {
      school_profile_id: school.id,
      profile_id: companyId,
      feed_date: feedDate,
      meal_type: mealType,
      menu_name: body.menu_name || null,
      planned_meals: Number(body.planned_meals || 0),
      served_meals: Number(body.served_meals || 0),
      waste_meals: Number(body.waste_meals || 0),
      learners_present: Number(body.learners_present || 0),
      notes: body.notes || null,
      ingredients: body.ingredients || [],
      created_by: gate.userId || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error: uErr } = await supabase
      .from('school_feeding_days')
      .upsert(row, { onConflict: 'school_profile_id,feed_date,meal_type' })
      .select('*')
      .single();

    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, feeding: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
