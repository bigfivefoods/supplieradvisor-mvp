/**
 * Shared process “Who does what” colour surfaces for dark + light.
 * Dark mode uses tinted gradients (not flat grey/white slabs) with light type.
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

/*
 * Dark mode: tinted gradients (not flat grey/white).
 * Full class names required for Tailwind JIT.
 */

const VIOLET: TonePack = {
  card:
    'border-violet-300 bg-violet-50 dark:!border-violet-400 dark:bg-gradient-to-br dark:from-violet-950 dark:via-[#140c22] dark:to-black dark:ring-1 dark:ring-violet-500/40 dark:text-white',
  row:
    'border-violet-200 bg-white dark:!border-violet-400 dark:bg-gradient-to-br dark:from-violet-950/95 dark:via-[#120a1c] dark:to-black dark:ring-1 dark:ring-violet-500/35 dark:text-white',
  table:
    'border-violet-200 bg-white dark:!border-violet-400 dark:bg-gradient-to-br dark:from-violet-950/90 dark:via-[#100818] dark:to-black dark:ring-1 dark:ring-violet-500/35 dark:text-white',
  thead:
    'bg-violet-50 text-violet-900 dark:bg-violet-900/40 dark:text-white',
  title: 'text-slate-900 dark:text-white',
  label: 'text-violet-700/80 dark:text-white/80',
  value: 'text-slate-900 dark:text-white',
  link: 'text-violet-800 dark:text-white',
  chip: 'bg-violet-700 text-white dark:bg-violet-500 dark:text-white',
};

const AMBER: TonePack = {
  card:
    'border-amber-300 bg-amber-50 dark:!border-amber-400 dark:bg-gradient-to-br dark:from-amber-950 dark:via-[#1a1208] dark:to-black dark:ring-1 dark:ring-amber-500/40 dark:text-white',
  row:
    'border-amber-200 bg-white dark:!border-amber-400 dark:bg-gradient-to-br dark:from-amber-950/95 dark:via-[#161008] dark:to-black dark:ring-1 dark:ring-amber-500/35 dark:text-white',
  table:
    'border-amber-200 bg-white dark:!border-amber-400 dark:bg-gradient-to-br dark:from-amber-950/90 dark:via-[#120e06] dark:to-black dark:ring-1 dark:ring-amber-500/35 dark:text-white',
  thead: 'bg-amber-50 text-amber-900 dark:bg-amber-900/40 dark:text-white',
  title: 'text-slate-900 dark:text-white',
  label: 'text-amber-700/70 dark:text-white/80',
  value: 'text-slate-900 dark:text-white',
  link: 'text-amber-800 dark:text-white',
  chip: 'bg-amber-600 text-white dark:bg-amber-500 dark:text-white',
};

const CYAN: TonePack = {
  card:
    'border-cyan-300 bg-sky-50 dark:!border-cyan-400 dark:bg-gradient-to-br dark:from-cyan-950 dark:via-[#061820] dark:to-black dark:ring-1 dark:ring-cyan-500/40 dark:text-white',
  row:
    'border-cyan-200 bg-white dark:!border-cyan-400 dark:bg-gradient-to-br dark:from-cyan-950/95 dark:via-[#05141a] dark:to-black dark:ring-1 dark:ring-cyan-500/35 dark:text-white',
  table:
    'border-cyan-200 bg-white dark:!border-cyan-400 dark:bg-gradient-to-br dark:from-cyan-950/90 dark:via-[#041018] dark:to-black dark:ring-1 dark:ring-cyan-500/35 dark:text-white',
  thead: 'bg-sky-50 text-sky-900 dark:bg-cyan-900/40 dark:text-white',
  title: 'text-slate-900 dark:text-white',
  label: 'text-sky-700/70 dark:text-white/80',
  value: 'text-slate-900 dark:text-white',
  link: 'text-sky-800 dark:text-white',
  chip: 'bg-sky-600 text-white dark:bg-cyan-500 dark:text-white',
};

const EMERALD: TonePack = {
  card:
    'border-emerald-300 bg-emerald-50 dark:!border-emerald-400 dark:bg-gradient-to-br dark:from-emerald-950 dark:via-[#0a1a14] dark:to-black dark:ring-1 dark:ring-emerald-500/40 dark:text-white',
  row:
    'border-emerald-200 bg-white dark:!border-emerald-400 dark:bg-gradient-to-br dark:from-emerald-950/95 dark:via-[#081612] dark:to-black dark:ring-1 dark:ring-emerald-500/35 dark:text-white',
  table:
    'border-emerald-200 bg-white dark:!border-emerald-400 dark:bg-gradient-to-br dark:from-emerald-950/90 dark:via-[#06120e] dark:to-black dark:ring-1 dark:ring-emerald-500/35 dark:text-white',
  thead:
    'bg-emerald-50 text-emerald-900 dark:bg-emerald-900/40 dark:text-white',
  title: 'text-slate-900 dark:text-white',
  label: 'text-emerald-700/80 dark:text-white/80',
  value: 'text-slate-900 dark:text-white',
  link: 'text-emerald-800 dark:text-white',
  chip: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white',
};

const SKY: TonePack = {
  card:
    'border-sky-300 bg-sky-50 dark:!border-sky-400 dark:bg-gradient-to-br dark:from-sky-950 dark:via-[#061820] dark:to-black dark:ring-1 dark:ring-sky-500/40 dark:text-white',
  row:
    'border-sky-200 bg-white dark:!border-sky-400 dark:bg-gradient-to-br dark:from-sky-950/95 dark:via-[#05141c] dark:to-black dark:ring-1 dark:ring-sky-500/35 dark:text-white',
  table:
    'border-sky-200 bg-white dark:!border-sky-400 dark:bg-gradient-to-br dark:from-sky-950/90 dark:via-[#041018] dark:to-black dark:ring-1 dark:ring-sky-500/35 dark:text-white',
  thead: 'bg-sky-50 text-sky-900 dark:bg-sky-900/40 dark:text-white',
  title: 'text-slate-900 dark:text-white',
  label: 'text-sky-700/80 dark:text-white/80',
  value: 'text-slate-900 dark:text-white',
  link: 'text-[#0077b6] dark:text-white',
  chip: 'bg-sky-600 text-white dark:bg-sky-500 dark:text-white',
};

/** Process-role packs by semantic key */
export const ROLE_TONES: Record<string, TonePack> = {
  // GymAdvisor
  owner: VIOLET,
  coach: AMBER,
  member: CYAN,
  // CropAdvisor
  'fg-office': EMERALD,
  'fg-ops': AMBER,
  'fg-trade': CYAN,
  office: EMERALD,
  ops: AMBER,
  trade: CYAN,
  // QuarryAdvisor
  'qg-office': AMBER,
  'qg-ops': VIOLET,
  'qg-trade': CYAN,
  // HireAdvisor
  'hg-desk': VIOLET,
  'hg-talent': CYAN,
  'hg-client': EMERALD,
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
