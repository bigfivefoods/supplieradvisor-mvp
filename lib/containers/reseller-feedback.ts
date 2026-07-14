/**
 * Reseller customer feedback — star dimensions + rollups for product development.
 */

export const FEEDBACK_STAR_DIMENSIONS = [
  { key: 'rating_product', label: 'Product quality', short: 'Product' },
  { key: 'rating_price', label: 'Price', short: 'Price' },
  { key: 'rating_brand', label: 'Brand', short: 'Brand' },
  { key: 'rating_value', label: 'Value for money', short: 'Value' },
  { key: 'rating_packaging', label: 'Packaging', short: 'Pack' },
] as const;

export type FeedbackStarKey = (typeof FEEDBACK_STAR_DIMENSIONS)[number]['key'];

export type FeedbackRatings = Partial<Record<FeedbackStarKey, number | null>> & {
  rating_overall?: number | null;
};

export function clampStar(n: unknown): number | null {
  if (n == null || n === '') return null;
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.min(5, Math.max(1, Math.round(v * 2) / 2));
}

/** Average of provided 1–5 dimensions; null if none. */
export function computeOverall(ratings: FeedbackRatings): number | null {
  const vals: number[] = [];
  for (const d of FEEDBACK_STAR_DIMENSIONS) {
    const v = clampStar(ratings[d.key]);
    if (v != null) vals.push(v);
  }
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export type FeedbackRow = {
  id?: number;
  product_id?: number | null;
  product_name?: string | null;
  sku?: string | null;
  rating_product?: number | null;
  rating_price?: number | null;
  rating_brand?: number | null;
  rating_value?: number | null;
  rating_packaging?: number | null;
  rating_overall?: number | null;
  free_text?: string | null;
  customer_name?: string | null;
  reseller_id?: number;
  created_at?: string;
};

export type DimensionAvg = {
  key: FeedbackStarKey | 'rating_overall';
  label: string;
  avg: number | null;
  count: number;
};

export type ProductFeedbackRollup = {
  product_name: string;
  product_id: number | null;
  count: number;
  avg_overall: number | null;
  avg_product: number | null;
  avg_price: number | null;
  avg_brand: number | null;
  avg_value: number | null;
  avg_packaging: number | null;
  free_text_count: number;
};

function avgOf(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function collect(rows: FeedbackRow[], key: keyof FeedbackRow): number[] {
  const out: number[] = [];
  for (const r of rows) {
    const v = clampStar(r[key]);
    if (v != null) out.push(v);
  }
  return out;
}

export function rollupFeedback(rows: FeedbackRow[]): {
  total: number;
  with_text: number;
  dimensions: DimensionAvg[];
  by_product: ProductFeedbackRollup[];
  recent_comments: Array<{
    id: number;
    product_name: string;
    free_text: string;
    rating_overall: number | null;
    customer_name: string | null;
    reseller_id?: number;
    created_at?: string;
  }>;
} {
  const dimensions: DimensionAvg[] = [
    ...FEEDBACK_STAR_DIMENSIONS.map((d) => {
      const nums = collect(rows, d.key);
      return {
        key: d.key as FeedbackStarKey | 'rating_overall',
        label: d.label,
        avg: avgOf(nums),
        count: nums.length,
      };
    }),
    {
      key: 'rating_overall' as const,
      label: 'Overall',
      avg: avgOf(collect(rows, 'rating_overall')),
      count: collect(rows, 'rating_overall').length,
    },
  ];

  const byName = new Map<string, FeedbackRow[]>();
  for (const r of rows) {
    const name = String(r.product_name || 'Product').trim() || 'Product';
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name)!.push(r);
  }

  const by_product: ProductFeedbackRollup[] = [...byName.entries()]
    .map(([product_name, list]) => ({
      product_name,
      product_id:
        list.find((x) => x.product_id != null)?.product_id != null
          ? Number(list.find((x) => x.product_id != null)!.product_id)
          : null,
      count: list.length,
      avg_overall: avgOf(collect(list, 'rating_overall')),
      avg_product: avgOf(collect(list, 'rating_product')),
      avg_price: avgOf(collect(list, 'rating_price')),
      avg_brand: avgOf(collect(list, 'rating_brand')),
      avg_value: avgOf(collect(list, 'rating_value')),
      avg_packaging: avgOf(collect(list, 'rating_packaging')),
      free_text_count: list.filter((x) => String(x.free_text || '').trim()).length,
    }))
    .sort((a, b) => b.count - a.count);

  const recent_comments = rows
    .filter((r) => String(r.free_text || '').trim().length > 0)
    .slice(0, 40)
    .map((r) => ({
      id: Number(r.id || 0),
      product_name: String(r.product_name || 'Product'),
      free_text: String(r.free_text || '').trim(),
      rating_overall: clampStar(r.rating_overall),
      customer_name: r.customer_name ? String(r.customer_name) : null,
      reseller_id: r.reseller_id != null ? Number(r.reseller_id) : undefined,
      created_at: r.created_at,
    }));

  return {
    total: rows.length,
    with_text: rows.filter((r) => String(r.free_text || '').trim()).length,
    dimensions,
    by_product,
    recent_comments,
  };
}
