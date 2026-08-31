export const gymPwaFieldClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/15 dark:bg-neutral-950 dark:text-white dark:placeholder:text-slate-500';

export const gymPwaCompactFieldClass =
  'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/15 dark:bg-neutral-950 dark:text-white dark:placeholder:text-slate-500';

const REQUIRED_TOKENS = [
  'text-slate-900',
  'dark:text-white',
  'placeholder:text-slate-400',
  'dark:placeholder:text-slate-500',
  'bg-white',
  'dark:bg-neutral-950',
  'border-slate-200',
  'dark:border-white/15',
] as const;

const FORBIDDEN_TOKENS = ['dark:bg-yellow-950'] as const;

export function validateGymPwaFieldClassTokens(className: string): {
  missing: string[];
  forbidden: string[];
} {
  const value = String(className || '');
  const missing = REQUIRED_TOKENS.filter((token) => !value.includes(token));
  const forbidden = FORBIDDEN_TOKENS.filter((token) => value.includes(token));
  return { missing: [...missing], forbidden: [...forbidden] };
}
