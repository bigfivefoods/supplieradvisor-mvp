/**
 * NSNP two-meal day structure: breakfast + lunch.
 * Helps DBE pick products and schools/SPs see daily feeding guidelines.
 */

export const MEAL_TYPES = ['breakfast', 'lunch'] as const;
export type MealTypeKey = (typeof MEAL_TYPES)[number];

export const MEAL_TYPE_META: Record<
  MealTypeKey,
  { label: string; short: string; hint: string; color: string }
> = {
  breakfast: {
    label: 'Breakfast',
    short: 'Breakfast',
    hint: 'Porridge, cereal, oats, milk — morning meal',
    color: 'amber',
  },
  lunch: {
    label: 'Lunch',
    short: 'Lunch',
    hint: 'Starch + protein + veg — main midday meal',
    color: 'sky',
  },
};

/** Weekday school week Mon–Fri */
export const SCHOOL_WEEK_DAYS = [
  { day: 1, label: 'Monday', short: 'Mon' },
  { day: 2, label: 'Tuesday', short: 'Tue' },
  { day: 3, label: 'Wednesday', short: 'Wed' },
  { day: 4, label: 'Thursday', short: 'Thu' },
  { day: 5, label: 'Friday', short: 'Fri' },
] as const;

/** Suggest which catalogue categories suit each meal */
export const MEAL_CATEGORY_HINTS: Record<MealTypeKey, string[]> = {
  breakfast: [
    'porridge',
    'cereal',
    'maize_meal',
    'protein', // milk powder
    'spread', // peanut butter
    'fruit',
  ],
  lunch: [
    'maize_meal',
    'samp',
    'rice',
    'beans',
    'lentils',
    'peas',
    'soya',
    'protein',
    'oil',
    'vegetables',
    'fruit',
    'salt',
    'stock',
    'soup',
    'ready_meal',
    'flour',
  ],
};

export type MealSlotProduct = {
  id: number;
  category?: string | null;
  name?: string;
  /** DBE catalogue flag — product allowed on breakfast menu */
  for_breakfast?: boolean | null;
  /** DBE catalogue flag — product allowed on lunch menu */
  for_lunch?: boolean | null;
};

/**
 * Products eligible for a menu meal slot.
 * Prefer explicit catalogue flags (for_breakfast / for_lunch).
 * When flags are null/undefined (legacy), fall back to category hints.
 * Only returns products tagged for that meal (or legacy untagged).
 */
export function productsForMealHint(
  products: MealSlotProduct[],
  meal: MealTypeKey
): MealSlotProduct[] {
  // Only products tagged for this meal (after resolveProductMealFlags enrichment)
  const flagged = products.filter((p) => {
    const flags = resolveProductMealFlags(p);
    return meal === 'breakfast' ? flags.for_breakfast : flags.for_lunch;
  });

  const hints = MEAL_CATEGORY_HINTS[meal];
  const preferred = flagged.filter((p) =>
    hints.some((h) => String(p.category || '').toLowerCase().includes(h))
  );
  const rest = flagged.filter((p) => !preferred.includes(p));
  return [...preferred, ...rest];
}

/** Default meal tags from category (used when cloning / creating products). */
export function defaultMealFlagsFromCategory(category?: string | null): {
  for_breakfast: boolean;
  for_lunch: boolean;
} {
  const cat = String(category || '').toLowerCase();
  if (/(porridge|cereal|oats)/.test(cat)) {
    return { for_breakfast: true, for_lunch: false };
  }
  if (
    /(samp|rice|beans|lentils|peas|soya|oil|vegetables|stock|soup|ready_meal|flour|salt)/.test(
      cat
    )
  ) {
    return { for_breakfast: false, for_lunch: true };
  }
  // Milk, fruit, protein, spreads can appear in either meal
  return { for_breakfast: true, for_lunch: true };
}

/**
 * Resolve breakfast/lunch tags from product row.
 * Order: explicit columns → metadata → category defaults.
 */
export function resolveProductMealFlags(p: {
  category?: string | null;
  for_breakfast?: boolean | null;
  for_lunch?: boolean | null;
  metadata?: unknown;
}): { for_breakfast: boolean; for_lunch: boolean } {
  const meta =
    p.metadata && typeof p.metadata === 'object'
      ? (p.metadata as Record<string, unknown>)
      : {};
  const hasCol =
    typeof p.for_breakfast === 'boolean' || typeof p.for_lunch === 'boolean';
  const hasMeta =
    typeof meta.for_breakfast === 'boolean' ||
    typeof meta.for_lunch === 'boolean';
  if (hasCol) {
    return {
      for_breakfast: p.for_breakfast !== false,
      for_lunch: p.for_lunch !== false,
    };
  }
  if (hasMeta) {
    return {
      for_breakfast: meta.for_breakfast !== false,
      for_lunch: meta.for_lunch !== false,
    };
  }
  return defaultMealFlagsFromCategory(p.category);
}

/** Attach resolved meal flags onto catalogue product rows for UI / menu. */
export function enrichProductsWithMealFlags<T extends Record<string, unknown>>(
  products: T[]
): Array<T & { for_breakfast: boolean; for_lunch: boolean }> {
  return products.map((p) => {
    const flags = resolveProductMealFlags(p as {
      category?: string | null;
      for_breakfast?: boolean | null;
      for_lunch?: boolean | null;
      metadata?: unknown;
    });
    return { ...p, ...flags };
  });
}

