/** EPM / PMO project types — DMAIC, SDG, programmes */

export const DMAIC_GATES = [
  {
    key: 'define',
    label: 'Define',
    short: 'D',
    desc: 'Problem, goal, charter, voice of customer, SIPOC',
    color: 'bg-violet-50 border-violet-200 text-violet-900',
  },
  {
    key: 'measure',
    label: 'Measure',
    short: 'M',
    desc: 'Baseline metrics, data plan, process capability',
    color: 'bg-sky-50 border-sky-200 text-sky-900',
  },
  {
    key: 'analyze',
    label: 'Analyze',
    short: 'A',
    desc: 'Root cause, hypothesis tests, vital few factors',
    color: 'bg-amber-50 border-amber-200 text-amber-900',
  },
  {
    key: 'improve',
    label: 'Improve',
    short: 'I',
    desc: 'Solutions, pilots, DOE, implementation plan',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  },
  {
    key: 'control',
    label: 'Control',
    short: 'C',
    desc: 'Control plan, SOPs, response plan, handoff',
    color: 'bg-rose-50 border-rose-200 text-rose-900',
  },
] as const;

export type DmaicGate = (typeof DMAIC_GATES)[number]['key'];

export const DMAIC_GATE_KEYS = DMAIC_GATES.map((g) => g.key);

export function isDmaicGate(v: unknown): v is DmaicGate {
  return typeof v === 'string' && DMAIC_GATE_KEYS.includes(v as DmaicGate);
}

export function dmaicGateMeta(key: string) {
  return DMAIC_GATES.find((g) => g.key === key) || DMAIC_GATES[0];
}

/** Gate exit checklist templates (Lean Six Sigma) */
export const DMAIC_GATE_CHECKLISTS: Record<DmaicGate, string[]> = {
  define: [
    'Project charter approved',
    'Problem & goal statements measurable',
    'SIPOC / process map drafted',
    'Voice of customer / CTQs captured',
    'Team & sponsor named',
  ],
  measure: [
    'Y metric operational definition agreed',
    'Data collection plan live',
    'Baseline performance calculated',
    'Measurement system validated (MSA if needed)',
    'Process capability / sigma estimate',
  ],
  analyze: [
    'Root causes validated with data',
    'Vital few Xs identified',
    'Cause-and-effect / fishbone reviewed',
    'Hypothesis / statistical evidence documented',
  ],
  improve: [
    'Solutions selected & FMEA reviewed',
    'Pilot completed with results',
    'Implementation plan & owners',
    'Benefits quantified vs baseline',
  ],
  control: [
    'Control plan signed off',
    'SOPs / training complete',
    'Response plan for out-of-control',
    'Hand-off to process owner',
    'Project close report',
  ],
};

export const PROJECT_METHODOLOGIES = [
  { value: 'standard', label: 'Standard initiative' },
  { value: 'dmaic', label: 'Lean Six Sigma (DMAIC)' },
  { value: 'sdg', label: 'SDG impact project' },
  { value: 'hybrid', label: 'Hybrid (DMAIC + SDG)' },
] as const;

export const PROJECT_TYPES = [
  { value: 'initiative', label: 'Strategic initiative' },
  { value: 'joint', label: 'Joint with partner' },
  { value: 'process_improvement', label: 'Process improvement' },
  { value: 'sdg', label: 'SDG / sustainability' },
  { value: 'capital', label: 'Capital / asset' },
  { value: 'digital', label: 'Digital / systems' },
  { value: 'other', label: 'Other' },
] as const;

export const PROGRAMME_STATUSES = [
  'active',
  'on_hold',
  'completed',
  'cancelled',
] as const;

export const RIAD_TYPES = [
  { value: 'risk', label: 'Risk' },
  { value: 'issue', label: 'Issue' },
  { value: 'action', label: 'Action' },
  { value: 'decision', label: 'Decision' },
] as const;

export const MIGRATION_HINT = 'Run supabase/migrations/20260723_pm_epm_pmo.sql';

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
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'completed':
      return 'bg-sky-50 text-sky-800 border-sky-200';
    case 'on_hold':
      return 'bg-amber-50 text-amber-900 border-amber-200';
    case 'cancelled':
      return 'bg-neutral-100 text-neutral-600 border-neutral-200';
    default:
      return 'bg-violet-50 text-violet-800 border-violet-200';
  }
}
