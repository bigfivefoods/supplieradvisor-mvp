/**
 * School kitchen inventory snapshot — stock levels + cover plan.
 * Shared by kitchen GET enrichment and PDF/CSV export.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  loadApprovedProducts,
  resolveCatalogueContext,
} from '@/lib/schools/approved-catalogue';
import {
  buildKitchenStockPlan,
  policyFromSchool,
  roundStockQty,
  type KitchenStockPlan,
  type StockCoverPolicy,
} from '@/lib/schools/kitchen-stock-plan';
import {
  schoolLearnerCount,
  type Recipe,
  type RecipeLine,
} from '@/lib/schools/recipe-mrp';

export type KitchenInventoryRow = {
  id?: number | null;
  approved_product_id: number | null;
  product_name: string;
  brand_name: string;
  category: string;
  uom: string;
  qty_on_hand: number;
  reorder_level: number | null;
  target_level: number | null;
  min_level: number | null;
  low_stock: boolean;
  daily_usage: number;
  days_on_hand: number | null;
  suggested_order_qty: number;
  cover_status: string;
  cover_message: string | null;
};

export type KitchenInventorySnapshot = {
  schoolId: number;
  schoolName: string;
  learners: number;
  cover_policy: StockCoverPolicy;
  recipes_count: number;
  stock: KitchenInventoryRow[];
  low_count: number;
  stock_plan: KitchenStockPlan;
};

async function loadAgencyRecipes(
  supabase: SupabaseClient,
  agencyProfileId: number
): Promise<Recipe[]> {
  const { data: recipes, error } = await supabase
    .from('nsnp_recipes')
    .select('*')
    .eq('agency_profile_id', agencyProfileId)
    .eq('active', true)
    .limit(200);
  if (error || !recipes?.length) return [];
  const ids = recipes.map((r) => Number(r.id));
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
      approved_product_id: l.approved_product_id
        ? Number(l.approved_product_id)
        : null,
      product_name: String(l.product_name),
      brand_name: l.brand_name != null ? String(l.brand_name) : null,
      category: l.category != null ? String(l.category) : 'other',
      qty_per_portion: Number(l.qty_per_portion),
      uom: String(l.uom || 'kg'),
      wastage_pct: Number(l.wastage_pct || 0),
    });
    byRecipe.set(rid, arr);
  }
  return recipes.map((r) => {
    const wd =
      r.weekday != null && r.weekday !== '' ? Number(r.weekday) : null;
    return {
      id: Number(r.id),
      agency_profile_id: Number(r.agency_profile_id),
      name: String(r.name || 'Recipe'),
      meal_type: String(r.meal_type || 'lunch'),
      weekday:
        wd != null && Number.isFinite(wd) && wd >= 1 && wd <= 5 ? wd : null,
      portion_learners: Number(r.portion_learners || 1),
      active: r.active !== false,
      lines: byRecipe.get(Number(r.id)) || [],
    };
  });
}

/**
 * Load enriched kitchen stock levels for a school company.
 * Includes products with demand but zero on-hand when present on the cover plan.
 */