export type DayMealSlot = {
  day: number;
  meal_type: MealTypeKey;
  dish: string;
  approved_product_ids: number[];
  notes?: string;
};

/** Empty Mon–Fri × breakfast+lunch grid */
export function emptyTwoMealWeek(): DayMealSlot[] {
  const out: DayMealSlot[] = [];
  for (const d of SCHOOL_WEEK_DAYS) {
    for (const meal of MEAL_TYPES) {
      out.push({
        day: d.day,
        meal_type: meal,
        dish: '',
        approved_product_ids: [],
      });
    }
  }
  return out;
}

/** Merge stored items into full breakfast+lunch grid (fills missing slots) */
export function normalizeTwoMealItems(
  raw: Array<{
    day?: number;
    meal_type?: string;
    dish?: string;
    approved_product_ids?: number[];
    notes?: string;
  }>
): DayMealSlot[] {
  const map = new Map<string, DayMealSlot>();
  for (const it of raw || []) {
    const day = Number(it.day);
    const mt = String(it.meal_type || 'lunch').toLowerCase();
    const meal: MealTypeKey = mt === 'breakfast' ? 'breakfast' : 'lunch';
    if (!Number.isFinite(day) || day < 1 || day > 7) continue;
    const key = `${day}:${meal}`;
    map.set(key, {
      day,
      meal_type: meal,
      dish: String(it.dish || '').trim(),
      approved_product_ids: Array.isArray(it.approved_product_ids)
        ? it.approved_product_ids.map(Number).filter((n) => n > 0)
        : [],
      notes: it.notes,
    });
  }
  const out: DayMealSlot[] = [];
  for (const d of SCHOOL_WEEK_DAYS) {
    for (const meal of MEAL_TYPES) {
      const key = `${d.day}:${meal}`;
      out.push(
        map.get(key) || {
          day: d.day,
          meal_type: meal,
          dish: '',
          approved_product_ids: [],
        }
      );
    }
  }
  return out;
}

export function groupItemsByDay(
  items: DayMealSlot[]
): Array<{ day: number; label: string; short: string; meals: DayMealSlot[] }> {
  return SCHOOL_WEEK_DAYS.map((d) => ({
    day: d.day,
    label: d.label,
    short: d.short,
    meals: MEAL_TYPES.map(
      (mt) =>
        items.find((i) => i.day === d.day && i.meal_type === mt) || {
          day: d.day,
          meal_type: mt,
          dish: '',
          approved_product_ids: [],
        }
    ),
  }));
}

/** Default NSNP-style 2-meal week using product id lookup by name fragment */
export function buildDefaultTwoMealWeek(
  products: Array<{ id: number; name: string; category?: string | null }>
): DayMealSlot[] {
  const find = (...parts: string[]) => {
    const low = parts.map((p) => p.toLowerCase());
    const hit = products.find((p) => {
      const n = `${p.name} ${p.category || ''}`.toLowerCase();
      return low.every((x) => n.includes(x));
    });
    return hit?.id;
  };
  const ids = (...partsList: string[][]) =>
    partsList
      .map((parts) => find(...parts))
      .filter((n): n is number => Number.isFinite(n as number));

  const week: Array<{ day: number; b: string; bIds: number[]; l: string; lIds: number[] }> = [
    {
      day: 1,
      b: 'Fortified maize porridge with milk',
      bIds: ids(['porridge'], ['maize'], ['milk']),
      l: 'Samp & sugar beans with vegetables',
      lIds: ids(['samp'], ['bean'], ['vegetable']),
    },
    {
      day: 2,
      b: 'Oats porridge with peanut butter',
      bIds: ids(['oat'], ['peanut']),
      l: 'Rice with soya mince stew & veg',
      lIds: ids(['rice'], ['soya'], ['vegetable']),
    },
    {
      day: 3,
      b: 'Instant fortified porridge',
      bIds: ids(['porridge'], ['maize']),
      l: 'Chicken with rice & mixed vegetables',
      lIds: ids(['chicken'], ['rice'], ['vegetable']),
    },
    {
      day: 4,
      b: 'Maize porridge with fruit',
      bIds: ids(['maize'], ['fruit'], ['banana']),
      l: 'Pilchards with pap / maize meal & veg',
      lIds: ids(['pilchard'], ['maize'], ['vegetable']),
    },
    {
      day: 5,
      b: 'Oats or porridge with milk',
      bIds: ids(['oat'], ['milk'], ['porridge']),
      l: 'OnePot complete meal (or soya stew & rice)',
      lIds: ids(['onepot'], ['soya'], ['rice'], ['vegetable']),
    },
  ];

  const out: DayMealSlot[] = [];
  for (const w of week) {
    out.push({
      day: w.day,
      meal_type: 'breakfast',
      dish: w.b,
      approved_product_ids: [...new Set(w.bIds)],
    });
    out.push({
      day: w.day,
      meal_type: 'lunch',
      dish: w.l,
      approved_product_ids: [...new Set(w.lIds)],
    });
  }
  return out;
}
