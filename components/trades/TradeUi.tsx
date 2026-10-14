'use client';

import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/** TradeAdvisor® brand. Fills stay this cyan. Text on those fills stays navy. */
export const TRADE_CYAN = '#00b4d8';
export const TRADE_NAVY = '#0f172a';

export const tradeCard =
  'overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm';
export const tradeCardPad = `${tradeCard} p-4 sm:p-5`;
export const tradeNested =
  'rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm';
export const tradeBtn =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a] shadow-sm transition active:scale-[0.99] disabled:opacity-50';
export const tradeBtnSm =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-2xl bg-[#00b4d8] px-3 text-xs font-black text-[#0f172a] shadow-sm transition active:scale-[0.99] disabled:opacity-50';
export const tradeGhost =
  'inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 shadow-sm transition hover:border-slate-300 active:scale-[0.99]';
export const tradeGhostSm =
  'inline-flex min-h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 shadow-sm transition hover:border-slate-300';
export const tradeField =
  'mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30';
export const tradeLabel = 'block text-xs font-bold text-slate-700';
export const tradeLink = 'text-sm font-bold text-[#00b4d8]';
export const tradeKickerClass = 'text-[10px] font-black uppercase tracking-[0.2em] text-[#00b4d8]';
export const tradeChipOn =
  'shrink-0 rounded-2xl bg-[#00b4d8] px-3 py-2 text-xs font-black text-[#0f172a] shadow-sm';
export const tradeChipOff =
  'shrink-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-300';

export function TradeKicker({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00b4d8]">
      {children}
    </p>
  );
}

export function TradeHero({
  kicker,
  title,
  detail,
  children,
  testId,
}: {
  kicker?: string;
  title: ReactNode;
  detail?: ReactNode;
  children?: ReactNode;
  testId?: string;
}) {
  return (
    <section
      className="overflow-hidden rounded-3xl bg-[#00b4d8] p-5 text-[#0f172a] shadow-sm"
      data-testid={testId}
    >
      {kicker ? (
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0f172a]/70">
          {kicker}
        </p>
      ) : null}
      <h2 className="mt-1 text-2xl font-black leading-tight tracking-tight">{title}</h2>
      {detail ? (
        <p className="mt-1 text-sm font-semibold leading-snug text-[#0f172a]/80">{detail}</p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

export function TradeStat({
  value,
  label,
  tone = 'default',
}: {
  value: ReactNode;
  label: string;
  tone?: 'default' | 'warn';
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm">
      <p className={`truncate text-xl font-black tabular-nums ${tone === 'warn' ? 'text-amber-700' : 'text-slate-900'}`}>{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
    </div>
  );
}

export function TradeHeading({
  hint,
  children,
}: {
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h2 className="text-base font-black text-slate-900">{children}</h2>
      {hint ? <p className="mt-0.5 text-xs leading-snug text-slate-600">{hint}</p> : null}
    </div>
  );
}

export function TradeSection({
  title,
  hint,
  icon,
  action,
  children,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {icon ? (
            <span className="mt-0.5 shrink-0 text-slate-800 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-base font-black text-slate-900">{title}</h2>
            {hint ? (
              <p className="mt-0.5 text-xs leading-snug text-slate-600">{hint}</p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function TradeEmpty({
  title,
  hint,
  icon,
  testId,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center shadow-sm"
      data-testid={testId}
    >
      {icon ? (
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-500 [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-black text-slate-900">{title}</p>
      {hint ? <p className="mx-auto mt-1 max-w-sm text-xs leading-snug text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function TradeLoading({ label = 'Loading the book…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-16 text-center shadow-sm">
      <Loader2 className="h-8 w-8 animate-spin text-[#00b4d8]" />
      <p className="mt-3 text-sm font-bold text-slate-600">{label}</p>
    </div>
  );
}

export function TradeFlash({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'ok' | 'warn';
  children: ReactNode;
}) {
  const toneClass =
    tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-950'
        : 'border-sky-200 bg-sky-50 text-sky-950';
  return (
    <p role="status" className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold ${toneClass}`}>
      {children}
    </p>
  );
}
