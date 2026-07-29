/**
 * Sprint A1 — School brand-pick completeness gate.
 * When a BOM line has multiple approved brand options, the school must choose
 * one before submitting a PO (e.g. which soya brand).
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
  message?: string;
  href?: string;
};

/**
 * Returns incomplete multi-brand BOM lines for a school under an agency.
 * Soft-fails open (ok:true) if tables are missing so PO flow is not blocked by schema lag.
 */
export async function checkSchoolBrandPickGate(
  supabase: SupabaseClient,
  opts: {
    schoolProfileId: number;
    agencyProfileId: number;
  }
): Promise<BrandPickGateResult> {
  const empty: BrandPickGateResult = {
    ok: true,
    missing: [],
    checked_lines: 0,
    multi_brand_lines: 0,
  };

  try {
    const { data: recipes, error: rErr } = await supabase
      .from('nsnp_recipes')
      .select('id, name, active')
      .eq('agency_profile_id', opts.agencyProfileId)
      .limit(100);
    if (rErr) return empty;

    const active = (recipes || []).filter((r) => r.active !== false);
    if (!active.length) return empty;
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
    if (lErr || !lines?.length) return empty;

    const { data: products } = await supabase
      .from('nsnp_approved_products')
      .select('id, name, brand_name, category, active')
      .eq('agency_profile_id', opts.agencyProfileId)
      .limit(800);
    const catalogue = (products || []).filter((p) => p.active !== false);

    const byCategory = new Map<
      string,
      Array<{ id: number; name: string; brand_name: string }>
    >();
    for (const p of catalogue) {
      const cat = normalizeRecipeCategory(String(p.category || ''));
      if (!cat) continue;
      const list = byCategory.get(cat) || [];
      list.push({
        id: Number(p.id),
        name: String(p.name || ''),
        brand_name: String(p.brand_name || ''),
      });
      byCategory.set(cat, list);
    }

    const findOptions = (category?: string | null, defaultPid?: number | null) => {
      const cat = normalizeRecipeCategory(category);
      let options: Array<{ id: number; name: string; brand_name: string }> = [];
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
            },
            ...options,
          ];
        }
      }
      // distinct brands — gate only when school actually has a choice
      const brands = new Set(
        options.map((o) => o.brand_name.trim().toLowerCase()).filter(Boolean)
      );
      return { options, brandCount: Math.max(brands.size, options.length > 1 ? 2 : options.length) };
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

    const missing: MissingBrandPick[] = [];
    let multi = 0;
    for (const line of lines) {
      const defaultPid = line.approved_product_id
        ? Number(line.approved_product_id)
        : null;
      const { options, brandCount } = findOptions(
        line.category != null ? String(line.category) : null,
        defaultPid
      );
      if (options.length < 2 && brandCount < 2) continue;
      multi += 1;
      const lineId = Number(line.id);
      const chosen = choices.get(lineId);
      // Missing only if no explicit school choice (default product alone is not enough when multi-brand)
      if (!chosen || !Number.isFinite(chosen)) {
        missing.push({
          recipe_id: Number(line.recipe_id),
          recipe_name: recipeName.get(Number(line.recipe_id)) || 'Recipe',
          recipe_line_id: lineId,
          category: line.category != null ? String(line.category) : null,
          product_name: String(line.product_name || 'Ingredient'),
          default_brand:
            line.brand_name != null ? String(line.brand_name) : null,
          option_count: options.length,
        });
      }
    }

    if (!missing.length) {
      return {
        ok: true,
        missing: [],
        checked_lines: lines.length,
        multi_brand_lines: multi,
      };
    }

    return {
      ok: false,
      missing: missing.slice(0, 40),
      checked_lines: lines.length,
      multi_brand_lines: multi,
      message: `Pick brands on ${missing.length} multi-brand recipe line(s) before ordering (e.g. which soya brand).`,
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
