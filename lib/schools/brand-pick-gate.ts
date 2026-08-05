/**
 * Sprint A1 — School brand-pick completeness gate.
 * When a BOM line has multiple approved brand options, the school must choose
 * one before submitting a PO (e.g. which soya brand).
 *
 * For kitchen / menu POs with explicit product lines, ordered products auto-satisfy
 * matching multi-brand lines (order-scoped). Unrelated multi-brand lines do not block.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeRecipeCategory } from '@/lib/schools/recipe-mrp';

export type MissingBrandPick = {
  recipe_id: number;
  recipe_name: string;
  recipe_line_id: number;
  category: string | null;
  product_name: string;
  default_brand: string | null;
  option_count: number;
};

export type BrandPickGateResult = {
  ok: boolean;
  missing: MissingBrandPick[];
  checked_lines: number;
  multi_brand_lines: number;
  /** Brand picks auto-applied from products on the current PO */
  auto_applied?: number;
  message?: string;
  href?: string;
};

type CatOption = { id: number; name: string; brand_name: string; category: string };

type GateContext = {
  lines: Array<Record<string, unknown>>;
  recipeName: Map<number, string>;
  catalogue: Array<Record<string, unknown>>;
  byCategory: Map<string, CatOption[]>;
  choices: Map<number, number>;
  findOptions: (
    category?: string | null,
    defaultPid?: number | null
  ) => { options: CatOption[]; brandCount: number };
};

async function loadBrandPickContext(
  supabase: SupabaseClient,
  opts: { schoolProfileId: number; agencyProfileId: number }
): Promise<GateContext | null> {
  const { data: recipes, error: rErr } = await supabase
    .from('nsnp_recipes')
    .select('id, name, active')
    .eq('agency_profile_id', opts.agencyProfileId)
    .limit(100);
  if (rErr) return null;

  const active = (recipes || []).filter((r) => r.active !== false);
  if (!active.length) return null;
  const recipeIds = active.map((r) => Number(r.id));
  const recipeName = new Map(
    active.map((r) => [Number(r.id), String(r.name || `Recipe ${r.id}`)])
  );

  const { data: lines, error: lErr } = await supabase
    .from('nsnp_recipe_lines')
    .select(
      'id, recipe_id, approved_product_id, category, product_name, brand_name'
    )
    .in('recipe_id', recipeIds)
    .limit(500);
  if (lErr || !lines?.length) return null;

  const { data: products } = await supabase
    .from('nsnp_approved_products')
    .select('id, name, brand_name, category, active')
    .eq('agency_profile_id', opts.agencyProfileId)
    .limit(800);
  const catalogue = (products || []).filter((p) => p.active !== false);

  const byCategory = new Map<string, CatOption[]>();
  for (const p of catalogue) {
    const cat = normalizeRecipeCategory(String(p.category || ''));
    if (!cat) continue;
    const list = byCategory.get(cat) || [];
    list.push({
      id: Number(p.id),
      name: String(p.name || ''),
      brand_name: String(p.brand_name || ''),
      category: cat,
    });
    byCategory.set(cat, list);
  }

  const findOptions = (
    category?: string | null,
    defaultPid?: number | null
  ) => {
    const cat = normalizeRecipeCategory(category);
    let options: CatOption[] = [];
    if (cat && byCategory.has(cat)) {
      options = [...(byCategory.get(cat) || [])];
    } else if (cat) {
      const seen = new Set<number>();
      for (const [k, list] of byCategory) {
        if (k.includes(cat) || cat.includes(k)) {
          for (const o of list) {
            if (!seen.has(o.id)) {
              seen.add(o.id);
              options.push(o);
            }
          }
        }
      }
    }
    if (
      defaultPid &&
      Number.isFinite(defaultPid) &&
      !options.some((o) => o.id === defaultPid)
    ) {
      const def = catalogue.find((p) => Number(p.id) === defaultPid);
      if (def) {
        options = [
          {
            id: Number(def.id),
            name: String(def.name || ''),
            brand_name: String(def.brand_name || ''),
            category: normalizeRecipeCategory(String(def.category || '')) || '',
          },
          ...options,
        ];
      }
    }
    const brands = new Set(
      options.map((o) => o.brand_name.trim().toLowerCase()).filter(Boolean)
    );
    return {
      options,
      brandCount: Math.max(
        brands.size,
        options.length > 1 ? 2 : options.length
      ),
    };
  };

  const choices = new Map<number, number>();
  const { data: choiceRows, error: cErr } = await supabase
    .from('school_nsnp_recipe_brand_choices')
    .select('recipe_line_id, chosen_product_id')
    .eq('school_profile_id', opts.schoolProfileId)
    .limit(500);
  if (!cErr && choiceRows?.length) {
    for (const c of choiceRows) {
      choices.set(Number(c.recipe_line_id), Number(c.chosen_product_id));
    }
  } else {
    const { data: sch } = await supabase
      .from('school_profiles')
      .select('metadata')
      .eq('id', opts.schoolProfileId)
      .maybeSingle();
    const meta =
      sch?.metadata && typeof sch.metadata === 'object'
        ? (sch.metadata as Record<string, unknown>)
        : {};
    const map =
      meta.recipe_brand_choices &&
      typeof meta.recipe_brand_choices === 'object'
        ? (meta.recipe_brand_choices as Record<string, Record<string, unknown>>)
        : {};
    for (const [lineId, c] of Object.entries(map)) {
      const pid = Number(c.chosen_product_id);
      if (Number.isFinite(pid)) choices.set(Number(lineId), pid);
    }
  }

  return {
    lines: lines as Array<Record<string, unknown>>,
    recipeName,
    catalogue: catalogue as Array<Record<string, unknown>>,
    byCategory,
    choices,
    findOptions,
  };
}

