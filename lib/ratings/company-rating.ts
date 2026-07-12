/**
 * Peer company star ratings (subjective).
 * OTIFEF stays objective PO performance — see lib/suppliers/otifef.ts
 */

export const RATEE_ROLES = ['supplier', 'customer', 'partner'] as const;
export type RateeRole = (typeof RATEE_ROLES)[number];

export type CompanyRatingRow = {
  id: number;
  rater_profile_id: number;
  ratee_profile_id: number;
  ratee_role: RateeRole | string;
  overall: number;
  quality?: number | null;
  delivery?: number | null;
  communication?: number | null;
  value?: number | null;
  payment?: number | null;
  reliability?: number | null;
  comment?: string | null;
  status?: string;
  created_at?: string | null;
  updated_at?: string | null;
  ratee_name?: string | null;
  rater_name?: string | null;
};

export type RatingAggregate = {
  ratee_profile_id: number;
  ratee_role: string;
  name: string;
  rating_avg: number;
  rating_count: number;
  quality: number | null;
  delivery: number | null;
  communication: number | null;
  value: number | null;
  payment: number | null;
  reliability: number | null;
};

export function clampStar(n: unknown): number | null {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  const i = Math.round(v);
  if (i < 1 || i > 5) return null;
  return i;
}

export function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export function aggregateRatings(
  rows: CompanyRatingRow[],
  nameMap: Record<number, string>
): RatingAggregate[] {
  const map = new Map<
    string,
    {
      ratee_profile_id: number;
      ratee_role: string;
      overalls: number[];
      quality: number[];
      delivery: number[];
      communication: number[];
      value: number[];
      payment: number[];
      reliability: number[];
    }
  >();

  for (const r of rows) {
    const sid = Number(r.ratee_profile_id);
    if (!Number.isFinite(sid)) continue;
    const role = String(r.ratee_role || 'supplier');
    const key = `${sid}:${role}`;
    if (!map.has(key)) {
      map.set(key, {
        ratee_profile_id: sid,
        ratee_role: role,
        overalls: [],
        quality: [],
        delivery: [],
        communication: [],
        value: [],
        payment: [],
        reliability: [],
      });
    }
    const m = map.get(key)!;
    m.overalls.push(Number(r.overall));
    if (r.quality != null) m.quality.push(Number(r.quality));
    if (r.delivery != null) m.delivery.push(Number(r.delivery));
    if (r.communication != null) m.communication.push(Number(r.communication));
    if (r.value != null) m.value.push(Number(r.value));
    if (r.payment != null) m.payment.push(Number(r.payment));
    if (r.reliability != null) m.reliability.push(Number(r.reliability));
  }

  return Array.from(map.values())
    .map((m) => ({
      ratee_profile_id: m.ratee_profile_id,
      ratee_role: m.ratee_role,
      name: nameMap[m.ratee_profile_id] || `Company ${m.ratee_profile_id}`,
      rating_avg: avg(m.overalls) || 0,
      rating_count: m.overalls.length,
      quality: avg(m.quality),
      delivery: avg(m.delivery),
      communication: avg(m.communication),
      value: avg(m.value),
      payment: avg(m.payment),
      reliability: avg(m.reliability),
    }))
    .sort((a, b) => b.rating_avg - a.rating_avg || b.rating_count - a.rating_count);
}

export const SUPPLIER_DIMS = [
  {
    key: 'quality' as const,
    label: 'Product / service quality',
    hint: 'Spec compliance, consistency, defects',
  },
  {
    key: 'delivery' as const,
    label: 'Delivery performance',
    hint: 'Lead times, OTIF behaviour, responsiveness on delays',
  },
  {
    key: 'communication' as const,
    label: 'Communication',
    hint: 'Clarity, honesty, speed of replies',
  },
  {
    key: 'value' as const,
    label: 'Commercial value',
    hint: 'Price fairness vs quality and service',
  },
] as const;

export const CUSTOMER_DIMS = [
  {
    key: 'payment' as const,
    label: 'Payment behaviour',
    hint: 'Pays on terms, disputes handled fairly',
  },
  {
    key: 'communication' as const,
    label: 'Communication',
    hint: 'Clear orders, forecasts, and feedback',
  },
  {
    key: 'reliability' as const,
    label: 'Order reliability',
    hint: 'Stable demand, few cancellations / last-minute changes',
  },
  {
    key: 'value' as const,
    label: 'Partnership quality',
    hint: 'Fair dealing, growth potential, collaboration',
  },
] as const;

/** Overall star scale — objective language for business feedback */
export const OVERALL_STAR_GUIDE: Record<
  1 | 2 | 3 | 4 | 5,
  { label: string; description: string }
> = {
  1: {
    label: 'Unacceptable',
    description:
      'Severe issues. Would not recommend. Relationship needs urgent review or exit.',
  },
  2: {
    label: 'Below expectations',
    description:
      'Repeated problems. Workable only with tight controls and a clear improvement plan.',
  },
  3: {
    label: 'Meets expectations',
    description:
      'Acceptable performance. Standard commercial relationship with normal oversight.',
  },
  4: {
    label: 'Strong',
    description:
      'Consistently good. Prefer this partner when capacity and price allow.',
  },
  5: {
    label: 'Excellent',
    description:
      'Best-in-class partner. Strategic relationship — expand volume with confidence.',
  },
};

export function starGuide(n: number) {
  const k = Math.min(5, Math.max(1, Math.round(n))) as 1 | 2 | 3 | 4 | 5;
  return OVERALL_STAR_GUIDE[k];
}
