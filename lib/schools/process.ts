/**
 * World-class NSNP operating process for schools & DBE.
 * Single source of truth for journey stages, readiness, and role nav.
 */

export type ProcessRole = 'school' | 'agency' | 'isp';

export type ProcessStageId =
  | 'setup'
  | 'register'
  | 'catalogue'
  | 'supply'
  | 'kitchen'
  | 'serve'
  | 'quality'
  | 'fund'
  | 'govern'
  | 'improve';

export type ProcessStep = {
  id: string;
  stage: ProcessStageId;
  label: string;
  href: string;
  desc: string;
  /** School persona primary */
  school: boolean;
  /** Agency persona primary */
  agency: boolean;
  /** Daily kitchen path */
  daily?: boolean;
};

export const PROCESS_STAGES: Array<{
  id: ProcessStageId;
  label: string;
  short: string;
  color: string;
}> = [
  { id: 'setup', label: 'School identity', short: '1 · Setup', color: 'sky' },
  { id: 'register', label: 'Learners & EMIS', short: '2 · Register', color: 'indigo' },
  { id: 'catalogue', label: 'Approved foods & menu', short: '3 · Menu', color: 'violet' },
  { id: 'supply', label: 'SPs & orders', short: '4 · Supply', color: 'fuchsia' },
  { id: 'kitchen', label: 'Kitchen GRN & stock', short: '5 · Kitchen', color: 'rose' },
  { id: 'serve', label: 'Serve day', short: '6 · Serve', color: 'orange' },
  { id: 'quality', label: 'Feedback & compliance', short: '7 · Quality', color: 'amber' },
  { id: 'fund', label: 'Claims & audit', short: '8 · Fund', color: 'emerald' },
  { id: 'govern', label: 'DBE oversight', short: '9 · DBE', color: 'teal' },
  { id: 'improve', label: 'RIAD & maintenance', short: '10 · Improve', color: 'cyan' },
];

/** Canonical NSNP steps — process order */
export const PROCESS_STEPS: ProcessStep[] = [
  {
    id: 'profile',
    stage: 'setup',
    label: 'School profile',
    href: '/dashboard/schools/profile',
    desc: 'Photo, EMIS, contacts, kitchen flags',
    school: true,
    agency: false,
  },
  {
    id: 'agency_link',
    stage: 'setup',
    label: 'Join DBE / PEU',
    href: '/dashboard/schools/agency',
    desc: 'Request association — agency must approve',
    school: true,
    agency: true,
  },
  {
    id: 'learners',
    stage: 'register',
    label: 'Learners',
    href: '/dashboard/schools/learners',
    desc: 'Import & verify NSNP-eligible register',
    school: true,
    agency: false,
  },
  {
    id: 'emis',
    stage: 'register',
    label: 'EMIS attest',
    href: '/dashboard/schools/emis',
    desc: 'Headcount snapshot vs school register',
    school: true,
    agency: false,
  },
  {
    id: 'staff',
    stage: 'register',
    label: 'Staff',
    href: '/dashboard/schools/staff',
    desc: 'Principal, coordinator, kitchen team',
    school: true,
    agency: false,
  },
  {
    id: 'approved',
    stage: 'catalogue',
    label: 'Approved list',
    href: '/dashboard/schools/approved-list',
    desc: 'DBE-owned foods schools may buy',
    school: true,
    agency: true,
  },
  {
    id: 'menu',
    stage: 'catalogue',
    label: 'Weekly menu',
    href: '/dashboard/schools/menu',
    desc: 'Cycle dishes linked to approved products',
    school: true,
    agency: false,
  },
  {
    id: 'isps',
    stage: 'supply',
    label: 'SPs',
    href: '/dashboard/schools/isps',
    desc: 'Link only compliant service providers',
    school: true,
    agency: true,
  },
  {
    id: 'orders',
    stage: 'supply',
    label: 'Orders',
    href: '/dashboard/schools/orders',
    desc: 'POs — approved brands only',
    school: true,
    agency: false,
    daily: true,
  },
  {
    id: 'isp_sla',
    stage: 'supply',
    label: 'SP SLA',
    href: '/dashboard/schools/isp-sla',
    desc: 'Delivery & brand compliance scores',
    school: false,
    agency: true,
  },
  {
    id: 'kitchen',
    stage: 'kitchen',
    label: 'Kitchen GRN',
    href: '/dashboard/schools/kitchen',
    desc: 'Receive, issue, waste — gate non-approved',
    school: true,
    agency: false,
    daily: true,
  },
  {
    id: 'serve_day',
    stage: 'serve',
    label: 'Serve day',
    href: '/dashboard/schools/serve-day',
    desc: 'Present → meals → waste → nutrition in one flow',
    school: true,
    agency: false,
    daily: true,
  },
  {
    id: 'surveys',
    stage: 'quality',
    label: 'Food surveys',
    href: '/dashboard/schools/surveys',
    desc: 'Learner & parent meal feedback',
    school: true,
    agency: false,
    daily: true,
  },
  {
    id: 'compliance',
    stage: 'quality',
    label: 'Compliance',
    href: '/dashboard/schools/compliance',
    desc: 'Hygiene, incidents, training',
    school: true,
    agency: true,
  },
  {
    id: 'claims',
    stage: 'fund',
    label: 'Claims',
    href: '/dashboard/schools/claims',
    desc: 'Funding pack — tariff × meals + evidence',
    school: true,
    agency: true,
  },
  {
    id: 'audit',
    stage: 'fund',
    label: 'Audit pack',
    href: '/dashboard/schools/audit',
    desc: 'Hashed evidence + public transparency',
    school: true,
    agency: true,
  },
  {
    id: 'prizes',
    stage: 'fund',
    label: 'Prizes',
    href: '/dashboard/schools/prizes',
    desc: 'Fair quarterly scores for excellence',
    school: true,
    agency: true,
  },
  {
    id: 'agency_pack',
    stage: 'govern',
    label: 'Agency pack',
    href: '/dashboard/schools/agency-report',
    desc: 'Multi-school heatmaps & risks',
    school: false,
    agency: true,
  },
  {
    id: 'visits',
    stage: 'govern',
    label: 'PEU visits',
    href: '/dashboard/schools/visits',
    desc: 'Field monitor checklists',
    school: false,
    agency: true,
  },
  {
    id: 'map',
    stage: 'govern',
    label: 'Map',
    href: '/dashboard/schools/map',
    desc: 'School locations',
    school: true,
    agency: true,
  },
  {
    id: 'report',
    stage: 'govern',
    label: 'Analytics',
    href: '/dashboard/schools/report',
    desc: 'Slice & dice NSNP performance',
    school: true,
    agency: true,
  },
  {
    id: 'riad',
    stage: 'improve',
    label: 'RIAD log',
    href: '/dashboard/schools/riad',
    desc: 'Risks, issues, actions, decisions',
    school: true,
    agency: true,
  },
  {
    id: 'maintenance',
    stage: 'improve',
    label: 'Maintenance',
    href: '/dashboard/schools/maintenance',
    desc: 'Kitchen & campus facilities',
    school: true,
    agency: false,
  },
];

