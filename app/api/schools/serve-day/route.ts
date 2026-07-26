import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import { resolveCatalogueContext } from '@/lib/schools/approved-catalogue';
import {
  estimateFromProducts,
  evaluateNutrition,
  pickNorm,
  type NutritionNorm,
} from '@/lib/schools/nutrition';
import { refreshSchoolAlerts } from '@/lib/schools/alerts';

/**
 * W1 serve-day: one payload for today — menu, stock, attendance, feed, nutrition, alerts.
 * POST completes serve-day (attendance + feeding + optional waste/cost).
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

    const date =
      request.nextUrl.searchParams.get('date') ||
      new Date().toISOString().slice(0, 10);
    const mealType =
      request.nextUrl.searchParams.get('mealType') || 'lunch';

    const supabase = getSupabaseServer();
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }
    const schoolId = Number(school.id);

    const catalogue = await resolveCatalogueContext(supabase, companyId, {
      schoolProfileId: schoolId,
    });

    // Active menu
    const { data: menus } = await supabase
      .from('school_menu_cycles')
      .select('*')
      .eq('school_profile_id', schoolId)
      .eq('active', true)
      .limit(1);
    const menu = menus?.[0] || null;
    const dayOfWeek = new Date(date + 'T12:00:00').getDay(); // 0=Sun
    // Map JS day to menu day 1=Mon..7=Sun
    const menuDay = dayOfWeek === 0 ? 7 : dayOfWeek;
    const items = Array.isArray(menu?.items) ? menu!.items : [];
    const todayDish = items.find(
      (it: { day?: number; meal_type?: string }) =>
        Number(it.day) === menuDay &&
        String(it.meal_type || 'lunch') === mealType
    ) as
      | {
          day: number;
          meal_type: string;
          dish: string;
          approved_product_ids?: number[];
        }
      | undefined;

    // Stock snapshot
    const { data: stock } = await supabase
      .from('school_kitchen_stock')
      .select('*')
      .eq('school_profile_id', schoolId)
      .limit(200);

    // Attendance today
    const { data: attendance } = await supabase
      .from('school_attendance_days')
      .select('*')
      .eq('school_profile_id', schoolId)
      .eq('attendance_date', date)
      .is('grade', null)
      .maybeSingle();

    // Feeding today
    const { data: feeding } = await supabase
      .from('school_feeding_days')
      .select('*')
      .eq('school_profile_id', schoolId)
      .eq('feed_date', date)
      .eq('meal_type', mealType)
      .maybeSingle();

    // Nutrition norms
    const { data: normsRaw } = await supabase
      .from('nsnp_nutrition_norms')
      .select('*')
      .eq('active', true)
      .limit(20);
    const norms = (normsRaw || []) as NutritionNorm[];
    const phase = school.phase != null ? String(school.phase) : null;
    const norm = pickNorm(norms, mealType, phase);

    // Product nutrients for today's dish
    let nutrition = null;
    const pids = todayDish?.approved_product_ids || [];
    if (pids.length) {
      const { data: prods } = await supabase
        .from('nsnp_approved_products')
        .select('id, name, brand_name, energy_kcal, protein_g')
        .in('id', pids);
      const est = estimateFromProducts(prods || []);
      nutrition = {
        ...evaluateNutrition(est, norm),
        products: prods || [],
        dish: todayDish?.dish || null,
      };
    }

    // Open alerts
    await refreshSchoolAlerts(
      supabase,
      schoolId,
      companyId,
      catalogue.agencyProfileId
    );
    const { data: alerts } = await supabase
      .from('nsnp_alerts')
      .select('*')
      .eq('school_profile_id', schoolId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(20);

    const enrolled = Number(school.learner_count_enrolled || 0);
    const present =
      attendance?.present != null
        ? Number(attendance.present)
        : enrolled;

    return NextResponse.json({
      success: true,
      date,
      mealType,
      school: {
        id: schoolId,
        name: school.school_name,
        phase: school.phase,
        enrolled,
        verified: school.learner_count_verified,
      },
      menu: menu
        ? { id: menu.id, name: menu.name, day: menuDay, dish: todayDish || null }
        : null,
      stock: stock || [],
      stockZero: (stock || []).filter((s) => Number(s.qty_on_hand || 0) <= 0)
        .length,
      attendance: attendance || null,
      feeding: feeding || null,
      nutrition,
      norm,
      suggestedServed: present,
      alerts: alerts || [],
      catalogue: {
        agencyName: catalogue.agencyName,
        source: catalogue.source,
      },
      complete: Boolean(
        feeding &&
          Number(feeding.served_meals || 0) > 0 &&
          (attendance || enrolled === 0)
      ),
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

    const date = body.date || new Date().toISOString().slice(0, 10);
    const mealType = body.meal_type || 'lunch';
    const supabase = getSupabaseServer();
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }
    const schoolId = Number(school.id);

    const present = Number(
      body.present ?? school.learner_count_enrolled ?? 0
    );
    const enrolled = Number(
      body.enrolled ?? school.learner_count_enrolled ?? present
    );
    const planned = Number(body.planned_meals ?? present);
    const served = Number(body.served_meals ?? present);
    const waste = Number(body.waste_meals ?? 0);
    const cost = body.cost_amount != null ? Number(body.cost_amount) : null;

    // Attendance whole-school
    await supabase
      .from('school_attendance_days')
      .delete()
      .eq('school_profile_id', schoolId)
      .eq('attendance_date', date)
      .is('grade', null);

    await supabase.from('school_attendance_days').insert({
      school_profile_id: schoolId,
      profile_id: companyId,
      attendance_date: date,
      grade: null,
      enrolled,
      present,
      absent: Math.max(0, enrolled - present),
      created_by: gate.userId || null,
    });

    // Nutrition if provided or recompute
    let nutritionPass: boolean | null = null;
    let energy: number | null = null;
    let protein: number | null = null;
    if (body.nutrition_pass != null) {
      nutritionPass = Boolean(body.nutrition_pass);
      energy = body.nutrition_energy_kcal ?? null;
      protein = body.nutrition_protein_g ?? null;
    }

    const feedRow = {
      school_profile_id: schoolId,
      profile_id: companyId,
      feed_date: date,
      meal_type: mealType,
      menu_name: body.menu_name || null,
      planned_meals: planned,
      served_meals: served,
      waste_meals: waste,
      learners_present: present,
      notes: body.notes || null,
      ingredients: body.ingredients || [],
      nutrition_energy_kcal: energy,
      nutrition_protein_g: protein,
      nutrition_pass: nutritionPass,
      cost_amount: cost,
      serve_day_complete: true,
      created_by: gate.userId || null,
      updated_at: new Date().toISOString(),
    };

    const { data: feeding, error: fErr } = await supabase
      .from('school_feeding_days')
      .upsert(feedRow, {
        onConflict: 'school_profile_id,feed_date,meal_type',
      })
      .select('*')
      .single();

    if (fErr) {
      // soft columns missing — retry without extras
      const { data: feeding2, error: f2 } = await supabase
        .from('school_feeding_days')
        .upsert(
          {
            school_profile_id: schoolId,
            profile_id: companyId,
            feed_date: date,
            meal_type: mealType,
            menu_name: body.menu_name || null,
            planned_meals: planned,
            served_meals: served,
            waste_meals: waste,
            learners_present: present,
            notes: body.notes || null,
            created_by: gate.userId || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'school_profile_id,feed_date,meal_type' }
        )
        .select('*')
        .single();
      if (f2) {
        return NextResponse.json({ error: f2.message }, { status: 400 });
      }
      await refreshSchoolAlerts(supabase, schoolId, companyId);
      return NextResponse.json({
        success: true,
        feeding: feeding2,
        complete: true,
      });
    }

    await refreshSchoolAlerts(supabase, schoolId, companyId);
    return NextResponse.json({
      success: true,
      feeding,
      complete: true,
      cost_per_meal:
        cost != null && served > 0
          ? Math.round((cost / served) * 10000) / 10000
          : null,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