async function persistBrandChoice(
  supabase: SupabaseClient,
  opts: {
    schoolProfileId: number;
    companyProfileId?: number | null;
    recipeId: number;
    recipeLineId: number;
    defaultProductId: number | null;
    category: string | null;
    chosenProductId: number;
    chosenProductName: string;
    chosenBrandName: string;
  }
): Promise<boolean> {
  const choiceRow = {
    school_profile_id: opts.schoolProfileId,
    profile_id: opts.companyProfileId || opts.schoolProfileId,
    recipe_id: opts.recipeId,
    recipe_line_id: opts.recipeLineId,
    default_product_id: opts.defaultProductId,
    category: opts.category,
    chosen_product_id: opts.chosenProductId,
    chosen_product_name: opts.chosenProductName,
    chosen_brand_name: opts.chosenBrandName,
    updated_at: new Date().toISOString(),
  };

  const { error: uErr } = await supabase
    .from('school_nsnp_recipe_brand_choices')
    .upsert(choiceRow, { onConflict: 'school_profile_id,recipe_line_id' });

  if (!uErr) return true;
  if (!/does not exist|schema cache|onConflict|unique/i.test(uErr.message)) {
    return false;
  }

  // Metadata fallback
  const { data: sch } = await supabase
    .from('school_profiles')
    .select('id, metadata')
    .eq('id', opts.schoolProfileId)
    .maybeSingle();
  const meta =
    sch?.metadata && typeof sch.metadata === 'object'
      ? { ...(sch.metadata as Record<string, unknown>) }
      : {};
  const map =
    meta.recipe_brand_choices && typeof meta.recipe_brand_choices === 'object'
      ? { ...(meta.recipe_brand_choices as Record<string, unknown>) }
      : {};
  map[String(opts.recipeLineId)] = {
    recipe_id: opts.recipeId,
    chosen_product_id: opts.chosenProductId,
    chosen_product_name: opts.chosenProductName,
    chosen_brand_name: opts.chosenBrandName,
    default_product_id: opts.defaultProductId,
    category: opts.category,
  };
  meta.recipe_brand_choices = map;
  const { error: mErr } = await supabase
    .from('school_profiles')
    .update({ metadata: meta, updated_at: new Date().toISOString() })
    .eq('id', opts.schoolProfileId);
  return !mErr;
}

