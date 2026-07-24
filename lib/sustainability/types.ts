/** World-class ESG / sustainability types and catalogs */

export const MIGRATION_HINT =
  'Run supabase/migrations/20260724_sustainability_esg_suite.sql';

export const GHG_SCOPES = [
  {
    value: '1',
    label: 'Scope 1',
    desc: 'Direct emissions from owned/controlled sources',
    color: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  {
    value: '2',
    label: 'Scope 2',
    desc: 'Indirect from purchased electricity, heat, steam',
    color: 'bg-amber-50 text-amber-900 border-amber-200',
  },
  {
    value: '3',
    label: 'Scope 3',
    desc: 'Value-chain emissions (upstream & downstream)',
    color: 'bg-sky-50 text-sky-800 border-sky-200',
  },
] as const;

export type GhgScope = (typeof GHG_SCOPES)[number]['value'];

/** Common GHG Protocol category keys by scope */
export const EMISSION_CATEGORIES: Record<
  string,
  { value: string; label: string; scope: GhgScope }[]
> = {
  '1': [
    { value: 'stationary_combustion', label: 'Stationary combustion', scope: '1' },
    { value: 'mobile_combustion', label: 'Mobile combustion (fleet)', scope: '1' },
    { value: 'process_emissions', label: 'Process emissions', scope: '1' },
    { value: 'fugitive', label: 'Fugitive emissions (refrigerants)', scope: '1' },
  ],
  '2': [
    { value: 'purchased_electricity', label: 'Purchased electricity', scope: '2' },
    { value: 'purchased_heat_steam', label: 'Purchased heat / steam', scope: '2' },
    { value: 'purchased_cooling', label: 'Purchased cooling', scope: '2' },
  ],
  '3': [
    { value: 'purchased_goods', label: 'Purchased goods & services', scope: '3' },
    { value: 'capital_goods', label: 'Capital goods', scope: '3' },
    { value: 'fuel_energy_upstream', label: 'Fuel- & energy-related (not S1/2)', scope: '3' },
    { value: 'upstream_transport', label: 'Upstream transportation', scope: '3' },
    { value: 'downstream_transport', label: 'Downstream transportation', scope: '3' },
    { value: 'waste', label: 'Waste generated in operations', scope: '3' },
    { value: 'business_travel', label: 'Business travel', scope: '3' },
    { value: 'employee_commuting', label: 'Employee commuting', scope: '3' },
    { value: 'use_of_sold', label: 'Use of sold products', scope: '3' },
    { value: 'end_of_life', label: 'End-of-life of sold products', scope: '3' },
    { value: 'other_scope3', label: 'Other Scope 3', scope: '3' },
  ],
};

export function allEmissionCategories() {
  return [...EMISSION_CATEGORIES['1'], ...EMISSION_CATEGORIES['2'], ...EMISSION_CATEGORIES['3']];
}

export function categoryLabel(value: string): string {
  return allEmissionCategories().find((c) => c.value === value)?.label || value;
}

/** Default emission factors (kg CO2e per unit) — order-of-magnitude, not certified */
export const DEFAULT_FACTORS: {
  category: string;
  unit: string;
  factor: number;
  factor_unit: string;
  source: string;
}[] = [
  {
    category: 'purchased_electricity',
    unit: 'kWh',
    factor: 0.45,
    factor_unit: 'kgCO2e/kWh',
    source: 'Generic grid (replace with local factor)',
  },
  {
    category: 'stationary_combustion',
    unit: 'litres',
    factor: 2.68,
    factor_unit: 'kgCO2e/L diesel-eq',
    source: 'Generic diesel approx',
  },
  {
    category: 'mobile_combustion',
    unit: 'litres',
    factor: 2.31,
    factor_unit: 'kgCO2e/L petrol-eq',
    source: 'Generic petrol approx',
  },
  {
    category: 'business_travel',
    unit: 'km',
    factor: 0.15,
    factor_unit: 'kgCO2e/km',
    source: 'Generic short-haul air/car mix',
  },
  {
    category: 'upstream_transport',
    unit: 'tkm',
    factor: 0.12,
    factor_unit: 'kgCO2e/t·km road',
    source: 'Road freight default',
  },
  {
    category: 'downstream_transport',
    unit: 'tkm',
    factor: 0.12,
    factor_unit: 'kgCO2e/t·km road',
    source: 'Road freight default',
  },
  {
    category: 'waste',
    unit: 'tonnes',
    factor: 500,
    factor_unit: 'kgCO2e/t landfill mix',
    source: 'Generic waste mix',
  },
];

export function defaultFactorFor(category: string) {
  return DEFAULT_FACTORS.find((f) => f.category === category) || null;
}

export const DATA_QUALITY = [
  { value: 'measured', label: 'Measured (meter / primary)' },
  { value: 'calculated', label: 'Calculated (activity × factor)' },
  { value: 'estimated', label: 'Estimated' },
  { value: 'spend_based', label: 'Spend-based' },
] as const;

export const RESOURCE_TYPES = [
  { value: 'water', label: 'Water' },
  { value: 'waste', label: 'Waste' },
  { value: 'energy', label: 'Energy' },
] as const;

export const RESOURCE_CATEGORIES: Record<
  string,
  { value: string; label: string; unit: string }[]
> = {
  water: [
    { value: 'withdrawal', label: 'Withdrawal', unit: 'm3' },
    { value: 'discharge', label: 'Discharge', unit: 'm3' },
    { value: 'recycled', label: 'Recycled / reused', unit: 'm3' },
    { value: 'consumption', label: 'Net consumption', unit: 'm3' },
  ],
  waste: [
    { value: 'landfill', label: 'Landfill', unit: 'tonnes' },
    { value: 'recycled_waste', label: 'Recycled', unit: 'tonnes' },
    { value: 'hazardous', label: 'Hazardous', unit: 'tonnes' },
    { value: 'composted', label: 'Composted / organic', unit: 'tonnes' },
    { value: 'incinerated', label: 'Incinerated / energy recovery', unit: 'tonnes' },
  ],
  energy: [
    { value: 'electricity', label: 'Electricity', unit: 'kWh' },
    { value: 'renewable', label: 'Renewable electricity', unit: 'kWh' },
    { value: 'fuel', label: 'Fuel (thermal)', unit: 'kWh' },
    { value: 'gas', label: 'Natural gas', unit: 'kWh' },
  ],
};

export const CERT_TYPES = [
  { value: 'iso14001', label: 'ISO 14001 EMS' },
  { value: 'iso50001', label: 'ISO 50001 Energy' },
  { value: 'organic', label: 'Organic' },
  { value: 'fairtrade', label: 'Fairtrade' },
  { value: 'rainforest', label: 'Rainforest Alliance' },
  { value: 'fsc', label: 'FSC / chain of custody' },
  { value: 'carbon_neutral', label: 'Carbon neutral / offset' },
  { value: 'bcorp', label: 'B Corp' },
  { value: 'gri', label: 'GRI / sustainability report' },
  { value: 'other', label: 'Other' },
] as const;

export const TARGET_METRICS = [
  { value: 'ghg_total', label: 'Total GHG (S1+S2+S3)', unit: 'tCO2e' },
  { value: 'ghg_scope1', label: 'Scope 1', unit: 'tCO2e' },
  { value: 'ghg_scope2', label: 'Scope 2', unit: 'tCO2e' },
  { value: 'ghg_scope3', label: 'Scope 3', unit: 'tCO2e' },
  { value: 'water', label: 'Water withdrawal', unit: 'm3' },
  { value: 'waste', label: 'Waste to landfill', unit: 'tonnes' },
  { value: 'energy', label: 'Energy use', unit: 'MWh' },
  { value: 'renewable_pct', label: 'Renewable electricity %', unit: '%' },
  { value: 'other', label: 'Other', unit: '' },
] as const;

export const INITIATIVE_PILLARS = [
  { value: 'environment', label: 'Environment' },
  { value: 'social', label: 'Social' },
  { value: 'governance', label: 'Governance' },
] as const;

export const MATERIALITY_TOPICS_SEED = [
  { topic: 'Climate change & GHG', pillar: 'environment' },
  { topic: 'Energy management', pillar: 'environment' },
  { topic: 'Water stewardship', pillar: 'environment' },
  { topic: 'Waste & circularity', pillar: 'environment' },
  { topic: 'Biodiversity & land', pillar: 'environment' },
  { topic: 'Labour practices', pillar: 'social' },
  { topic: 'Health & safety', pillar: 'social' },
  { topic: 'Diversity & inclusion', pillar: 'social' },
  { topic: 'Community impact', pillar: 'social' },
  { topic: 'Supply chain ethics', pillar: 'social' },
  { topic: 'Business ethics & anti-corruption', pillar: 'governance' },
  { topic: 'Data privacy & security', pillar: 'governance' },
  { topic: 'Product quality & safety', pillar: 'governance' },
  { topic: 'Board oversight of ESG', pillar: 'governance' },
] as const;

export function formatKgCo2e(kg: number): string {
  if (!Number.isFinite(kg)) return '—';
  if (Math.abs(kg) >= 1000) return `${(kg / 1000).toFixed(2)} t CO₂e`;
  return `${kg.toFixed(1)} kg CO₂e`;
}

export function kgToTonnes(kg: number): number {
  return Math.round((kg / 1000) * 1000) / 1000;
}

export function computeKgFromActivity(
  amount: number | null | undefined,
  factor: number | null | undefined
): number | null {
  if (amount == null || factor == null) return null;
  const a = Number(amount);
  const f = Number(factor);
  if (!Number.isFinite(a) || !Number.isFinite(f)) return null;
  return Math.round(a * f * 100) / 100;
}

export function targetProgressPct(opts: {
  baseline?: number | null;
  target?: number | null;
  current?: number | null;
}): number | null {
  const b = Number(opts.baseline);
  const t = Number(opts.target);
  const c = Number(opts.current);
  if (![b, t, c].every(Number.isFinite) || b === t) return null;
  // Progress toward target: 0 at baseline, 100 at target
  const pct = ((b - c) / (b - t)) * 100;
  return Math.max(0, Math.min(150, Math.round(pct)));
}

export function healthBadge(health?: string | null): string {
  switch (String(health || 'green')) {
    case 'amber':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'red':
      return 'bg-rose-100 text-rose-900 border-rose-200';
    default:
      return 'bg-emerald-100 text-emerald-900 border-emerald-200';
  }
}

export function statusBadge(status?: string | null): string {
  switch (String(status || '')) {
    case 'active':
    case 'in_progress':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'completed':
    case 'achieved':
      return 'bg-sky-50 text-sky-800 border-sky-200';
    case 'on_hold':
    case 'draft':
      return 'bg-amber-50 text-amber-900 border-amber-200';
    case 'cancelled':
    case 'missed':
    case 'retired':
    case 'expired':
      return 'bg-neutral-100 text-neutral-600 border-neutral-200';
    default:
      return 'bg-violet-50 text-violet-800 border-violet-200';
  }
}

export function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}
