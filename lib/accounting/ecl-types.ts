export const ECL_BUCKETS = [
  'current',
  'd1_30',
  'd31_60',
  'd61_90',
  'd90_plus',
] as const;

export type EclBucket = (typeof ECL_BUCKETS)[number];

export const DEFAULT_ECL_RATES: Record<EclBucket, number> = {
  current: 1,
  d1_30: 2,
  d31_60: 5,
  d61_90: 10,
  d90_plus: 25,
};

export function agingBucket(daysOverdue: number): EclBucket {
  if (daysOverdue > 90) return 'd90_plus';
  if (daysOverdue > 60) return 'd61_90';
  if (daysOverdue > 30) return 'd31_60';
  if (daysOverdue > 0) return 'd1_30';
  return 'current';
}

export function normalizeEclRates(
  raw?: Partial<Record<EclBucket, number>> | null
): Record<EclBucket, number> {
  const out = { ...DEFAULT_ECL_RATES };
  for (const k of ECL_BUCKETS) {
    const n = Number(raw?.[k]);
    if (Number.isFinite(n) && n >= 0 && n <= 100) out[k] = n;
  }
  return out;
}
