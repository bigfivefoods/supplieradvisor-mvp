import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  filterApprovedProductIds,
  getAgencyRegistration,
  resolveCatalogueContext,
} from '@/lib/schools/approved-catalogue';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import { fetchAgencySchoolLinks } from '@/lib/schools/supabase-page';
import {
  buildProgrammePlan,
  schoolLearnerCount,
  type CategoryBudget,
  type Recipe,
  type RecipeLine,
  type SchoolLearners,
} from '@/lib/schools/recipe-mrp';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * NSNP Recipes (BOM) + category budgets + live MPS/MRP plans.
 *
 * GET  ?companyId=&view=recipes|budgets|plan
 *      plan params: from, to, schoolProfileId (optional for school self)
 * POST action: save_recipe | delete_recipe | save_budget | delete_budget
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
    const view = String(sp.get('view') || 'recipes');

    // Resolve agency context for school/SP
    let agencyProfileId: number | null = agency
      ? companyId
      : null;
    let role: 'agency' | 'school' | 'isp' = agency ? 'agency' : 'school';

    if (!agency) {
      const { data: isp } = await supabase
        .from('nsnp_isp_profiles')
        .select('profile_id')
        .eq('profile_id', companyId)
        .maybeSingle();
      if (isp) {
        role = 'isp';
        const { data: al } = await supabase
          .from('nsnp_isp_agency_links')
          .select('agency_profile_id, status')
          .eq('isp_profile_id', companyId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();
        agencyProfileId = al?.agency_profile_id
          ? Number(al.agency_profile_id)
          : null;
      } else {
        const ctx = await resolveCatalogueContext(supabase, companyId);
        agencyProfileId = ctx.agencyProfileId;
        role = 'school';
      }
    }

    if (!agencyProfileId) {
      return NextResponse.json({
        success: true,
        role,
        recipes: [],
        budgets: [],
        plan: null,
        message:
          role === 'agency'
            ? 'Register as DBE/PEU first'
            : 'Join a department to see programme recipes and MPS/MRP',
      });
    }

    if (view === 'recipes' || view === 'all') {
      const recipes = await loadRecipes(supabase, agencyProfileId);
      if (view === 'recipes') {
        return NextResponse.json({
          success: true,
          role,
          canEdit: role === 'agency',
          agencyProfileId,
          recipes,
        });
      }
    }

    if (view === 'budgets') {
      const budgets = await loadBudgets(supabase, agencyProfileId, sp);
      return NextResponse.json({
        success: true,
        role,
        canEdit: role === 'agency',
        budgets,
      });
    }

    // plan view
    const from =
      sp.get('from') ||
      new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .slice(0, 10);
    const to =
      sp.get('to') ||
      new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
        .toISOString()
        .slice(0, 10);

    const recipes = await loadRecipes(supabase, agencyProfileId);
    const activeRecipes = recipes.filter((r) => r.active !== false);
    // Default schedule: each active recipe serves 5x/week if meal_type set
    // breakfast recipes 5/week, lunch 5/week — if multiple per type, split evenly
    const byMeal = new Map<string, Recipe[]>();
    for (const r of activeRecipes) {
      const mt = String(r.meal_type || 'lunch');
      const list = byMeal.get(mt) || [];
      list.push(r);
      byMeal.set(mt, list);
    }
    const recipeSchedule: Array<{ recipe: Recipe; servesPerWeek: number }> =
      [];
    for (const [, list] of byMeal) {
      const each = list.length ? 5 / list.length : 0;
      for (const recipe of list) {
        recipeSchedule.push({
          recipe,
          servesPerWeek: Math.round(each * 100) / 100,
        });
      }
    }

    const budgets = await loadBudgets(supabase, agencyProfileId, sp, from, to);

    // Schools under agency
    let schoolLearners: SchoolLearners[] = [];
    const ispNames = new Map<number, string>();

    if (role === 'school') {
      const { school } = await getOrCreateSchoolProfile(supabase, companyId);
      if (school) {
        schoolLearners = [
          {
            school_profile_id: Number(school.id),
            school_name: String(school.school_name || 'School'),
            emis_number: school.emis_number != null ? String(school.emis_number) : null,
            district: school.district != null ? String(school.district) : null,
            learners: schoolLearnerCount(school as Record<string, unknown>),
            isp_profile_ids: await schoolIspIds(supabase, Number(school.id)),
          },
        ];
      }
    } else if (role === 'isp') {
      const { data: links } = await supabase
        .from('school_isp_links')
        .select('school_profile_id, status')
        .eq('isp_profile_id', companyId)
        .eq('status', 'active')
        .limit(500);
      const ids = [
        ...new Set(
          (links || [])
            .map((l) => Number(l.school_profile_id))
            .filter((n) => Number.isFinite(n))
        ),
      ];
      if (ids.length) {
        const { data: schools } = await supabase
          .from('school_profiles')
          .select(
            'id, school_name, emis_number, district, final_nsnp_approved_enrol, learner_count_nsnp_eligible, learner_count_enrolled'
          )
          .in('id', ids);
        schoolLearners = (schools || []).map((s) => ({
          school_profile_id: Number(s.id),
          school_name: String(s.school_name || `School ${s.id}`),
          emis_number: s.emis_number != null ? String(s.emis_number) : null,
          district: s.district != null ? String(s.district) : null,
          learners: schoolLearnerCount(s as Record<string, unknown>),
          isp_profile_ids: [companyId],
        }));
      }
      const { data: isp } = await supabase
        .from('nsnp_isp_profiles')
        .select('trading_name')
        .eq('profile_id', companyId)
        .maybeSingle();
      ispNames.set(
        companyId,
        String(isp?.trading_name || `SP ${companyId}`)
      );
    } else {
      // agency — all active schools
      const links = await fetchAgencySchoolLinks(supabase, agencyProfileId, [
        'active',
      ]).catch(() => []);
      const ids = [
        ...new Set(
          links
            .map((l) => Number(l.school_profile_id))
            .filter((n) => Number.isFinite(n) && n > 0)
        ),
      ];
      if (ids.length) {
        const { data: schools } = await supabase
          .from('school_profiles')
          .select(
            'id, school_name, emis_number, district, final_nsnp_approved_enrol, learner_count_nsnp_eligible, learner_count_enrolled'
          )
          .in('id', ids);
        // ISP links for schools
        const { data: ispLinks } = await supabase
          .from('school_isp_links')
          .select('school_profile_id, isp_profile_id, status')
          .in('school_profile_id', ids)
          .eq('status', 'active')
          .limit(2000);
        const ispsBySchool = new Map<number, number[]>();
        const ispIdSet = new Set<number>();
        for (const l of ispLinks || []) {
          const sid = Number(l.school_profile_id);
          const iid = Number(l.isp_profile_id);
          if (!Number.isFinite(sid) || !Number.isFinite(iid)) continue;
          const arr = ispsBySchool.get(sid) || [];
          arr.push(iid);
          ispsBySchool.set(sid, arr);
          ispIdSet.add(iid);
        }
        if (ispIdSet.size) {
          const { data: isps } = await supabase
            .from('nsnp_isp_profiles')
            .select('profile_id, trading_name')
            .in('profile_id', Array.from(ispIdSet));
          for (const i of isps || []) {
            ispNames.set(
              Number(i.profile_id),
              String(i.trading_name || `SP ${i.profile_id}`)
            );
          }
        }
        schoolLearners = (schools || []).map((s) => ({
          school_profile_id: Number(s.id),
          school_name: String(s.school_name || `School ${s.id}`),
          emis_number: s.emis_number != null ? String(s.emis_number) : null,
          district: s.district != null ? String(s.district) : null,
          learners: schoolLearnerCount(s as Record<string, unknown>),
          isp_profile_ids: ispsBySchool.get(Number(s.id)) || [],
        }));
      }
    }

    // Optional single-school filter for agency
    const schoolFilter = sp.get('schoolProfileId')
      ? Number(sp.get('schoolProfileId'))
      : null;
    if (schoolFilter && Number.isFinite(schoolFilter)) {
      schoolLearners = schoolLearners.filter(
        (s) => s.school_profile_id === schoolFilter
      );
    }

    // Prefer DBE feeding calendar day flags for accurate MPS day counts
    const feedingDates = await loadFeedingDateSet(
      supabase,
      agencyProfileId,
      from,
      to,
      role === 'agency'
    );

    const plan = buildProgrammePlan({
      period_from: from,
      period_to: to,
      recipes: recipeSchedule,
      schools: schoolLearners,
      ispNames,
      budgets,
      feedingDates,
    });

    // For school/SP return scoped plan detail
    let scoped = plan;
    if (role === 'school' && schoolLearners[0]) {
      const mine = plan.schools.find(
        (s) => s.school_profile_id === schoolLearners[0].school_profile_id
      );
      scoped = {
        ...plan,
        schools: mine ? [mine] : [],
        service_providers: plan.service_providers.filter((spRow) =>
          schoolLearners[0].isp_profile_ids?.includes(spRow.isp_profile_id)
        ),
        mrp: mine?.mrp || [],
        mps: mine?.mps || [],
        mrp_by_category: (mine?.mrp_by_category || []).map((c) => ({
          ...c,
          budget_amount_zar: undefined,
          variance_zar: undefined,
        })),
        total_meals: mine?.total_meals || 0,
        total_learners: mine?.learners || 0,
        estimated_cost_zar: mine?.estimated_cost_zar || 0,
      };
    } else if (role === 'isp') {
      const mine = plan.service_providers.find(
        (s) => s.isp_profile_id === companyId
      );
      scoped = {
        ...plan,
        service_providers: mine ? [mine] : [],
        schools: plan.schools.filter((s) =>
          schoolLearners.some((l) => l.school_profile_id === s.school_profile_id)
        ),
        mrp: mine?.mrp || [],
        mrp_by_category: (mine?.mrp_by_category || []).map((c) => ({
          ...c,
        })),
        total_meals: mine?.total_meals || 0,
        total_learners: mine?.learners || 0,
        estimated_cost_zar: mine?.estimated_cost_zar || 0,
        school_count: mine?.school_count || 0,
      };
    }

    return NextResponse.json({
      success: true,
      role,
      canEdit: role === 'agency',
      agencyProfileId,
      recipes: activeRecipes,
      budgets,
      plan: scoped,
      programme_plan: role === 'agency' ? plan : undefined,
      model: {
        description:
          'Recipe BOM (qty per learner) × school NSNP learners × feeding days from DBE calendar (or weekdays if no calendar) → product MRP. SP sees sum of their schools. Category budgets compare estimated cost.',
        portion_basis: 'qty_per_portion is per 1 learner meal portion',
        learner_field:
          'final_nsnp_approved_enrol → nsnp_eligible → enrolled',
        feeding_days_source: feedingDates
          ? 'dbe_feeding_calendar'
          : 'weekday_fallback',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** Load feeding ISO dates from DBE calendar covering [from,to]. */
async function loadFeedingDateSet(
  supabase: ReturnType<typeof getSupabaseServer>,
  agencyProfileId: number,
  from: string,
  to: string,
  agencyCanUseDraft: boolean
): Promise<Set<string> | null> {
  const years = new Set<number>();
  years.add(Number(from.slice(0, 4)));
  years.add(Number(to.slice(0, 4)));
  const set = new Set<string>();
  let found = false;
  for (const year of years) {
    if (!Number.isFinite(year)) continue;
    const { data: cal, error } = await supabase
      .from('nsnp_feeding_calendars')
      .select('id, status')
      .eq('agency_profile_id', agencyProfileId)
      .eq('year', year)
      .limit(1)
      .maybeSingle();
    if (error || !cal) continue;
    if (!agencyCanUseDraft && String(cal.status) !== 'published') continue;
    found = true;
    const { data: days } = await supabase
      .from('nsnp_feeding_calendar_days')
      .select('feed_date, is_feeding')
      .eq('calendar_id', Number(cal.id))
      .eq('is_feeding', true)
      .gte('feed_date', from.slice(0, 10))
      .lte('feed_date', to.slice(0, 10))
      .limit(400);
    for (const d of days || []) {
      set.add(String(d.feed_date).slice(0, 10));
    }
  }
  return found ? set : null;
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
        { error: 'Only DBE / PEU can manage recipes and budgets' },
        { status: 403 }
      );
    }

    const action = String(body.action || 'save_recipe');

    if (action === 'delete_recipe') {
      const id = Number(body.id);
      if (!Number.isFinite(id)) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
      }
      await supabase
        .from('nsnp_recipe_lines')
        .delete()
        .eq('recipe_id', id);
      const { error } = await supabase
        .from('nsnp_recipes')
        .delete()
        .eq('id', id)
        .eq('agency_profile_id', companyId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'delete_budget') {
      const id = Number(body.id);
      const { error } = await supabase
        .from('nsnp_category_budgets')
        .delete()
        .eq('id', id)
        .eq('agency_profile_id', companyId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'save_budget') {
      const category = String(body.category || '').trim();
      if (!category) {
        return NextResponse.json({ error: 'category required' }, { status: 400 });
      }
      const row = {
        agency_profile_id: companyId,
        category,
        period_from: body.period_from || new Date().toISOString().slice(0, 10),
        period_to: body.period_to || new Date().toISOString().slice(0, 10),
        budget_amount_zar: Number(body.budget_amount_zar || 0),
        unit_price_zar:
          body.unit_price_zar != null && body.unit_price_zar !== ''
            ? Number(body.unit_price_zar)
            : null,
        uom: body.uom || 'kg',
        notes: body.notes || null,
        updated_at: new Date().toISOString(),
      };
      if (body.id) {
        const { data, error } = await supabase
          .from('nsnp_category_budgets')
          .update(row)
          .eq('id', Number(body.id))
          .eq('agency_profile_id', companyId)
          .select('*')
          .single();
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ success: true, budget: data });
      }
      const { data, error } = await supabase
        .from('nsnp_category_budgets')
        .insert(row)
        .select('*')
        .single();
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) {
          return NextResponse.json(
            {
              error:
                'Run migration 20260728_nsnp_recipes_mrp.sql for recipe tables',
            },
            { status: 400 }
          );
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, budget: data });
    }

    // save_recipe
    const name = String(body.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'Recipe name required' }, { status: 400 });
    }
    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    if (!rawLines.length) {
      return NextResponse.json(
        { error: 'Add at least one BOM line from the approved catalogue' },
        { status: 400 }
      );
    }

    const productIds = rawLines
      .map((l: { approved_product_id?: number }) => Number(l.approved_product_id))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    const byId = await filterApprovedProductIds(
      supabase,
      companyId,
      productIds
    );

    const lines: RecipeLine[] = [];
    for (const l of rawLines) {
      const pid = Number(l.approved_product_id);
      const prod = byId.get(pid);
      if (!prod) {
        return NextResponse.json(
          {
            error: `Product ${pid || l.product_name} is not on your approved catalogue`,
          },
          { status: 400 }
        );
      }
      const qty = Number(l.qty_per_portion);
      if (!(qty > 0)) {
        return NextResponse.json(
          { error: `${prod.name}: qty per portion must be > 0` },
          { status: 400 }
        );
      }
      lines.push({
        approved_product_id: pid,
        product_name: String(prod.name),
        brand_name: String(prod.brand_name || ''),
        category: String(prod.category || l.category || 'other'),
        qty_per_portion: qty,
        uom: String(l.uom || prod.uom || 'kg'),
        wastage_pct: Math.max(0, Number(l.wastage_pct || 0)),
        sort_order: Number(l.sort_order || lines.length),
        notes: l.notes != null ? String(l.notes) : null,
      });
    }

    const recipeRow = {
      agency_profile_id: companyId,
      name,
      meal_type: String(body.meal_type || 'lunch'),
      dish_code: body.dish_code || null,
      description: body.description || null,
      portion_learners: Number(body.portion_learners || 1) || 1,
      active: body.active !== false,
      notes: body.notes || null,
      updated_at: new Date().toISOString(),
    };

    let recipeId = body.id ? Number(body.id) : null;
    if (recipeId && Number.isFinite(recipeId)) {
      const { error } = await supabase
        .from('nsnp_recipes')
        .update(recipeRow)
        .eq('id', recipeId)
        .eq('agency_profile_id', companyId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      await supabase.from('nsnp_recipe_lines').delete().eq('recipe_id', recipeId);
    } else {
      const { data, error } = await supabase
        .from('nsnp_recipes')
        .insert(recipeRow)
        .select('id')
        .single();
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) {
          return NextResponse.json(
            {
              error:
                'Run migration 20260728_nsnp_recipes_mrp.sql for recipe tables',
            },
            { status: 400 }
          );
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      recipeId = Number(data.id);
    }

    const lineRows = lines.map((l, i) => ({
      recipe_id: recipeId,
      approved_product_id: l.approved_product_id,
      product_name: l.product_name,
      brand_name: l.brand_name,
      category: l.category,
      qty_per_portion: l.qty_per_portion,
      uom: l.uom,
      wastage_pct: l.wastage_pct || 0,
      sort_order: l.sort_order ?? i,
      notes: l.notes,
    }));

    const { error: lErr } = await supabase
      .from('nsnp_recipe_lines')
      .insert(lineRows);
    if (lErr) {
      return NextResponse.json({ error: lErr.message }, { status: 400 });
    }

    const recipes = await loadRecipes(supabase, companyId);
    const recipe = recipes.find((r) => r.id === recipeId);

    return NextResponse.json({
      success: true,
      recipe,
      message:
        'Recipe BOM saved. MPS/MRP uses qty per learner × school NSNP enrolment × feeding days.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

async function loadRecipes(
  supabase: ReturnType<typeof getSupabaseServer>,
  agencyProfileId: number
): Promise<Recipe[]> {
  const { data: recipes, error } = await supabase
    .from('nsnp_recipes')
    .select('*')
    .eq('agency_profile_id', agencyProfileId)
    .order('meal_type')
    .order('name')
    .limit(200);
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) return [];
    return [];
  }
  const ids = (recipes || []).map((r) => Number(r.id));
  if (!ids.length) return [];
  const { data: lines } = await supabase
    .from('nsnp_recipe_lines')
    .select('*')
    .in('recipe_id', ids)
    .order('sort_order');
  const byRecipe = new Map<number, RecipeLine[]>();
  for (const l of lines || []) {
    const rid = Number(l.recipe_id);
    const arr = byRecipe.get(rid) || [];
    arr.push({
      id: Number(l.id),
      approved_product_id: l.approved_product_id
        ? Number(l.approved_product_id)
        : null,
      product_name: String(l.product_name),
      brand_name: l.brand_name != null ? String(l.brand_name) : null,
      category: l.category != null ? String(l.category) : 'other',
      qty_per_portion: Number(l.qty_per_portion),
      uom: String(l.uom || 'kg'),
      wastage_pct: Number(l.wastage_pct || 0),
      sort_order: Number(l.sort_order || 0),
      notes: l.notes != null ? String(l.notes) : null,
    });
    byRecipe.set(rid, arr);
  }
  return (recipes || []).map((r) => ({
    id: Number(r.id),
    agency_profile_id: Number(r.agency_profile_id),
    name: String(r.name),
    meal_type: String(r.meal_type || 'lunch'),
    dish_code: r.dish_code != null ? String(r.dish_code) : null,
    description: r.description != null ? String(r.description) : null,
    portion_learners: Number(r.portion_learners || 1),
    active: r.active !== false,
    lines: byRecipe.get(Number(r.id)) || [],
  }));
}

async function loadBudgets(
  supabase: ReturnType<typeof getSupabaseServer>,
  agencyProfileId: number,
  sp?: URLSearchParams,
  from?: string,
  to?: string
): Promise<CategoryBudget[]> {
  let q = supabase
    .from('nsnp_category_budgets')
    .select('*')
    .eq('agency_profile_id', agencyProfileId)
    .order('category')
    .limit(100);
  const f = from || sp?.get('from') || '';
  const t = to || sp?.get('to') || '';
  // overlap period if provided
  if (f && t) {
    q = q.lte('period_from', t).gte('period_to', f);
  }
  const { data, error } = await q;
  if (error) return [];
  return (data || []).map((b) => ({
    id: Number(b.id),
    category: String(b.category),
    period_from: String(b.period_from).slice(0, 10),
    period_to: String(b.period_to).slice(0, 10),
    budget_amount_zar: Number(b.budget_amount_zar || 0),
    unit_price_zar:
      b.unit_price_zar != null ? Number(b.unit_price_zar) : null,
    uom: b.uom != null ? String(b.uom) : 'kg',
  }));
}

async function schoolIspIds(
  supabase: ReturnType<typeof getSupabaseServer>,
  schoolProfileId: number
): Promise<number[]> {
  const { data } = await supabase
    .from('school_isp_links')
    .select('isp_profile_id')
    .eq('school_profile_id', schoolProfileId)
    .eq('status', 'active');
  return [
    ...new Set(
      (data || [])
        .map((l) => Number(l.isp_profile_id))
        .filter((n) => Number.isFinite(n))
    ),
  ];
}