export async function loadKitchenInventorySnapshot(
  supabase: SupabaseClient,
  companyId: number,
  school: Record<string, unknown>
): Promise<KitchenInventorySnapshot> {
  const schoolId = Number(school.id);
  const schoolName = String(
    school.school_name || school.name || `School ${schoolId}`
  );
  const policy = policyFromSchool(school);
  const learners = schoolLearnerCount(school);

  const { data: stockRows } = await supabase
    .from('school_kitchen_stock')
    .select('*')
    .eq('school_profile_id', schoolId)
    .order('product_name')
    .limit(500);

  const catalogue = await resolveCatalogueContext(supabase, companyId, {
    schoolProfileId: schoolId,
  });
  const recipes = catalogue.agencyProfileId
    ? await loadAgencyRecipes(supabase, catalogue.agencyProfileId)
    : [];
  const products = await loadApprovedProducts(
    supabase,
    catalogue.agencyProfileId,
    { activeOnly: true, includeNationalFallback: !catalogue.agencyProfileId }
  );

  const onHandByProduct = new Map<number, number>();
  for (const s of stockRows || []) {
    const pid = Number(s.approved_product_id);
    if (Number.isFinite(pid)) {
      onHandByProduct.set(pid, Number(s.qty_on_hand || 0));
    }
  }

  const stockPlan = buildKitchenStockPlan({
    recipes,
    learners,
    policy,
    onHandByProduct,
    catalogue: (products || []).map((p) => ({
      id: Number(p.id),
      name: String(p.name),
      brand_name: p.brand_name != null ? String(p.brand_name) : null,
      category: p.category != null ? String(p.category) : null,
      uom: p.uom != null ? String(p.uom) : null,
    })),
  });

  const planByPid = new Map(
    stockPlan.products.map((p) => [p.approved_product_id, p])
  );

  const stockFromDb: KitchenInventoryRow[] = (stockRows || []).map((s) => {
    const uom = String(s.uom || 'kg');
    const onHand = roundStockQty(Number(s.qty_on_hand || 0), uom, 'round');
    const planRow = planByPid.get(Number(s.approved_product_id));
    const reorderRaw =
      s.reorder_level != null && s.reorder_level !== ''
        ? Number(s.reorder_level)
        : planRow && planRow.reorder_level > 0
          ? planRow.reorder_level
          : null;
    const reorder =
      reorderRaw != null && Number.isFinite(reorderRaw)
        ? roundStockQty(reorderRaw, uom, 'ceil')
        : null;
    const targetRaw =
      s.target_level != null
        ? Number(s.target_level)
        : planRow?.target_qty ?? null;
    const target =
      targetRaw != null && Number.isFinite(targetRaw)
        ? roundStockQty(targetRaw, uom, 'ceil')
        : null;
    const low =
      (reorder != null && Number.isFinite(reorder) && onHand <= reorder) ||
      planRow?.status === 'reorder' ||
      planRow?.status === 'critical';
    return {
      id: s.id != null ? Number(s.id) : null,
      approved_product_id:
        s.approved_product_id != null ? Number(s.approved_product_id) : null,
      product_name: String(s.product_name || planRow?.product_name || 'Product'),
      brand_name: String(s.brand_name || planRow?.brand_name || '—'),
      category: String(
        s.category || planRow?.category || 'Uncategorised'
      ),
      uom,
      qty_on_hand: onHand,
      reorder_level: reorder,
      target_level: target,
      min_level:
        s.min_level != null
          ? roundStockQty(Number(s.min_level), uom, 'ceil')
          : null,
      low_stock: Boolean(low),
      daily_usage: planRow?.daily_usage ?? 0,
      days_on_hand: planRow?.days_on_hand ?? null,
      suggested_order_qty: roundStockQty(
        planRow?.suggested_order_qty ?? 0,
        uom,
        'ceil'
      ),
      cover_status: planRow?.status || 'no_demand',
      cover_message: planRow?.message || null,
    };
  });

  // Include plan products with demand but no stock row yet
  const seen = new Set(
    stockFromDb
      .map((r) => r.approved_product_id)
      .filter((id): id is number => id != null && Number.isFinite(id))
  );
  const missing: KitchenInventoryRow[] = [];
  for (const p of stockPlan.products) {
    if (seen.has(p.approved_product_id)) continue;
    if (p.daily_usage <= 0 && p.qty_on_hand <= 0) continue;
    missing.push({
      id: null,
      approved_product_id: p.approved_product_id,
      product_name: p.product_name,
      brand_name: p.brand_name || '—',
      category: p.category || 'Uncategorised',
      uom: p.uom || 'kg',
      qty_on_hand: roundStockQty(p.qty_on_hand, p.uom || 'kg', 'round'),
      reorder_level: p.reorder_level,
      target_level: p.target_qty,
      min_level: null,
      low_stock: p.status === 'reorder' || p.status === 'critical',
      daily_usage: p.daily_usage,
      days_on_hand: p.days_on_hand,
      suggested_order_qty: roundStockQty(
        p.suggested_order_qty,
        p.uom || 'kg',
        'ceil'
      ),
      cover_status: p.status,
      cover_message: p.message,
    });
  }

  const stock = [...stockFromDb, ...missing].sort((a, b) => {
    const ca = a.category.localeCompare(b.category);
    if (ca !== 0) return ca;
    const ba = a.brand_name.localeCompare(b.brand_name);
    if (ba !== 0) return ba;
    return a.product_name.localeCompare(b.product_name);
  });

  return {
    schoolId,
    schoolName,
    learners,
    cover_policy: policy,
    recipes_count: recipes.length,
    stock,
    low_count: stock.filter((s) => s.low_stock).length,
    stock_plan: stockPlan,
  };
}
