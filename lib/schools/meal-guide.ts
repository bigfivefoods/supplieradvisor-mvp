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

export function productsForMealHint(
  products: Array<{ id: number; category?: string | null; name?: string }>,
  meal: MealTypeKey
): Array<{ id: number; category?: string | null; name?: string }> {
  const hints = MEAL_CATEGORY_HINTS[meal];
  const preferred = products.filter((p) =>
    hints.some((h) => String(p.category || '').toLowerCase().includes(h))
  );
  // Always allow full list after preferred
  const rest = products.filter((p) => !preferred.includes(p));
  return [...preferred, ...rest];
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