/**
 * Apply brand picks from products already on a PO (kitchen suggested / menu PO).
 * Matching multi-brand recipe lines without a choice get the ordered product.
 */
export async function applyBrandPicksFromOrderedProducts(
  supabase: SupabaseClient,
  opts: {
    schoolProfileId: number;
    agencyProfileId: number;
    orderedProductIds: number[];
    companyProfileId?: number | null;
  }
): Promise<{ applied: number }> {
  const productIds = [
    ...new Set(
      (opts.orderedProductIds || [])
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
  if (!productIds.length) return { applied: 0 };

  try {
    const ctx = await loadBrandPickContext(supabase, opts);
    if (!ctx) return { applied: 0 };

    const orderedSet = new Set(productIds);
    let applied = 0;

    for (const line of ctx.lines) {
      const lineId = Number(line.id);
      if (ctx.choices.has(lineId)) continue;

      const defaultPid = line.approved_product_id
        ? Number(line.approved_product_id)
        : null;
      const { options, brandCount } = ctx.findOptions(
        line.category != null ? String(line.category) : null,
        defaultPid
      );
      if (options.length < 2 && brandCount < 2) continue;

      const match = options.find((o) => orderedSet.has(o.id));
      if (!match) continue;

      const ok = await persistBrandChoice(supabase, {
        schoolProfileId: opts.schoolProfileId,
        companyProfileId: opts.companyProfileId,
        recipeId: Number(line.recipe_id),
        recipeLineId: lineId,
        defaultProductId: defaultPid,
        category: line.category != null ? String(line.category) : null,
        chosenProductId: match.id,
        chosenProductName: match.name,
        chosenBrandName: match.brand_name,
      });
      if (ok) {
        ctx.choices.set(lineId, match.id);
        applied += 1;
      }
    }

    return { applied };
  } catch {
    return { applied: 0 };
  }
}

/**
 * Returns incomplete multi-brand BOM lines for a school under an agency.
 * Soft-fails open (ok:true) if tables are missing so PO flow is not blocked by schema lag.
 *
 * When `orderedProductIds` is provided (PO submit / kitchen suggested PO):
 * - Auto-applies brand picks from those products for matching multi-brand lines
 * - Only requires picks for multi-brand lines that overlap the order
 * - Unrelated multi-brand lines do not block the PO
 */
export async function checkSchoolBrandPickGate(
  supabase: SupabaseClient,
  opts: {
    schoolProfileId: number;
    agencyProfileId: number;
    /** Products on the current PO — scopes gate + auto-picks brands */
    orderedProductIds?: number[];
    companyProfileId?: number | null;
    /** full = school-wide readiness; order = only lines relevant to this PO */
    mode?: 'full' | 'order';
  }
): Promise<BrandPickGateResult> {
  const empty: BrandPickGateResult = {
    ok: true,
    missing: [],
    checked_lines: 0,
    multi_brand_lines: 0,
    auto_applied: 0,
  };

  try {
    const orderedIds = [
      ...new Set(
        (opts.orderedProductIds || [])
          .map(Number)
          .filter((n) => Number.isFinite(n) && n > 0)
      ),
    ];
    const orderMode =
      opts.mode === 'order' ||
      (opts.mode !== 'full' && orderedIds.length > 0);

    let auto_applied = 0;
    if (orderedIds.length) {
      const applied = await applyBrandPicksFromOrderedProducts(supabase, {
        schoolProfileId: opts.schoolProfileId,
        agencyProfileId: opts.agencyProfileId,
        orderedProductIds: orderedIds,
        companyProfileId: opts.companyProfileId,
      });
      auto_applied = applied.applied;
    }

    const ctx = await loadBrandPickContext(supabase, opts);
    if (!ctx) return { ...empty, auto_applied };

    const orderedSet = new Set(orderedIds);
    const missing: MissingBrandPick[] = [];
    let multi = 0;

    for (const line of ctx.lines) {
      const defaultPid = line.approved_product_id
        ? Number(line.approved_product_id)
        : null;
      const { options, brandCount } = ctx.findOptions(
        line.category != null ? String(line.category) : null,
        defaultPid
      );
      if (options.length < 2 && brandCount < 2) continue;
      multi += 1;

      const lineId = Number(line.id);
      const chosen = ctx.choices.get(lineId);
      if (chosen && Number.isFinite(chosen)) continue;

      // Order-scoped: only gate lines that touch products on this PO
      if (orderMode && orderedIds.length) {
        const overlapsOrder = options.some((o) => orderedSet.has(o.id));
        if (!overlapsOrder) continue; // not on this PO — don't block
        // Should have been auto-applied; if still missing, list it
      }

      missing.push({
        recipe_id: Number(line.recipe_id),
        recipe_name: ctx.recipeName.get(Number(line.recipe_id)) || 'Recipe',
        recipe_line_id: lineId,
        category: line.category != null ? String(line.category) : null,
        product_name: String(line.product_name || 'Ingredient'),
        default_brand:
          line.brand_name != null ? String(line.brand_name) : null,
        option_count: options.length,
      });
    }

    if (!missing.length) {
      return {
        ok: true,
        missing: [],
        checked_lines: ctx.lines.length,
        multi_brand_lines: multi,
        auto_applied,
      };
    }

    return {
      ok: false,
      missing: missing.slice(0, 40),
      checked_lines: ctx.lines.length,
      multi_brand_lines: multi,
      auto_applied,
      message: orderMode
        ? `Pick brands on ${missing.length} multi-brand line(s) related to this order (e.g. which soya brand), or order a specific brand product from kitchen.`
        : `Pick brands on ${missing.length} multi-brand recipe line(s) before ordering (e.g. which soya brand).`,
      href: '/dashboard/schools/recipes',
    };
  } catch {
    return empty;
  }
}

/** Days until required date (negative = overdue). null if no date. */
export function daysUntilRequired(requiredDate?: string | null): number | null {
  if (!requiredDate) return null;
  const d = String(requiredDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${d}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 864e5);
}

export type OtifRisk = 'on_track' | 'due_soon' | 'at_risk' | 'late' | 'done' | 'unknown';

/**
 * Sprint A2 — OTIF risk from required delivery date vs fulfilment state.
 */
export function computeOtifRisk(opts: {
  requiredDate?: string | null;
  fulfilled?: boolean;
  cancelled?: boolean;
}): {
  days_to_required: number | null;
  otif_risk: OtifRisk;
  otif_risk_label: string;
} {
  if (opts.cancelled) {
    return {
      days_to_required: daysUntilRequired(opts.requiredDate),
      otif_risk: 'unknown',
      otif_risk_label: 'Cancelled',
    };
  }
  if (opts.fulfilled) {
    return {
      days_to_required: daysUntilRequired(opts.requiredDate),
      otif_risk: 'done',
      otif_risk_label: 'Fulfilled',
    };
  }
  const days = daysUntilRequired(opts.requiredDate);
  if (days == null) {
    return {
      days_to_required: null,
      otif_risk: 'unknown',
      otif_risk_label: 'No required date',
    };
  }
  if (days < 0) {
    return {
      days_to_required: days,
      otif_risk: 'late',
      otif_risk_label: `${Math.abs(days)}d late`,
    };
  }
  if (days === 0) {
    return {
      days_to_required: days,
      otif_risk: 'at_risk',
      otif_risk_label: 'Due today',
    };
  }
  if (days <= 2) {
    return {
      days_to_required: days,
      otif_risk: 'due_soon',
      otif_risk_label: `${days}d left`,
    };
  }
  return {
    days_to_required: days,
    otif_risk: 'on_track',
    otif_risk_label: `${days}d left`,
  };
}
