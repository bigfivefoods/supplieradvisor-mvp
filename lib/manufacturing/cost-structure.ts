/**
 * Manufacturing cost structure helpers — BUs, stations, assets, expense rollups.
 */

export type CostObjectType =
  | 'business_unit'
  | 'work_center'
  | 'work_station'
  | 'asset';

export type CostCategory =
  | 'operating'
  | 'labour'
  | 'energy'
  | 'maintenance'
  | 'depreciation'
  | 'materials'
  | 'capital'
  | 'overhead'
  | 'other';

export const COST_CATEGORIES: { value: CostCategory; label: string }[] = [
  { value: 'materials', label: 'Materials (inventory · BS)' },
  { value: 'capital', label: 'Capital / PPE (BS)' },
  { value: 'operating', label: 'Operating' },
  { value: 'labour', label: 'Labour' },
  { value: 'energy', label: 'Energy' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'depreciation', label: 'Depreciation' },
  { value: 'overhead', label: 'Overhead' },
  { value: 'other', label: 'Other' },
];

export const ASSET_TYPES = [
  'equipment',
  'tool',
  'vehicle',
  'fixture',
  'building',
  'other',
] as const;

/** Monthly straight-line depreciation */
export function monthlyDepreciation(opts: {
  purchaseCost: number;
  residualValue?: number;
  usefulLifeMonths?: number;
  method?: string | null;
}): number {
  if (String(opts.method || 'straight_line') === 'none') return 0;
  const life = Math.max(1, Number(opts.usefulLifeMonths || 60));
  const basis = Math.max(0, Number(opts.purchaseCost || 0) - Number(opts.residualValue || 0));
  return Math.round((basis / life) * 100) / 100;
}

export function monthsBetween(from: string | Date, to: string | Date = new Date()): number {
  const a = typeof from === 'string' ? new Date(from) : from;
  const b = typeof to === 'string' ? new Date(to) : to;
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return 0;
  const months =
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  return Math.max(0, months);
}

/** Accumulated depreciation to date (straight-line, capped at basis) */
export function accumulatedDepreciation(opts: {
  purchaseCost: number;
  residualValue?: number;
  usefulLifeMonths?: number;
  purchaseDate?: string | null;
  method?: string | null;
}): number {
  if (!opts.purchaseDate) return 0;
  const monthly = monthlyDepreciation(opts);
  const months = monthsBetween(opts.purchaseDate);
  const basis = Math.max(0, Number(opts.purchaseCost || 0) - Number(opts.residualValue || 0));
  return Math.min(basis, Math.round(monthly * months * 100) / 100);
}

export function bookValue(opts: {
  purchaseCost: number;
  residualValue?: number;
  usefulLifeMonths?: number;
  purchaseDate?: string | null;
  method?: string | null;
}): number {
  const cost = Number(opts.purchaseCost || 0);
  return Math.max(0, Math.round((cost - accumulatedDepreciation(opts)) * 100) / 100);
}

export type CostRollupRow = {
  objectType: CostObjectType;
  objectId: number;
  code: string;
  name: string;
  currency: string;
  directExpenses: number;
  assetAllocatedExpenses: number;
  assetMonthlyRunning: number;
  assetMonthlyDepreciation: number;
  workCenterHourlyCost: number;
  /** Total period cost (direct + allocated asset expense + monthly asset costs) */
  totalCost: number;
  entryCount: number;
};

export function sumByCurrency(
  rows: Array<{ amount?: number; currency?: string }>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const c = String(r.currency || 'ZAR');
    out[c] = (out[c] || 0) + Number(r.amount || 0);
  }
  return out;
}
