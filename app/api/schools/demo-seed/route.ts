/**
 * Priority 5 — Demo seed for NSNP stakeholder demos / training.
 *
 * POST { companyId, action: 'seed' | 'status' }
 * - Agency company: seeds sample catalogue products, a menu note, and recipe skeleton
 *   only when catalogue is empty (or force=true).
 * - Does not create fake schools/SPs without explicit force (avoids polluting production).
 *
 * Soft-fails on missing tables so deploy never breaks.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

const DEMO_PRODUCTS = [
  {
    name: 'Fortified Maize Meal 12.5kg',
    brand_name: 'Demo Ace',
    category: 'starch',
    uom: 'kg',
    pack_size: '12.5kg',
  },
  {
    name: 'Cooking Oil 5L',
    brand_name: 'Demo Sun',
    category: 'oil',
    uom: 'L',
    pack_size: '5L',
  },
  {
    name: 'Soya Mince 1kg',
    brand_name: 'Demo Protein A',
    category: 'soya',
    uom: 'kg',
    pack_size: '1kg',
  },
  {
    name: 'Soya Mince 1kg',
    brand_name: 'Demo Protein B',
    category: 'soya',
    uom: 'kg',
    pack_size: '1kg',
  },
  {
    name: 'Sugar Beans 5kg',
    brand_name: 'Demo Beans',
    category: 'beans',
    uom: 'kg',
    pack_size: '5kg',
  },
  {
    name: 'Pasteurised Milk 1L',
    brand_name: 'Demo Dairy',
    category: 'dairy',
    uom: 'L',
    pack_size: '1L',
  },
];

export async function GET(request: NextRequest) {
  return statusOrSeed(request, 'status');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'seed').toLowerCase();
    return statusOrSeed(request, action, body);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

async function statusOrSeed(
  request: NextRequest,
  action: string,
  body?: Record<string, unknown>
) {
  const companyId = Number(
    body?.companyId || request.nextUrl.searchParams.get('companyId')
  );
  if (!Number.isFinite(companyId)) {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 });
  }
  const gate = await requireCompanyAccess(request, companyId, {
    legacyPrivyUserId: legacyPrivyFrom(request),
  });
  if (!gate.ok) return gate.response;

  const supabase = getSupabaseServer();
  const { data: agency } = await supabase
    .from('nsnp_agency_profiles')
    .select('profile_id, agency_name')
    .eq('profile_id', companyId)
    .maybeSingle();

  if (!agency) {
    return NextResponse.json(
      {
        error:
          'Demo seed runs from a DBE / PEU (agency) company — switch company and retry',
        success: false,
      },
      { status: 403 }
    );
  }

  const { count: productCount } = await supabase
    .from('nsnp_approved_products')
    .select('*', { count: 'exact', head: true })
    .eq('agency_profile_id', companyId);

  const { count: recipeCount } = await supabase
    .from('nsnp_recipes')
    .select('*', { count: 'exact', head: true })
    .eq('agency_profile_id', companyId);

  const status = {
    success: true,
    role: 'agency' as const,
    agency_name: agency.agency_name,
    products: productCount || 0,
    recipes: recipeCount || 0,
    seeded: (productCount || 0) > 0,
    tip:
      (productCount || 0) === 0
        ? 'Catalogue empty — POST action=seed to load demo products + sample recipe'
        : 'Catalogue already has products — use force=true to add demo rows anyway',
  };

  if (action === 'status') {
    return NextResponse.json(status);
  }

  if (action !== 'seed') {
    return NextResponse.json({ error: 'action must be seed or status' }, { status: 400 });
  }

  const force = body?.force === true || body?.force === '1';
  if ((productCount || 0) > 0 && !force) {
    return NextResponse.json({
      ...status,
      message: 'Already seeded — pass force=true to append demo products',
      skipped: true,
    });
  }

  const now = new Date().toISOString();
  const inserted: number[] = [];
  for (const p of DEMO_PRODUCTS) {
    const row = {
      agency_profile_id: companyId,
      name: p.name,
      brand_name: p.brand_name,
      category: p.category,
      uom: p.uom,
      pack_size: p.pack_size,
      active: true,
      metadata: {
        demo_seed: true,
        for_breakfast: p.category === 'dairy' || p.category === 'starch',
        for_lunch: true,
      },
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await supabase
      .from('nsnp_approved_products')
      .insert(row)
      .select('id')
      .single();
    if (!error && data?.id) inserted.push(Number(data.id));
  }

  // Sample recipe with multi-brand soya line for brand-pick demos
  let recipeId: number | null = null;
  const soyaIds = inserted.slice(2, 4); // Protein A/B if inserted in order
  const { data: recipe, error: rErr } = await supabase
    .from('nsnp_recipes')
    .insert({
      agency_profile_id: companyId,
      name: 'Demo NSNP Lunch · Soya mince',
      meal_type: 'lunch',
      active: true,
      metadata: {
        demo_seed: true,
        weekday: 'monday',
        meal_slot: 'lunch',
      },
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (!rErr && recipe?.id) {
    recipeId = Number(recipe.id);
    const lines = [
      {
        recipe_id: recipeId,
        approved_product_id: inserted[0] || null,
        product_name: 'Fortified Maize Meal',
        brand_name: 'Demo Ace',
        category: 'starch',
        qty_per_portion: 0.08,
        uom: 'kg',
        sort_order: 1,
      },
      {
        recipe_id: recipeId,
        approved_product_id: soyaIds[0] || inserted[2] || null,
        product_name: 'Soya Mince',
        brand_name: 'Demo Protein A',
        category: 'soya',
        qty_per_portion: 0.03,
        uom: 'kg',
        sort_order: 2,
      },
      {
        recipe_id: recipeId,
        approved_product_id: inserted[1] || null,
        product_name: 'Cooking Oil',
        brand_name: 'Demo Sun',
        category: 'oil',
        qty_per_portion: 0.005,
        uom: 'L',
        sort_order: 3,
      },
    ];
    await supabase.from('nsnp_recipe_lines').insert(lines);
  }

  // Light menu cycle pointer (if table supports)
  try {
    await supabase.from('school_menu_cycles').insert({
      agency_profile_id: companyId,
      name: 'Demo weekly menu',
      active: true,
      weekly_approved_product_ids: inserted,
      metadata: { demo_seed: true },
      created_at: now,
      updated_at: now,
    });
  } catch {
    /* soft */
  }

  return NextResponse.json({
    success: true,
    message: `Demo seed loaded: ${inserted.length} products${recipeId ? ' + 1 recipe' : ''}`,
    products_inserted: inserted.length,
    product_ids: inserted,
    recipe_id: recipeId,
    next: [
      'Link a school under Join / Agency',
      'School picks soya brand on Recipes',
      'School orders → SP fulfils → GRN → serve day → claim',
    ],
    golden_path: [
      'catalogue',
      'menu/recipes',
      'school brand pick',
      'PO',
      'DN+POD',
      'GRN',
      'serve',
      'claim',
    ],
  });
}
