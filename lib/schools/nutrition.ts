/**
 * NSNP nutrition norms vs menu/meal estimates.
 */

export type NutritionNorm = {
  meal_type: string;
  phase?: string | null;
  min_energy_kcal: number;
  min_protein_g: number;
  min_veg_servings?: number;
};

export type DishEstimate = {
  energy_kcal: number;
  protein_g: number;
  productCount: number;
};

/** Sum nutrients from linked approved products (simple per-dish estimate). */
export function estimateFromProducts(
  products: Array<{ energy_kcal?: number | null; protein_g?: number | null }>
): DishEstimate {
  let energy = 0;
  let protein = 0;
  let n = 0;
  for (const p of products) {
    if (p.energy_kcal != null && Number.isFinite(Number(p.energy_kcal))) {
      energy += Number(p.energy_kcal);
      n += 1;
    }
    if (p.protein_g != null && Number.isFinite(Number(p.protein_g))) {
      protein += Number(p.protein_g);
    }
  }
  // If multiple products, treat as composite dish (not per-100g precision — programme flag)
  return {
    energy_kcal: Math.round(energy * 10) / 10,
    protein_g: Math.round(protein * 10) / 10,
    productCount: n,
  };
}

export function evaluateNutrition(
  estimate: DishEstimate,
  norm: NutritionNorm | null
): {
  pass: boolean;
  energyPass: boolean;
  proteinPass: boolean;
  energy_kcal: number;
  protein_g: number;
  min_energy_kcal: number;
  min_protein_g: number;
} {
  const minE = norm?.min_energy_kcal ?? 450;
  const minP = norm?.min_protein_g ?? 15;
  // If no product nutrients linked, mark as unknown fail soft (energy/protein 0)
  const energyPass = estimate.energy_kcal >= minE;
  const proteinPass = estimate.protein_g >= minP;
  return {
    pass: estimate.productCount > 0 && energyPass && proteinPass,
    energyPass,
    proteinPass,
    energy_kcal: estimate.energy_kcal,
    protein_g: estimate.protein_g,
    min_energy_kcal: minE,
    min_protein_g: minP,
  };
}

export function pickNorm(
  norms: NutritionNorm[],
  mealType: string,
  phase?: string | null
): NutritionNorm | null {
  const mt = (mealType || 'lunch').toLowerCase();
  const ph = (phase || '').toLowerCase() || null;
  const exact = norms.find(
    (n) =>
      String(n.meal_type).toLowerCase() === mt &&
      (ph
        ? String(n.phase || '').toLowerCase() === ph
        : !n.phase)
  );
  if (exact) return exact;
  const anyPhase = norms.find(
    (n) => String(n.meal_type).toLowerCase() === mt && !n.phase
  );
  if (anyPhase) return anyPhase;
  return norms.find((n) => String(n.meal_type).toLowerCase() === mt) || null;
}