export type ReadinessCheck = {
  id: string;
  label: string;
  done: boolean;
  required: boolean;
  href: string;
  hint?: string;
  weight: number;
};

export type SchoolReadiness = {
  role: ProcessRole;
  score: number;
  readyForServeDay: boolean;
  readyForClaims: boolean;
  checks: ReadinessCheck[];
  nextAction: { label: string; href: string; desc: string } | null;
  today: {
    serveComplete: boolean;
    present?: number | null;
    served?: number | null;
    menuDish?: string | null;
  };
  kpis: {
    learners: number;
    verifiedPct: number;
    agencyLinked: boolean;
    agencyActive: boolean;
    hasMenu: boolean;
    ispLinks: number;
    stockLines: number;
    openOrders: number;
    surveyResponses: number;
    surveyAvg: number | null;
    openRiad: number;
    openMaint: number;
    openCompliance: number;
    deliveriesAwaiting?: number;
  };
};

/** NSNP lunch tariff default (ZAR) — used when agency has no custom rate */
export const DEFAULT_NSNP_MEAL_TARIFF_ZAR = 4.5;

export function countWeekdays(from: string, to: string): number {
  const a = new Date(from + 'T12:00:00');
  const b = new Date(to + 'T12:00:00');
  if (!(a.getTime() <= b.getTime())) return 0;
  let n = 0;
  const d = new Date(a);
  while (d <= b) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) n += 1;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

/**
 * Menu adherence: % of feeding days where menu_name was logged
 * (proxy until portion-level dish matching).
 */
export function computeMenuAdherencePct(
  feeding: Array<{ menu_name?: string | null; served_meals?: number | null }>
): number {
  const days = feeding.filter((f) => Number(f.served_meals || 0) > 0);
  if (!days.length) return 0;
  const named = days.filter((f) => String(f.menu_name || '').trim().length > 0);
  return Math.round((named.length / days.length) * 1000) / 10;
}

/**
 * Feeding completeness vs school weekdays in period (honest denominator).
 */
export function computeFeedingCompletenessPct(
  feeding: Array<{ feed_date?: string; served_meals?: number | null }>,
  from: string,
  to: string
): number {
  const weekdays = countWeekdays(from, to);
  if (weekdays <= 0) return 0;
  const fedDays = new Set(
    feeding
      .filter((f) => Number(f.served_meals || 0) > 0)
      .map((f) => String(f.feed_date))
  ).size;
  return Math.min(100, Math.round((fedDays / weekdays) * 1000) / 10);
}

/**
 * Claim amount = tariff × meals (funding model) with spend as cost evidence.
 */
export function computeClaimAmount(opts: {
  mealsServed: number;
  foodSpend: number;
  tariffZar?: number | null;
}): {
  claimAmount: number;
  costEvidence: number;
  tariff: number;
  method: 'tariff_x_meals' | 'spend_fallback';
} {
  const tariff =
    opts.tariffZar != null && opts.tariffZar > 0
      ? Number(opts.tariffZar)
      : DEFAULT_NSNP_MEAL_TARIFF_ZAR;
  const meals = Math.max(0, Number(opts.mealsServed) || 0);
  const spend = Math.max(0, Number(opts.foodSpend) || 0);
  if (meals > 0) {
    return {
      claimAmount: Math.round(meals * tariff * 100) / 100,
      costEvidence: Math.round(spend * 100) / 100,
      tariff,
      method: 'tariff_x_meals',
    };
  }
  return {
    claimAmount: Math.round(spend * 100) / 100,
    costEvidence: Math.round(spend * 100) / 100,
    tariff,
    method: 'spend_fallback',
  };
}

export function schoolNavSteps() {
  return PROCESS_STEPS.filter((s) => s.school);
}

export function agencyNavSteps() {
  return PROCESS_STEPS.filter((s) => s.agency);
}

export function dailyNavSteps() {
  return PROCESS_STEPS.filter((s) => s.daily);
}
