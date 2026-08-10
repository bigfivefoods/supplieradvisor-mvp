/**
 * Shared process “Who does what” colour surfaces for dark + light.
 * dark:!bg-* beats global pastel remaps so role colours stay distinct.
 */

export type FitTone = 'owner' | 'coach' | 'member';
export type FieldTone = 'office' | 'ops' | 'trade';
export type QuarryTone = 'office' | 'ops' | 'trade';
export type NsnpTone = 'dbe' | 'school' | 'sp';

export type RoleTone = FitTone | FieldTone | QuarryTone | NsnpTone | 'default';

type TonePack = {
  card: string;
  row: string;
  table: string;
  thead: string;
  title: string;
  label: string;
  value: string;
  link: string;
  chip: string;
};

const VIOLET: TonePack = {
  card: 'border-violet-300 bg-violet-50 dark:!border-violet-400 dark:!bg-violet-950 dark:ring-1 dark:ring-violet-500/50',
  row: 'border-violet-200 bg-white dark:!border-violet-400 dark:!bg-violet-950 dark:ring-1 dark:ring-violet-500/40',
  table:
    'border-violet-200 bg-white dark:!border-violet-400 dark:!bg-violet-950 dark:ring-1 dark:ring-violet-500/40',
  thead: 'bg-violet-50 text-violet-900 dark:bg-violet-900/50 dark:text-violet-200',
  title: 'text-slate-900 dark:text-violet-50',
  label: 'text-violet-700/80 dark:text-violet-300/80',
  value: 'text-slate-900 dark:text-violet-50',
  link: 'text-violet-800 dark:text-violet-300',
  chip: 'bg-violet-700 text-white dark:bg-violet-500 dark:text-white',
};

const AMBER: TonePack = {
  card: 'border-amber-300 bg-amber-50 dark:!border-amber-400 dark:!bg-amber-950 dark:ring-1 dark:ring-amber-500/50',
  row: 'border-amber-200 bg-white dark:!border-amber-400 dark:!bg-amber-950 dark:ring-1 dark:ring-amber-500/40',
  table:
    'border-amber-200 bg-white dark:!border-amber-400 dark:!bg-amber-950 dark:ring-1 dark:ring-amber-500/40',
  thead: 'bg-amber-50 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200',
  title: 'text-slate-900 dark:text-amber-50',
  label: 'text-amber-700/70 dark:text-amber-300/80',
  value: 'text-slate-900 dark:text-amber-50',
  link: 'text-amber-800 dark:text-amber-300',
  chip: 'bg-amber-600 text-white dark:bg-amber-500 dark:text-amber-950',
};

const CYAN: TonePack = {
  card: 'border-cyan-300 bg-sky-50 dark:!border-cyan-400 dark:!bg-cyan-950 dark:ring-1 dark:ring-cyan-500/50',
  row: 'border-cyan-200 bg-white dark:!border-cyan-400 dark:!bg-cyan-950 dark:ring-1 dark:ring-cyan-500/40',
  table:
    'border-cyan-200 bg-white dark:!border-cyan-400 dark:!bg-cyan-950 dark:ring-1 dark:ring-cyan-500/40',
  thead: 'bg-sky-50 text-sky-900 dark:bg-cyan-900/50 dark:text-cyan-200',
  title: 'text-slate-900 dark:text-cyan-50',
  label: 'text-sky-700/70 dark:text-cyan-300/80',
  value: 'text-slate-900 dark:text-cyan-50',
  link: 'text-sky-800 dark:text-cyan-300',
  chip: 'bg-sky-600 text-white dark:bg-cyan-500 dark:text-cyan-950',
};

const EMERALD: TonePack = {
  card: 'border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/50',
  row: 'border-emerald-200 bg-white dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40',
  table:
    'border-emerald-200 bg-white dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40',
  thead:
    'bg-emerald-50 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200',
  title: 'text-slate-900 dark:text-emerald-50',
  label: 'text-emerald-700/80 dark:text-emerald-300/80',
  value: 'text-slate-900 dark:text-emerald-50',
  link: 'text-emerald-800 dark:text-emerald-300',
  chip: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950',
};

const SKY: TonePack = {
  card: 'border-sky-300 bg-sky-50 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50',
  row: 'border-sky-200 bg-white dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/40',
  table:
    'border-sky-200 bg-white dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/40',
  thead: 'bg-sky-50 text-sky-900 dark:bg-sky-900/50 dark:text-sky-200',
  title: 'text-slate-900 dark:text-sky-50',
  label: 'text-sky-700/80 dark:text-sky-300/80',
  value: 'text-slate-900 dark:text-sky-50',
  link: 'text-[#0077b6] dark:text-sky-300',
  chip: 'bg-sky-600 text-white dark:bg-sky-500 dark:text-sky-950',
};

/** Process-role packs by semantic key */
export const ROLE_TONES: Record<string, TonePack> = {
  // Fitgraph
  owner: VIOLET,
  coach: AMBER,
  member: CYAN,
  // Fieldgraph
  'fg-office': EMERALD,
  'fg-ops': AMBER,
  'fg-trade': CYAN,
  office: EMERALD, // default office = field office emerald; quarry overrides via qg-office
  ops: AMBER,
  trade: CYAN,
  // Quarrygraph (prefix to avoid clashing with field office emerald)
  'qg-office': AMBER,
  'qg-ops': VIOLET,
  'qg-trade': CYAN,
  // NSNP / DBE
  dbe: SKY,
  school: EMERALD,
  sp: AMBER,
  default: VIOLET,
};

export function tonePack(tone: string | undefined): TonePack {
  if (!tone) return ROLE_TONES.default;
  return ROLE_TONES[tone] || ROLE_TONES.default;
}

export function fieldInputClass() {
  return 'rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white w-full dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100';
}
